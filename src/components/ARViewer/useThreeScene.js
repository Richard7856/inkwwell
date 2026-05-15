import { useRef, useCallback } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

/*
  DRACOLoader compartido — necesario para decodificar GLBs comprimidos con Draco.

  Por qué se carga global (no por loadModel):
  El decoder de Draco es un módulo WASM/JS de ~200KB que se descarga una vez
  desde el CDN de Google. Crear una instancia por modelo desperdiciaría descargas.

  Por qué desde CDN externo y no /public/draco:
  Self-host requiere copiar los archivos del decoder (1.5MB) al bundle Vercel.
  El CDN de Google (gstatic.com) sirve los binarios con cache global e infraestructura
  más rápida que Vercel free. Trade-off aceptable para Phase 1.

  Modelos sin Draco (perro, fénix) NO usan este loader — GLTFLoader solo lo invoca
  si detecta la extensión KHR_draco_mesh_compression en el GLB.
*/
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')

/**
 * Hook que carga un GLB y lo ancla al image target de MindAR.
 * Maneja AnimationMixer para reproducir las animaciones del modelo.
 *
 * ── Por qué SÍ llamamos renderer.render() aquí ──
 * MindAR NO tiene loop de render interno. Verificado en el source:
 * - processVideo() corre un loop de TensorFlow (tf.nextFrame) que actualiza matrices
 * - NO llama renderer.render() en ningún punto
 * - El render ES responsabilidad del consumer (nosotros)
 *
 * Sin renderer.render() el canvas de Three.js nunca se pinta → pantalla negra.
 * La cámara es el <video> con z-index:-2 que se ve a través del canvas transparente
 * (alpha:true en el renderer). Si el canvas no se renderiza, no hay nada visible.
 *
 * @param {string} glbUrl - URL del modelo GLB
 * @returns {{ loadModel, playAnimation, getAnimationNames, cleanup }}
 */
export function useThreeScene(glbUrl) {
  const mixerRef = useRef(null)
  const modelRef = useRef(null)
  const lightsRef = useRef([])    // referencias para poder limpiarlas en cleanup
  const actionsRef = useRef({})
  const currentActionRef = useRef(null)
  const clockRef = useRef(new THREE.Clock())
  const frameIdRef = useRef(null)

  /**
   * Carga el GLB y lo añade al grupo del anchor.
   * Inicia el animation loop: mixer.update() + renderer.render() por frame.
   */
  const loadModel = useCallback(async (anchorGroup, renderer, scene, camera) => {
    const loader = new GLTFLoader()
    // Conectar DRACOLoader — sin esto, GLBs con Draco fallan con
    // "No DRACOLoader instance provided". Si el GLB no tiene Draco, no se invoca.
    loader.setDRACOLoader(dracoLoader)

    const gltf = await new Promise((resolve, reject) => {
      loader.load(glbUrl, resolve, undefined, reject)
    })

    const model = gltf.scene
    modelRef.current = model

    /*
      Auto-escala y centrado por bounding box.

      Por qué auto-escala en lugar de un valor fijo:
      Los GLBs vienen modelados en escalas muy distintas — un personaje de juego mide
      ~3 unidades, una escena completa (farmacia, edificio) puede medir 15-50 unidades.
      Un scale fijo (ej. 0.15) que funciona para el perro hace que la farmacia salga
      gigantesca o el fénix invisible. Calculando el bounding box real, NORMALIZAMOS
      cualquier GLB al mismo tamaño visual sobre el tatuaje.

      Target = 0.5 unidades en la dimensión más grande del modelo. Con MindAR
      donde 1 unidad ≈ tamaño del image target, 0.5 significa "ocupa la mitad del
      ancho del tatuaje" — tamaño correcto para ser visible sin tapar piel adyacente.

      Por qué también centramos:
      Muchos modelos tienen su pivot en una esquina o en el suelo (no en el centro
      geométrico). Sin centrar, el objeto aparece desplazado del tatuaje. Restamos
      el centro del bbox (multiplicado por la escala) a la posición del modelo
      para que su centro visual quede exactamente sobre el image target.
    */
    /*
      Config por modelo. Algunos GLBs requieren ajustes específicos que NO se pueden
      deducir solo del bounding box:

      - Escenas completas (con piso, paredes, mobiliario alrededor del personaje)
        tienen un bbox dominado por el piso → el personaje queda microscópico
        si normalizamos al bbox total. scaleMultiplier corrige eso.

      - Algunos modelos vienen con animaciones de cámara (Cinema4D "CINEMA_4D_Main")
        que NO son animaciones de personaje sino transformaciones de escena que
        rompen el renderizado AR. autoPlay:false los mantiene en pose estática.

      Identificamos el modelo por substring de la URL (no por nombre) para que
      funcione igual cuando el GLB vive en Supabase Storage con UUIDs en el path.
    */
    const MODEL_CONFIGS = [
      {
        match: 'farmacias_similares',
        // OJO: estos son nombres del MESH dentro del GLB (no nombres de nodo
        // de three.js). GLTFLoader nombra los Mesh resultantes con el nombre
        // del NODO padre, no del mesh — por eso usamos el parser.json para
        // mapear correctamente abajo.
        hideMeshNamePrefixes: ['Floor_', 'Tube_', 'seat_', 'Body_farm', 'Plane_farm', 'sign_farm', 'Sign_'],
        autoPlay: true,
      },
      // Default: mostrar todo, auto-play primera animación
    ]
    const modelCfg = MODEL_CONFIGS.find((c) => glbUrl.includes(c.match)) ?? {}
    const scaleMultiplier = modelCfg.scaleMultiplier ?? 1
    const shouldAutoPlay = modelCfg.autoPlay ?? true

    /*
      Filtrar meshes via gltf.parser.json (los nombres reales del GLB).

      Por qué no usar child.name directamente:
      Three.js GLTFLoader nombra cada Mesh con el nombre del NODO del gltf,
      no con el nombre del MESH del gltf. Si filtramos por child.name, no
      coincide con nuestros prefijos ("Floor_", etc. son nombres de mesh).

      Estrategia:
      1. parser.json.meshes → lista de meshes del gltf con sus nombres
      2. Identificar los índices de meshes a esconder (Floor_*, etc.)
      3. parser.json.nodes → nodes que referencian esos meshes
      4. Traversar three.js scene y esconder los Mesh con esos nombres de nodo

      Todo envuelto en try/catch — si la estructura interna del loader cambia
      en una versión futura, fallback graceful (modelo completo se muestra).
    */
    if (modelCfg.hideMeshNamePrefixes?.length > 0) {
      try {
        const gltfJson = gltf.parser?.json ?? {}
        const gltfMeshes = gltfJson.meshes ?? []
        const gltfNodes = gltfJson.nodes ?? []

        const meshIdxToHide = new Set()
        gltfMeshes.forEach((m, idx) => {
          const name = m.name ?? ''
          if (modelCfg.hideMeshNamePrefixes.some((p) => name.startsWith(p))) {
            meshIdxToHide.add(idx)
          }
        })

        const nodeNamesToHide = new Set()
        gltfNodes.forEach((n) => {
          if (typeof n.mesh === 'number' && meshIdxToHide.has(n.mesh)) {
            nodeNamesToHide.add(n.name ?? '')
          }
        })

        let hiddenCount = 0
        model.traverse((obj) => {
          if (obj.isMesh && nodeNamesToHide.has(obj.name)) {
            obj.visible = false
            hiddenCount++
          }
        })
        console.log(`[loadModel] Ocultos ${hiddenCount} meshes en ${glbUrl.split('/').pop()}`)
      } catch (err) {
        console.warn('[loadModel] hideMeshNamePrefixes falló (continuando con modelo completo):', err.message)
      }
    }

    /*
      Bbox de meshes VISIBLES (excluye los que escondimos arriba).

      Box3.setFromObject() incluye hijos invisibles por defecto — si lo usáramos,
      el bbox de la farmacia incluiría el piso oculto → el personaje quedaría
      microscópico al normalizar.

      Si no hay meshes visibles (bbox queda vacío con min=+Inf, max=-Inf),
      fallback a setFromObject del modelo completo para evitar scales NaN.
    */
    let bbox = new THREE.Box3()
    let hasVisible = false
    try {
      model.updateMatrixWorld(true)
      model.traverse((child) => {
        if (child.isMesh && child.visible && child.geometry) {
          if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
          if (child.geometry.boundingBox) {
            const mb = child.geometry.boundingBox.clone()
            mb.applyMatrix4(child.matrixWorld)
            bbox.union(mb)
            hasVisible = true
          }
        }
      })
    } catch (err) {
      console.warn('[loadModel] bbox manual falló:', err.message)
    }
    if (!hasVisible || !isFinite(bbox.min.x)) {
      bbox = new THREE.Box3().setFromObject(model)
    }

    const size = bbox.getSize(new THREE.Vector3())
    const center = bbox.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)

    const TARGET_SIZE = 0.5
    // Safety: si maxDim es 0/NaN, usar scale conservadora — evita NaN propagándose
    const scale = (maxDim > 0 && isFinite(maxDim))
      ? (TARGET_SIZE / maxDim) * scaleMultiplier
      : 0.1
    model.scale.setScalar(scale)
    model.position.copy(center).multiplyScalar(-scale)

    anchorGroup.add(model)

    /*
      Iluminación — OBLIGATORIA para que los materiales sean visibles.

      Por qué los perros salían negros:
      Three.js MeshStandardMaterial (el default en GLBs exportados desde Blender/3D tools)
      NO tiene color propio — responde a la luz de la escena. Sin luces en la escena,
      el material no recibe ningún aporte de luz → renderiza negro puro, ignorando texturas.

      MindARThree crea la escena pero NO agrega luces — esa responsabilidad es nuestra.

      Setup elegido:
      - AmbientLight: iluminación base pareja desde todas las direcciones (0.8 intensity).
        Garantiza que las partes del modelo sin incidencia directa no queden negras.
      - DirectionalLight: simula luz solar/spot, da forma y profundidad (1.5 intensity).
        Posición (1, 3, 2) — arriba-derecha-frente, ángulo natural para un objeto en el suelo.
    */
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
    dirLight.position.set(1, 3, 2)
    scene.add(dirLight)

    // Guardar referencias para quitarlas limpiamente en cleanup
    lightsRef.current = [ambientLight, dirLight]

    // Setup AnimationMixer si el GLB tiene animaciones esqueléticas
    if (gltf.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(model)
      mixerRef.current = mixer

      // Indexar todas las animaciones por nombre para acceso rápido
      gltf.animations.forEach((clip) => {
        actionsRef.current[clip.name] = mixer.clipAction(clip)
      })

      // Reproducir la primera animación por defecto (a menos que la config lo desactive)
      // Algunos GLBs tienen animaciones de cámara (no de personaje) que rompen el render AR
      if (shouldAutoPlay) {
        const firstClip = gltf.animations[0]
        actionsRef.current[firstClip.name].play()
        currentActionRef.current = actionsRef.current[firstClip.name]
      }
    }

    clockRef.current.start()

    // Loop RAF: actualizar mixer Y llamar renderer.render().
    // MindAR NO renderiza internamente — processVideo() solo actualiza matrices.
    // renderer (alpha:true) dibuja el canvas Three.js transparente encima del <video> de cámara.
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      const delta = clockRef.current.getDelta()
      if (mixerRef.current) {
        mixerRef.current.update(delta)
      }
      renderer.render(scene, camera)
    }

    animate()
  }, [glbUrl])

  /**
   * Cambia la animación activa con transición suave (crossfade).
   * fadeOut 0.3s de la actual + fadeIn 0.3s de la nueva.
   */
  const playAnimation = useCallback((animationName) => {
    const newAction = actionsRef.current[animationName]
    if (!newAction || newAction === currentActionRef.current) return

    if (currentActionRef.current) {
      currentActionRef.current.fadeOut(0.3)
    }

    newAction.reset().fadeIn(0.3).play()
    currentActionRef.current = newAction
  }, [])

  /** Devuelve los nombres de todas las animaciones disponibles en el GLB */
  const getAnimationNames = useCallback(() => {
    return Object.keys(actionsRef.current)
  }, [])

  /** Limpia Three.js: detiene el loop, disposa geometrías y texturas */
  const cleanup = useCallback(() => {
    if (frameIdRef.current) {
      cancelAnimationFrame(frameIdRef.current)
      frameIdRef.current = null
    }
    if (mixerRef.current) {
      mixerRef.current.stopAllAction()
    }
    if (modelRef.current) {
      modelRef.current.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose()
          if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            materials.forEach((mat) => {
              mat.map?.dispose()
              mat.dispose()
            })
          }
        }
      })
    }
    // Remover luces de la escena — no tienen .dispose() pero sí hay que sacarlas
    // del scene graph para evitar que persistan si el componente se vuelve a montar
    lightsRef.current.forEach((light) => light.parent?.remove(light))
    lightsRef.current = []

    actionsRef.current = {}
    currentActionRef.current = null
    modelRef.current = null
    mixerRef.current = null
  }, [])

  return {
    loadModel,
    playAnimation,
    getAnimationNames,
    cleanup,
    mixerRef,
  }
}

import { useRef, useCallback } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { cargarVideo, alternarVideo, liberarVideo } from './videoLayer.js'

/*
  DRACOLoader compartido — necesario para decodificar GLBs comprimidos con Draco.

  Se instancia una sola vez: el decoder es un módulo WASM de ~200KB que se
  descarga del CDN. Una instancia por modelo desperdiciaría descargas, y con
  varios tatuajes cargando modelos en paralelo eso se multiplicaría.

  Los GLBs sin Draco no lo invocan — GLTFLoader solo lo usa si detecta la
  extensión KHR_draco_mesh_compression.
*/
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')

/*
  Ajustes por modelo que NO se pueden deducir del bounding box.

  - Escenas completas (con piso y mobiliario alrededor del personaje) tienen un
    bbox dominado por el piso, así que el personaje queda microscópico al
    normalizar. scaleMultiplier lo corrige.
  - Algunos GLBs traen animaciones de cámara (Cinema4D "CINEMA_4D_Main") que no
    son de personaje y descolocan la escena. autoPlay:false los deja estáticos.

  Se identifica por substring de la URL, no por nombre de archivo, para que siga
  funcionando cuando el GLB viva en Storage con un UUID en la ruta.
*/
const MODEL_CONFIGS = [
  {
    match: 'farmacias_similares',
    // Se ocultan piso y bancas; los letreros se mantienen porque dan contexto de marca
    hideMeshNamePrefixes: ['Floor_', 'Tube_', 'seat_', 'Body_farm', 'Plane_farm'],
    scaleMultiplier: 2.5,
    autoPlay: true,
  },
]

/*
  Tamaño objetivo del modelo, en unidades de MindAR donde 1 ≈ el ancho del image
  target. 0.5 significa "ocupa la mitad del ancho del tatuaje": visible sin tapar
  la piel de alrededor.
*/
const TARGET_SIZE = 0.5

/**
 * Carga uno o varios GLB y los ancla a los image targets de MindAR.
 *
 * ── Por qué varios modelos ──
 * Un perfil puede tener varios tatuajes en un mismo .mind. Cada uno es un target
 * independiente con su propio ancla y su propio modelo 3D, y el usuario puede
 * apuntar a cualquiera sin recargar nada.
 *
 * ── Por qué SÍ llamamos renderer.render() aquí ──
 * MindAR NO tiene loop de render propio. Verificado en su código: processVideo()
 * corre un loop de TensorFlow que actualiza matrices, pero nunca llama a
 * renderer.render(). Sin este loop el canvas jamás se pinta y la pantalla queda
 * negra, porque la cámara se ve a través del canvas transparente.
 *
 * @returns {{ loadModels, playAnimation, getAnimationNames, cleanup }}
 */
export function useThreeScene() {
  // Un elemento por target: { model, mixer, actions, currentAction, animationNames }
  const targetsRef = useRef([])
  const lightsRef = useRef([])
  const clockRef = useRef(new THREE.Clock())
  const frameIdRef = useRef(null)

  /**
   * Carga el modelo de cada target y arranca el loop de render.
   *
   * @param {THREE.Group[]} anchorGroups - Grupo de cada ancla, en orden de targetIndex
   * @param {{glbUrl: string}[]} targets - Configuración de cada target
   */
  const loadModels = useCallback(async (anchorGroups, targets, renderer, scene, camera) => {
    /*
      Luces: se agregan UNA vez a la escena, no por modelo.

      MeshStandardMaterial (el default al exportar desde herramientas 3D) no
      tiene color propio: responde a la luz. Sin luces en la escena todo se
      renderiza negro, ignorando las texturas. MindARThree crea la escena pero
      no agrega ninguna — es responsabilidad nuestra.

      Con varios modelos, duplicar las luces por cada uno sumaría intensidades y
      quemaría la imagen cuando dos tatuajes estén visibles a la vez.
    */
    const ambient = new THREE.AmbientLight(0xffffff, 0.8)
    const dir = new THREE.DirectionalLight(0xffffff, 1.5)
    dir.position.set(1, 3, 2)
    scene.add(ambient, dir)
    lightsRef.current = [ambient, dir]

    /*
      Carga en paralelo. Los modelos son independientes entre sí y la descarga
      domina el tiempo, así que en serie el usuario esperaría la suma de todos.
      allSettled y no all: si un modelo falla, los demás deben seguir funcionando
      en lugar de dejar la experiencia entera rota.
    */
    /*
      Cada target lleva video o modelo 3D, no ambos.

      El video es el contenido por defecto del producto (ver DECISIONS.md); el
      GLB se conserva para el catálogo existente y para el 3D personalizado, que
      pasó a ser el motor de negocio. Se decide por qué campo trae el target en
      vez de por una bandera aparte: así un target mal configurado falla al
      cargar en lugar de mostrar algo distinto de lo que dice su registro.
    */
    const resultados = await Promise.allSettled(
      targets.map((t, i) =>
        t.videoUrl
          ? cargarVideo(t, anchorGroups[i])
          : loadOneModel(t.glbUrl, anchorGroups[i])
      )
    )

    targetsRef.current = resultados.map((r, i) => {
      if (r.status === 'fulfilled') return r.value
      console.error(`[loadModels] Falló el modelo del target ${i}:`, r.reason?.message)
      return null
    })

    clockRef.current.start()

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      const delta = clockRef.current.getDelta()
      // Un solo delta para todos: si cada mixer pidiera el suyo, el primero
      // consumiría el tiempo transcurrido y los demás avanzarían en cámara lenta
      // Solo los GLB tienen mixer; la textura de video se actualiza sola
      for (const t of targetsRef.current) t?.mixer?.update(delta)
      renderer.render(scene, camera)
    }
    animate()

    return targetsRef.current.map((t, i) => ({
      index: i,
      loaded: !!t,
      animationNames: t?.animationNames ?? [],
    }))
  }, [])

  /**
   * Avisa que un target entró o salió de cámara.
   *
   * Los videos se reproducen solo mientras su tatuaje está a la vista: si
   * corrieran desde la carga, quien por fin apunta encontraría la animación a
   * la mitad, y mientras tanto se gasta batería decodificando cuadros que nadie
   * ve. Los modelos 3D no necesitan esto — su animación en bucle no tiene
   * principio que respetar.
   */
  const setTargetVisible = useCallback((targetIndex, visible) => {
    alternarVideo(targetsRef.current[targetIndex], visible)
  }, [])

  /** Cambia la animación de un target concreto, con transición suave */
  const playAnimation = useCallback((targetIndex, animationName) => {
    const t = targetsRef.current[targetIndex]
    const next = t?.actions?.[animationName]
    if (!next || next === t.currentAction) return

    // Crossfade en vez de corte seco: sin esto el modelo salta de pose
    t.currentAction?.fadeOut(0.3)
    next.reset().fadeIn(0.3).play()
    t.currentAction = next
  }, [])

  const getAnimationNames = useCallback((targetIndex) => {
    return targetsRef.current[targetIndex]?.animationNames ?? []
  }, [])

  /**
   * Libera GPU y detiene el loop.
   * Crítico en mobile: cada modelo retiene geometrías y texturas, y con varios
   * cargados una fuga agota la memoria de video en pocos ciclos de navegación.
   */
  const cleanup = useCallback(() => {
    if (frameIdRef.current) {
      cancelAnimationFrame(frameIdRef.current)
      frameIdRef.current = null
    }

    for (const t of targetsRef.current) {
      if (!t) continue
      if (t.tipo === 'video') { liberarVideo(t); continue }
      t.mixer?.stopAllAction()
      t.model?.traverse((obj) => {
        if (!obj.isMesh) return
        obj.geometry?.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => {
          if (!m) return
          // Las texturas viven en propiedades del material (map, normalMap, ...)
          // y no se liberan al hacer dispose del material
          Object.values(m).forEach((v) => v?.isTexture && v.dispose())
          m.dispose?.()
        })
      })
      t.model?.parent?.remove(t.model)
    }
    targetsRef.current = []

    // Las luces no tienen dispose, pero sí hay que sacarlas del grafo para que
    // no se acumulen si el componente se vuelve a montar
    lightsRef.current.forEach((l) => l.parent?.remove(l))
    lightsRef.current = []
  }, [])

  return { loadModels, setTargetVisible, playAnimation, getAnimationNames, cleanup }
}

/** Carga un GLB, lo ajusta y lo cuelga del ancla que le corresponde. */
async function loadOneModel(glbUrl, anchorGroup) {
  const loader = new GLTFLoader()
  // Sin esto, un GLB comprimido falla con "No DRACOLoader instance provided"
  loader.setDRACOLoader(dracoLoader)

  const gltf = await new Promise((resolve, reject) => {
    loader.load(glbUrl, resolve, undefined, reject)
  })

  const model = gltf.scene
  const cfg = MODEL_CONFIGS.find((c) => glbUrl.includes(c.match)) ?? {}

  hideUnwantedMeshes(model, gltf, cfg)
  fitModelToTarget(model, cfg.scaleMultiplier ?? 1)
  anchorGroup.add(model)

  const actions = {}
  let mixer = null
  let currentAction = null
  const animationNames = gltf.animations.map((c) => c.name)

  if (gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model)
    gltf.animations.forEach((clip) => {
      actions[clip.name] = mixer.clipAction(clip)
    })
    if (cfg.autoPlay ?? true) {
      currentAction = actions[gltf.animations[0].name]
      currentAction.play()
    }
  }

  return { model, mixer, actions, currentAction, animationNames }
}

/**
 * Oculta meshes por nombre, resolviendo la diferencia entre nombres de mesh y de nodo.
 *
 * GLTFLoader nombra cada Mesh de three.js con el nombre del NODO del gltf, no
 * con el del MESH. Filtrar por obj.name directamente no coincide con los
 * prefijos configurados, que son nombres de mesh. Se usa parser.json para
 * traducir de uno a otro.
 */
function hideUnwantedMeshes(model, gltf, cfg) {
  if (!cfg.hideMeshNamePrefixes?.length) return
  try {
    const json = gltf.parser?.json ?? {}
    const meshIdx = new Set()
    ;(json.meshes ?? []).forEach((m, i) => {
      if (cfg.hideMeshNamePrefixes.some((p) => (m.name ?? '').startsWith(p))) meshIdx.add(i)
    })
    const nodeNames = new Set()
    ;(json.nodes ?? []).forEach((n) => {
      if (typeof n.mesh === 'number' && meshIdx.has(n.mesh)) nodeNames.add(n.name ?? '')
    })
    model.traverse((obj) => {
      if (obj.isMesh && nodeNames.has(obj.name)) obj.visible = false
    })
  } catch (err) {
    // Si la estructura interna del loader cambia, se muestra el modelo completo
    // en lugar de romper la carga
    console.warn('[loadOneModel] No se pudieron ocultar meshes:', err.message)
  }
}

/**
 * Normaliza tamaño y posición del modelo sobre el tatuaje.
 *
 * Los GLBs vienen en escalas dispares: un personaje mide ~3 unidades, una escena
 * completa 15-50. Un scale fijo que sirve para uno deja al otro invisible o
 * gigante. Se mide el bounding box real y se normaliza.
 *
 * Se centra además porque muchos modelos tienen el pivot en una esquina o en el
 * suelo; sin centrar aparecen desplazados del tatuaje.
 */
function fitModelToTarget(model, scaleMultiplier) {
  // Solo meshes VISIBLES: Box3.setFromObject incluye los ocultos, y eso haría
  // que un modelo con piso escondido siguiera normalizándose contra el piso
  let bbox = new THREE.Box3()
  let hasVisible = false
  try {
    model.updateMatrixWorld(true)
    model.traverse((child) => {
      if (!child.isMesh || !child.visible || !child.geometry) return
      if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
      if (!child.geometry.boundingBox) return
      const b = child.geometry.boundingBox.clone()
      b.applyMatrix4(child.matrixWorld)
      bbox.union(b)
      hasVisible = true
    })
  } catch (err) {
    console.warn('[fitModelToTarget] bbox manual falló:', err.message)
  }
  if (!hasVisible || !isFinite(bbox.min.x)) bbox = new THREE.Box3().setFromObject(model)

  const size = bbox.getSize(new THREE.Vector3())
  const center = bbox.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)

  // Guard contra 0/NaN: un scale inválido propaga NaN a las matrices y el
  // renderer deja de dibujar sin lanzar error
  const scale = (maxDim > 0 && isFinite(maxDim))
    ? (TARGET_SIZE / maxDim) * scaleMultiplier
    : 0.1

  model.scale.setScalar(scale)
  model.position.copy(center).multiplyScalar(-scale)
}

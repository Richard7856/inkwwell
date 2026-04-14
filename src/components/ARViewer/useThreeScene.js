import { useRef, useCallback } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

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

    const gltf = await new Promise((resolve, reject) => {
      loader.load(glbUrl, resolve, undefined, reject)
    })

    const model = gltf.scene
    modelRef.current = model

    // Escala: 1 unidad ≈ 10cm — ajustar si el modelo es muy grande/pequeño
    model.scale.set(0.15, 0.15, 0.15)

    anchorGroup.add(model)

    // Setup AnimationMixer si el GLB tiene animaciones esqueléticas
    if (gltf.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(model)
      mixerRef.current = mixer

      // Indexar todas las animaciones por nombre para acceso rápido
      gltf.animations.forEach((clip) => {
        actionsRef.current[clip.name] = mixer.clipAction(clip)
      })

      // Reproducir la primera animación por defecto
      const firstClip = gltf.animations[0]
      actionsRef.current[firstClip.name].play()
      currentActionRef.current = actionsRef.current[firstClip.name]
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

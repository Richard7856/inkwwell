import { useRef, useCallback } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Hook que carga un GLB y lo ancla al image target de MindAR.
 * Maneja AnimationMixer para reproducir las animaciones del modelo.
 *
 * El GLB se añade como hijo del anchor.group — MindAR se encarga
 * de posicionarlo y rotarlo según el tracking del tatuaje.
 *
 * ── IMPORTANTE: por qué NO llamamos renderer.render() aquí ──
 * MindAR en su start() llama renderer.setAnimationLoop(async () => {
 *   await processVideo()        ← actualiza el feed de cámara + detección
 *   renderer.render(scene, camera) ← renderiza la escena 3D encima
 * })
 * Si nosotros también llamamos renderer.render(), hay dos renders por frame
 * y la cámara queda negra. Si reemplazamos el loop con setAnimationLoop(),
 * perdemos processVideo() y la cámara también queda negra.
 * La solución: requestAnimationFrame SOLO para mixer.update() — MindAR
 * maneja el render completo (cámara + escena) en su propio loop.
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
   * Inicia un loop RAF exclusivamente para actualizar el AnimationMixer.
   */
  const loadModel = useCallback(async (anchorGroup) => {
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

    // Loop RAF — SOLO para mixer.update(delta).
    // NO llamamos renderer.render() — MindAR lo hace en su propio setAnimationLoop.
    // Agregar un segundo render causaría cámara negra (feed de cámara no se procesa).
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      const delta = clockRef.current.getDelta()
      if (mixerRef.current) {
        mixerRef.current.update(delta)
      }
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
            // Material puede ser array (multi-material) o single
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

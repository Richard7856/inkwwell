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
 * ¿Por qué renderer.setAnimationLoop en lugar de requestAnimationFrame?
 * MindAR internamente llama renderer.setAnimationLoop() para su propio render loop.
 * Si usamos requestAnimationFrame en paralelo, hay DOS llamadas a renderer.render()
 * por frame — MindAR no puede compositar correctamente la cámara y el resultado
 * es pantalla negra. Llamar a setAnimationLoop() REEMPLAZA el loop interno de
 * MindAR con el nuestro, que hace lo mismo (renderer.render) más el mixer.update().
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
  const rendererRef = useRef(null) // guardamos ref para poder parar el loop en cleanup

  /**
   * Carga el GLB y lo añade al grupo del anchor.
   * Usa renderer.setAnimationLoop para integrarse con MindAR sin conflicto.
   */
  const loadModel = useCallback(async (anchorGroup, renderer, scene, camera) => {
    const loader = new GLTFLoader()

    const gltf = await new Promise((resolve, reject) => {
      loader.load(glbUrl, resolve, undefined, reject)
    })

    const model = gltf.scene
    modelRef.current = model
    rendererRef.current = renderer

    // Escala: 1 unidad ≈ 10cm — ajustar si el modelo es muy grande/pequeño
    model.scale.set(0.15, 0.15, 0.15)

    anchorGroup.add(model)

    // Setup AnimationMixer si el GLB tiene animaciones esqueléticas
    if (gltf.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(model)
      mixerRef.current = mixer

      // Indexar todas las animaciones por nombre para acceso rápido en playAnimation()
      gltf.animations.forEach((clip) => {
        actionsRef.current[clip.name] = mixer.clipAction(clip)
      })

      // Reproducir la primera animación por defecto
      const firstClip = gltf.animations[0]
      actionsRef.current[firstClip.name].play()
      currentActionRef.current = actionsRef.current[firstClip.name]
    }

    clockRef.current.start()

    // setAnimationLoop reemplaza el loop interno de MindAR con el nuestro.
    // MindAR ya hizo setAnimationLoop(() => renderer.render(scene, camera)) en su start().
    // Al reemplazarlo aquí, controlamos el loop completo: mixer + render, un solo llamado por frame.
    renderer.setAnimationLoop(() => {
      const delta = clockRef.current.getDelta()
      if (mixerRef.current) {
        mixerRef.current.update(delta)
      }
      renderer.render(scene, camera)
    })
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

  /** Limpia Three.js: para el loop, disposa geometrías y texturas para evitar leaks */
  const cleanup = useCallback(() => {
    // setAnimationLoop(null) para el loop — equivalente a cancelAnimationFrame
    if (rendererRef.current) {
      rendererRef.current.setAnimationLoop(null)
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
    rendererRef.current = null
  }, [])

  return {
    loadModel,
    playAnimation,
    getAnimationNames,
    cleanup,
    mixerRef,
  }
}

import { useEffect, useRef, useCallback } from 'react'
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js'

/**
 * Hook que maneja el lifecycle completo de MindAR image tracking.
 *
 * Ciclo obligatorio: initMindAR → startCamera → onTargetFound → onTargetLost → dispose
 *
 * Memory leaks de cámara son inaceptables en mobile — el cleanup
 * cierra la cámara Y destruye el renderer para liberar WebGL context.
 *
 * @param {string} mindUrl - URL del archivo .mind (image target compilado)
 * @param {HTMLDivElement} containerRef - ref al div contenedor del AR
 * @returns {{ mindarRef, anchorRef, rendererRef, sceneRef, cameraRef, start, stop }}
 */
export function useMindAR(mindUrl, containerRef) {
  const mindarRef = useRef(null)
  const anchorRef = useRef(null)
  const isRunning = useRef(false)

  const start = useCallback(async () => {
    if (!containerRef.current || !mindUrl || isRunning.current) return

    const mindar = new MindARThree({
      container: containerRef.current,
      imageTargetSrc: mindUrl,
      // Tracking de un solo target — suficiente para Phase 1
      maxTrack: 1,
      // UI nativa de MindAR para loading/scanning — útil para el demo
      uiLoading: 'yes',
      uiScanning: 'yes',
      uiError: 'yes',
    })

    mindarRef.current = mindar

    // Anchor en targetIndex 0 — el primer (y único) image target
    const anchor = mindar.addAnchor(0)
    anchorRef.current = anchor

    try {
      await mindar.start()
      isRunning.current = true
    } catch (err) {
      console.error('MindAR start failed:', err)
      // Probablemente permiso de cámara denegado o HTTPS faltante
      throw err
    }

    return { anchor, mindar }
  }, [mindUrl, containerRef])

  const stop = useCallback(() => {
    if (mindarRef.current && isRunning.current) {
      mindarRef.current.stop()
      isRunning.current = false
    }
    // Liberar WebGL context — critical en mobile para evitar leaks
    if (mindarRef.current?.renderer) {
      mindarRef.current.renderer.dispose()
    }
    mindarRef.current = null
    anchorRef.current = null
  }, [])

  // Cleanup automático al desmontar — previene cámara activa en background
  useEffect(() => {
    return () => stop()
  }, [stop])

  return {
    mindarRef,
    anchorRef,
    start,
    stop,
    // Exponer scene/camera/renderer de MindAR para que useThreeScene los use
    getScene: () => mindarRef.current?.scene ?? null,
    getCamera: () => mindarRef.current?.camera ?? null,
    getRenderer: () => mindarRef.current?.renderer ?? null,
  }
}

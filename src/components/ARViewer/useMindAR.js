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
  // Observa el tamaño del contenedor para re-sincronizar el layout de MindAR
  const resizeObserverRef = useRef(null)

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

      /*
        One Euro Filter — controla el suavizado del tracking.

        filterMinCF (minimum cutoff frequency):
          Frecuencia de corte mínima. Valores bajos = más suavizado cuando el objeto
          está quieto. 0.001 = máximo suavizado en reposo (menos jitter al estar fijo).

        filterBeta (speed coefficient):
          Ajusta cuánto se reduce el suavizado cuando hay movimiento rápido.
          DEFAULT = 1000 → muy reactivo al movimiento → mucho jitter (vibración).
          0.001 → suavizado consistente incluso en movimiento → menos vibración.

        Por qué estos valores para un tatuaje:
        El tatuaje se mueve lentamente (brazo, cuerpo). No necesitamos respuesta
        ultra-rápida a velocidades altas. Priorizamos estabilidad sobre reactividad.
        Resultado: el 3D "flota" estable en lugar de vibrar.
      */
      filterMinCF: 0.001,
      filterBeta: 0.001,
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

    /*
      Re-cálculo de layout tras el arranque.

      Por qué hace falta:
      MindAR llama a su resize() dentro de start(), pero en ese momento el <video>
      puede reportar videoWidth/videoHeight = 0 — el stream aún no entregó frame.
      Con esas dimensiones el cálculo de cover sale mal y el video queda de un
      tamaño que no corresponde al contenedor.

      Por qué NO tocamos los estilos del video ni del canvas a mano:
      resize() de MindAR (image-target/three.js:241) ya hace el ajuste correcto:
      calcula vw/vh para cubrir el contenedor preservando el aspect ratio del
      stream, centra el video con offsets negativos, y dimensiona el canvas al
      contenedor. Ponerle encima width:100%/left:0 propios generaba una carrera:
      MindAR sobrescribe los nuestros en cada resize y los nuestros los suyos al
      arrancar — quién gana dependía del timing. De ahí el layout inconsistente.

      ResizeObserver en vez de solo el evento resize de window:
      el contenedor puede cambiar de tamaño sin que window dispare resize (barra
      de URL que aparece/desaparece, teclado, cambio de safe-area). El observer
      reacciona al tamaño real del contenedor, que es lo que MindAR necesita.
    */
    const scheduleResize = () => {
      // Doble RAF: el primero espera al siguiente frame, el segundo garantiza que
      // el layout ya se aplicó antes de que MindAR lea clientWidth/clientHeight
      requestAnimationFrame(() => {
        requestAnimationFrame(() => mindarRef.current?.resize?.())
      })
    }
    scheduleResize()

    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserverRef.current = new ResizeObserver(scheduleResize)
      resizeObserverRef.current.observe(containerRef.current)
    }

    return { anchor, mindar }
  }, [mindUrl, containerRef])

  const stop = useCallback(() => {
    // Desconectar antes de destruir MindAR: si el observer dispara después
    // del dispose, llamaría resize() sobre un renderer ya liberado
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = null

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

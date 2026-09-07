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
 * @param {number} targetCount - Cuántos tatuajes contiene el .mind
 * @returns {{ mindarRef, anchorRef, rendererRef, sceneRef, cameraRef, start, stop }}
 */
export function useMindAR(mindUrl, containerRef, targetCount = 1) {
  const mindarRef = useRef(null)
  const anchorsRef = useRef([])
  const isRunning = useRef(false)
  // Observa el tamaño del contenedor para re-sincronizar el layout de MindAR
  const resizeObserverRef = useRef(null)
  // true si hubo que corregir el tamaño del video — lo muestra el overlay de debug
  const videoFallbackRef = useRef(false)

  const start = useCallback(async () => {
    if (!containerRef.current || !mindUrl || isRunning.current) return

    const mindar = new MindARThree({
      container: containerRef.current,
      imageTargetSrc: mindUrl,
      /*
        Cuántos tatuajes se pueden rastrear AL MISMO TIEMPO.

        No es lo mismo que cuántos contiene el archivo: MindAR solo busca nuevos
        targets mientras rastrea menos de maxTrack. Con maxTrack:1 y dos tatuajes
        en cámara, el segundo no aparecería hasta perder el primero.

        Se limita a 2 porque cada target rastreado cuesta trabajo por frame, y en
        gama media eso se nota en los fps. Dos permite el momento de "mis dos
        tatuajes vivos a la vez" sin arriesgar la fluidez.
      */
      maxTrack: Math.min(targetCount, 2),
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

    /*
      Un ancla por tatuaje. El índice corresponde a la posición dentro del .mind,
      que es el mismo orden en que se fusionaron al compilar — por eso el orden
      de los targets debe conservarse en la base de datos.
    */
    const anchors = Array.from({ length: targetCount }, (_, i) => mindar.addAnchor(i))
    anchorsRef.current = anchors

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
    /*
      Red de seguridad: verificar que el video realmente quedó cubriendo el contenedor.

      MindAR NO le aplica CSS de tamaño al video cuando lo crea (three.js:97-100
      solo pone position/top/left/z-index). El tamaño se lo da exclusivamente
      resize(). Si esa función corre con dimensiones inválidas —contenedor con
      clientWidth 0 porque aún no se hizo el layout, o videoWidth 0 porque el
      stream no entregó frame— sus cálculos producen NaN, el navegador descarta
      esos estilos, y el video se queda a su tamaño intrínseco: más chico que la
      pantalla, con franjas negras alrededor.

      No se imponen estilos por adelantado (eso fue el error anterior: competía
      con resize() y el resultado dependía del timing). Se MIDE el resultado y
      solo se corrige si de verdad quedó mal. Si MindAR hizo bien su trabajo,
      esta función no toca nada.
    */
    const ensureVideoCoversContainer = () => {
      const container = containerRef.current
      const video = container?.querySelector('video')
      if (!container || !video) return

      const cw = container.clientWidth
      const ch = container.clientHeight
      if (cw === 0 || ch === 0) return // aún sin layout; el observer volverá a llamar

      const rect = video.getBoundingClientRect()
      // Tolerancia de 2px por redondeo sub-pixel
      const cubre = rect.width >= cw - 2 && rect.height >= ch - 2
      if (cubre) {
        videoFallbackRef.current = false
        return
      }

      // object-fit: cover recorta preservando el aspect ratio, igual que el
      // resultado que busca MindAR con su cálculo de vw/vh
      video.style.width = '100%'
      video.style.height = '100%'
      video.style.left = '0px'
      video.style.top = '0px'
      video.style.objectFit = 'cover'
      videoFallbackRef.current = true
      console.warn(
        `[MindAR] video ${Math.round(rect.width)}x${Math.round(rect.height)} no cubría ` +
        `el contenedor ${cw}x${ch} — aplicado cover de respaldo`
      )
    }

    const scheduleResize = () => {
      // Doble RAF: el primero espera al siguiente frame, el segundo garantiza que
      // el layout ya se aplicó antes de que MindAR lea clientWidth/clientHeight
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          mindarRef.current?.resize?.()
          // Un frame más para que el navegador aplique lo que puso resize()
          // antes de medirlo
          requestAnimationFrame(ensureVideoCoversContainer)
        })
      })
    }
    scheduleResize()

    /*
      El stream puede cambiar de resolución después del primer frame (algunas
      cámaras arrancan en baja y suben). Cuando pasa, hay que recalcular:
      resize() usa videoWidth/videoHeight para el cálculo de cover.
    */
    const videoEl = containerRef.current?.querySelector('video')
    videoEl?.addEventListener('resize', scheduleResize)
    videoEl?.addEventListener('loadedmetadata', scheduleResize)

    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserverRef.current = new ResizeObserver(scheduleResize)
      resizeObserverRef.current.observe(containerRef.current)
    }

    return { anchors, mindar }
  }, [mindUrl, containerRef, targetCount])

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
    anchorsRef.current = []
  }, [])

  // Cleanup automático al desmontar — previene cámara activa en background
  useEffect(() => {
    return () => stop()
  }, [stop])

  return {
    mindarRef,
    anchorsRef,
    start,
    stop,
    // Exponer scene/camera/renderer de MindAR para que useThreeScene los use
    getScene: () => mindarRef.current?.scene ?? null,
    getCamera: () => mindarRef.current?.camera ?? null,
    getRenderer: () => mindarRef.current?.renderer ?? null,
    didApplyVideoFallback: () => videoFallbackRef.current,
  }
}

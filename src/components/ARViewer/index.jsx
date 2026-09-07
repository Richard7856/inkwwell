import { useRef, useState, useEffect, useCallback } from 'react'
import { useMindAR } from './useMindAR.js'
import { useThreeScene } from './useThreeScene.js'
import { loadTarget } from './targetLoader.js'

/**
 * ARViewer — componente principal de la experiencia AR.
 * Integra MindAR (image tracking) + Three.js (rendering GLB).
 *
 * Ciclo: mount → loadTarget → start MindAR → load GLB → anchor al target
 *
 * ── Por qué isolation: isolate en el containerRef ──
 * MindAR posiciona el <video> (cámara) con z-index: -2 y el <canvas> (Three.js)
 * sin z-index explícito. Para que el video sea visible DETRÁS del canvas (y no
 * detrás del body negro del documento), el container necesita crear su propio
 * stacking context. isolation: isolate hace exactamente eso sin afectar el layout.
 * Sin esto, z-index:-2 saca el video FUERA del container → fondo negro.
 */
/** Extrae solo el host de una URL, para mostrarla compacta en diagnóstico */
function hostOf(url) {
  try {
    return new URL(url).host
  } catch {
    return '(sin configurar)'
  }
}

export default function ARViewer({ tattooId = null, demo = null }) {
  const containerRef = useRef(null)
  const [status, setStatus] = useState('loading')
  const [errorMsg, setErrorMsg] = useState('')
  // Qué tatuaje se está rastreando ahora mismo. Sus animaciones son las que
  // se muestran en los botones — con varios tatuajes, cada uno tiene las suyas.
  const [activeTarget, setActiveTarget] = useState(null)
  const [animations, setAnimations] = useState([])
  const [activeAnim, setActiveAnim] = useState('')
  const [urls, setUrls] = useState(null)
  // Diagnóstico de layout — con ?debug=1 en la URL o con triple-tap sobre la vista
  const [debugOn, setDebugOn] = useState(
    () => new URLSearchParams(window.location.search).has('debug')
  )
  const [layoutInfo, setLayoutInfo] = useState(null)
  const tapTimesRef = useRef([])

  const mindAR = useMindAR(urls?.mindUrl, containerRef, urls?.targets?.length ?? 1)
  const threeScene = useThreeScene()

  // Paso 1: resolver URLs del tatuaje desde Supabase o hardcoded (demo)
  useEffect(() => {
    let cancelled = false
    loadTarget({ tattooId, demo })
      .then((resolved) => { if (!cancelled) setUrls(resolved) })
      .catch((err) => {
        if (!cancelled) {
          setStatus('error')
          setErrorMsg(err.message)
        }
      })
    return () => { cancelled = true }
  }, [tattooId, demo])

  // Paso 2: iniciar MindAR y cargar GLB cuando las URLs estén listas
  useEffect(() => {
    if (!urls || !containerRef.current) return

    let cancelled = false

    async function init() {
      try {
        setStatus('loading')
        const { anchors, mindar } = await mindAR.start()

        if (cancelled) { mindAR.stop(); return }

        /*
          Un handler por tatuaje. Al encontrar uno, se vuelve el target activo y
          los botones pasan a mostrar SUS animaciones.

          Al perderlo solo se limpia si sigue siendo el activo: con dos tatuajes
          en cámara, perder el primero no debe borrar los controles del segundo
          que aún se está rastreando.
        */
        anchors.forEach((anchor, i) => {
          anchor.onTargetFound = () => {
            setStatus('tracking')
            setActiveTarget(i)
            const names = threeScene.getAnimationNames(i)
            setAnimations(names)
            setActiveAnim(names[0] ?? '')
          }
          anchor.onTargetLost = () => {
            setStatus('scanning')
            setActiveTarget((actual) => (actual === i ? null : actual))
          }
        })

        // Pasamos renderer/scene/camera — MindAR NO renderiza internamente,
        // useThreeScene corre el loop RAF con renderer.render() por frame
        await threeScene.loadModels(
          anchors.map((a) => a.group),
          urls.targets,
          mindar.renderer,
          mindar.scene,
          mindar.camera
        )

        if (cancelled) { threeScene.cleanup(); mindAR.stop(); return }

        setStatus('scanning')
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setErrorMsg(err.message || 'Error iniciando cámara AR')
        }
      }
    }

    init()

    return () => {
      cancelled = true
      threeScene.cleanup()
      mindAR.stop()
    }
  }, [urls]) // eslint-disable-line react-hooks/exhaustive-deps

  /*
    Muestreo de dimensiones reales para diagnosticar problemas de layout.

    Por qué existe: los bugs de encuadre en AR (video corrido, franjas negras)
    dependen de valores que solo se pueden observar EN EL DISPOSITIVO —
    clientWidth del contenedor, resolución real del stream, y qué estilos acabó
    aplicando MindAR. Sin esto, cada hipótesis cuesta un ciclo completo de
    rebuild + reinstalar el APK.

    Se activa solo con ?debug=1 para que no cargue nada en el uso normal.
  */
  useEffect(() => {
    if (!debugOn) {
      setLayoutInfo(null)
      return
    }

    const sample = () => {
      const c = containerRef.current
      if (!c) return
      const v = c.querySelector('video')
      const cv = c.querySelector('canvas')
      const cs = (el) => (el ? getComputedStyle(el) : null)
      const vs = cs(v)
      const cvs = cs(cv)
      const cRect = c.getBoundingClientRect()
      const vRect = v?.getBoundingClientRect()
      setLayoutInfo({
        build: __BUILD_ID__,
        // Host (no la URL completa) para confirmar contra qué backend corre
        // este APK sin llenar la pantalla ni exponer la key
        worker: hostOf(import.meta.env.VITE_COMPILER_URL),
        db: hostOf(import.meta.env.VITE_SUPABASE_URL),
        screen: `${window.innerWidth}x${window.innerHeight} dpr${window.devicePixelRatio}`,
        // clientWidth vs rect: si difieren, algo escala o transforma el contenedor
        container: `${c.clientWidth}x${c.clientHeight} rect ${Math.round(cRect.width)}x${Math.round(cRect.height)}`,
        // Lo que el video ocupa REALMENTE en pantalla — el dato decisivo
        videoReal: vRect ? `${Math.round(vRect.width)}x${Math.round(vRect.height)} @ ${Math.round(vRect.left)},${Math.round(vRect.top)}` : '—',
        videoAttr: v ? `${v.getAttribute('width')}x${v.getAttribute('height')}` : '—',
        stream: v ? `${v.videoWidth}x${v.videoHeight}` : 'sin video',
        videoCss: vs ? `${vs.width} x ${vs.height} @ ${vs.left},${vs.top}` : '—',
        videoFit: vs ? vs.objectFit : '—',
        fallback: mindAR.didApplyVideoFallback?.() ? 'SÍ (video no cubría)' : 'no',
        canvasCss: cvs ? `${cvs.width} x ${cvs.height} @ ${cvs.left},${cvs.top}` : '—',
      })
    }

    sample()
    const id = setInterval(sample, 1000)
    return () => clearInterval(id)
  }, [urls, debugOn])

  /*
    Triple-tap para activar el diagnóstico.

    Por qué no basta con ?debug=1: dentro del APK no hay barra de direcciones,
    así que no hay forma de agregar el parámetro a mano. El triple-tap funciona
    desde cualquier punto de entrada (link compartido, flujo de activación) y es
    invisible para quien vea el demo.
  */
  const handleTripleTap = useCallback(() => {
    const now = Date.now()
    // Conservar solo los taps de los últimos 800ms
    const recent = [...tapTimesRef.current, now].filter((tm) => now - tm < 800)
    tapTimesRef.current = recent
    if (recent.length >= 3) {
      tapTimesRef.current = []
      setDebugOn((v) => !v)
    }
  }, [])

  const handleAnimationChange = useCallback((name) => {
    if (activeTarget === null) return
    threeScene.playAnimation(activeTarget, name)
    setActiveAnim(name)
  }, [threeScene, activeTarget])

  return (
    <div className="relative w-full h-full" onPointerDown={handleTripleTap}>

      {/*
        isolation: isolate crea un stacking context propio para el container.
        Esto es crítico: el <video> de MindAR tiene z-index:-2 y el <canvas> no tiene
        z-index explícito. Sin isolation, el video escapa al stacking context del
        documento y queda DETRÁS del body negro → cámara negra.
        Con isolation, z-index:-2 es relativo al container → video visible detrás del canvas.

        overflow: hidden contiene los elementos absolutos de MindAR.
        position: relative asegura que los hijos absolutos se anclen aquí.
      */}
      <div
        ref={containerRef}
        className="ar-stage w-full h-full"
        style={{ position: 'relative', overflow: 'hidden', isolation: 'isolate' }}
      />

      {/* Overlay de diagnóstico (?debug=1) — pointer-events-none para no
          bloquear la interacción con los botones de animación */}
      {layoutInfo && (
        <div className="absolute top-0 left-0 right-0 z-30 p-2 pointer-events-none">
          <div className="bg-black/85 text-green-300 text-[10px] leading-tight font-mono p-2 rounded">
            {Object.entries(layoutInfo).map(([k, v]) => (
              <div key={k}>
                <span className="text-green-600">{k}:</span> {v}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 z-20">
          <div className="text-center max-w-sm">
            <p className="text-red-400 text-lg font-medium mb-2">No se pudo iniciar AR</p>
            <p className="text-gray-400 text-sm">{errorMsg}</p>
            <p className="text-gray-500 text-xs mt-4">
              Verifica que diste permiso de cámara y estás en HTTPS
            </p>
          </div>
        </div>
      )}

      {/* Botones de animación — z-20 para estar encima del canvas de MindAR.
          bottom con safe-area-inset-bottom para no quedar tapados por la barra de Android/iOS.

          Por qué NO usamos backdrop-blur ni bg-black/40 (transparencia):
          backdrop-filter:blur() tiene soporte inconsistente en Chrome Android (falla silenciosamente).
          Los colores RGBA semitransparentes también pueden no renderizar en algunos WebGL contexts.
          Usamos bg-gray-900 (opaco sólido) y bg-white — funcionan en 100% de browsers.

          Por qué length > 1 y no > 0:
          Con una sola animación no hay nada que elegir — clic en el único botón
          solo reinicia la misma animación que ya está corriendo en auto-play.
          Ocultar el botón limpia la UI sin perder funcionalidad.

          Por qué flex-wrap:
          Modelos como el Fénix y el Shiba tienen 5 animaciones. En una sola fila
          no caben en 390px — se encimarían o desbordarían fuera de pantalla.
          Con wrap se acomodan en dos filas. */}
      {activeTarget !== null && animations.length > 1 && (
        <div
          className="absolute left-0 right-0 flex flex-wrap justify-center gap-2 px-4 z-20"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
        >
          {animations.map((name) => (
            <button
              key={name}
              onClick={() => handleAnimationChange(name)}
              className={`
                px-4 py-2 rounded-full text-sm font-semibold
                border transition-all duration-200 shadow-lg
                ${activeAnim === name
                  ? 'bg-white text-black border-white scale-105'
                  : 'bg-gray-900 text-white border-gray-600'
                }
              `}
            >
              {ANIMATION_LABEL[name] ?? name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Mapeo de nombres de animación del GLB → label visible para el usuario.
 *
 * Por qué este mapeo existe:
 * Los nombres de animación en el GLB los define quien modela (Blender, Maya, etc.)
 * y pueden ser técnicos, en inglés, o simplemente nombres de clip. El usuario
 * ve los botones — necesita texto que le diga qué hace cada animación.
 *
 * Si un nombre no está aquí, se muestra el nombre técnico del clip como fallback.
 * Agregar entradas cuando se sumen nuevos modelos al catálogo.
 */
const ANIMATION_LABEL = {
  // Alaskan Malamute
  'Jim canter':    '🐕 Trotando',
  'Ethan scratch': '🐾 Rascándose',

  // Fénix
  'Parado':   '🦅 Parado',
  'Ataque':   '⚔️ Ataque',
  'Ataque2':  '🔥 Ataque 2',
  'Atacado':  '💥 Golpe',
  'Atacado2': '💢 Golpe 2',

  // Shiba negro — los nombres traen el prefijo "0|" del exportador original
  '0|standing_0':  '🐕 Parado',
  '0|sitting_0':   '🦴 Sentado',
  '0|shake_0':     '💦 Sacudirse',
  '0|rollover_0':  '🔄 Rodar',
  '0|play_dead_0': '💀 Muerto',
}

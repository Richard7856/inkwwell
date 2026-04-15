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
export default function ARViewer({ tattooId = 'default' }) {
  const containerRef = useRef(null)
  const [status, setStatus] = useState('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [animations, setAnimations] = useState([])
  const [activeAnim, setActiveAnim] = useState('')
  const [urls, setUrls] = useState(null)

  const mindAR = useMindAR(urls?.mindUrl, containerRef)
  const threeScene = useThreeScene(urls?.glbUrl)

  // Paso 1: resolver URLs del tatuaje desde Supabase o hardcoded (demo)
  useEffect(() => {
    let cancelled = false
    loadTarget(tattooId)
      .then((resolved) => { if (!cancelled) setUrls(resolved) })
      .catch((err) => {
        if (!cancelled) {
          setStatus('error')
          setErrorMsg(err.message)
        }
      })
    return () => { cancelled = true }
  }, [tattooId])

  // Paso 2: iniciar MindAR y cargar GLB cuando las URLs estén listas
  useEffect(() => {
    if (!urls || !containerRef.current) return

    let cancelled = false

    async function init() {
      try {
        setStatus('loading')
        const { anchor, mindar } = await mindAR.start()

        if (cancelled) { mindAR.stop(); return }

        anchor.onTargetFound = () => setStatus('tracking')
        anchor.onTargetLost  = () => setStatus('scanning')

        // Pasamos renderer/scene/camera — MindAR NO renderiza internamente,
        // useThreeScene corre el loop RAF con renderer.render() por frame
        await threeScene.loadModel(
          anchor.group,
          mindar.renderer,
          mindar.scene,
          mindar.camera
        )

        if (cancelled) { threeScene.cleanup(); mindAR.stop(); return }

        const animNames = threeScene.getAnimationNames()
        setAnimations(animNames)
        if (animNames.length > 0) setActiveAnim(animNames[0])

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

  const handleAnimationChange = useCallback((name) => {
    threeScene.playAnimation(name)
    setActiveAnim(name)
  }, [threeScene])

  return (
    <div className="relative w-full h-full">

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
        className="w-full h-full"
        style={{ position: 'relative', overflow: 'hidden', isolation: 'isolate' }}
      />

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
          Usamos bg-gray-900 (opaco sólido) y bg-white — funcionan en 100% de browsers. */}
      {animations.length > 0 && (
        <div
          className="absolute left-0 right-0 flex justify-center gap-3 px-4 z-20"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
        >
          {animations.map((name) => (
            <button
              key={name}
              onClick={() => handleAnimationChange(name)}
              className={`
                px-5 py-2.5 rounded-full text-sm font-semibold
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
}

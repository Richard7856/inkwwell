import { useRef, useState, useEffect, useCallback } from 'react'
import { useMindAR } from './useMindAR.js'
import { useThreeScene } from './useThreeScene.js'
import { loadTarget } from './targetLoader.js'

/**
 * ARViewer — componente principal de la experiencia AR.
 * Integra MindAR (image tracking) + Three.js (rendering GLB).
 *
 * Ciclo: mount → loadTarget → start MindAR → load GLB → anchor al target
 * La cámara se limpia al desmontar para evitar leaks en mobile.
 *
 * @param {{ tattooId?: string }} props - ID del tatuaje
 */
export default function ARViewer({ tattooId = 'default' }) {
  const containerRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | scanning | tracking | error
  const [errorMsg, setErrorMsg] = useState('')
  const [animations, setAnimations] = useState([])
  const [activeAnim, setActiveAnim] = useState('')

  // URLs se resuelven vía targetLoader — fuente de verdad de rutas
  const [urls, setUrls] = useState(null)

  const mindAR = useMindAR(urls?.mindUrl, containerRef)
  const threeScene = useThreeScene(urls?.glbUrl)

  // Paso 1: resolver URLs del tatuaje desde Supabase o hardcoded (demo)
  useEffect(() => {
    let cancelled = false

    loadTarget(tattooId)
      .then((resolved) => {
        if (!cancelled) setUrls(resolved)
      })
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

        if (cancelled) {
          mindAR.stop()
          return
        }

        // Callbacks de tracking — cambian el status para UI y analytics futuras
        anchor.onTargetFound = () => setStatus('tracking')
        anchor.onTargetLost = () => setStatus('scanning')

        // loadModel ya no necesita renderer/scene/camera — solo el anchor group
        // MindAR maneja el render loop completo (cámara + escena)
        await threeScene.loadModel(anchor.group, mindar.renderer, mindar.scene, mindar.camera)

        if (cancelled) {
          threeScene.cleanup()
          mindAR.stop()
          return
        }

        // Poblar lista de animaciones para los botones de toggle
        const animNames = threeScene.getAnimationNames()
        setAnimations(animNames)
        if (animNames.length > 0) {
          setActiveAnim(animNames[0])
        }

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
      {/* Contenedor de MindAR — ocupa 100% del viewport */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Estado de error — cámara denegada, .mind no encontrado, etc. */}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
          <div className="text-center max-w-sm">
            <p className="text-red-400 text-lg font-medium mb-2">No se pudo iniciar AR</p>
            <p className="text-gray-400 text-sm">{errorMsg}</p>
            <p className="text-gray-500 text-xs mt-4">
              Verifica que diste permiso de cámara y estás en HTTPS
            </p>
          </div>
        </div>
      )}

      {/* Botones de animación — aparecen cuando el GLB cargó y tiene animaciones.
          Usan safe-area-inset-bottom para no quedar tapados por la barra de Android/iOS.
          El texto viene del GLB pero se muestra con label legible en español. */}
      {animations.length > 0 && (
        <div
          className="absolute left-0 right-0 flex justify-center gap-3 px-4"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
        >
          {animations.map((name) => (
            <button
              key={name}
              onClick={() => handleAnimationChange(name)}
              className={`
                px-5 py-2.5 rounded-full text-sm font-semibold
                backdrop-blur-md border transition-all duration-200
                ${activeAnim === name
                  ? 'bg-white text-black border-white shadow-lg scale-105'
                  : 'bg-black/40 text-white border-white/30 hover:bg-black/60'
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
 * Mapeo de nombres de animación del GLB a labels legibles en español.
 * Los nombres del GLB son técnicos (ej: "Jim canter") — esto los convierte
 * a texto visible para el usuario. Agregar entradas según el catálogo de GLBs.
 */
const ANIMATION_LABEL = {
  'Jim canter':    '🐕 Trotando',
  'Ethan scratch': '🐾 Rascándose',
}

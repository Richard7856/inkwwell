/**
 * Progreso de la activación del tatuaje.
 *
 * Muestra el tatuaje aislado de la piel mientras se compila, con una línea de
 * escaneo recorriéndolo. No es adorno gratuito: le comunica al usuario QUÉ está
 * procesando la app en ese momento, en vez de dejarlo mirando una barra genérica
 * durante decenas de segundos.
 *
 * La capa de tinta viene de inkExtractor y es SOLO presentación — lo que se
 * compila es la foto original con piel, porque es lo que la cámara verá al
 * escanear.
 *
 * El porcentaje es real: viene del callback de MindAR retransmitido por SSE
 * desde el worker (worker/index.js, /compile-stream).
 *
 * @param {'compiling'|'uploading'|'saving'} stage
 * @param {number} progress - 0-100, avance real de compilación
 * @param {number} elapsedSeconds
 * @param {string|null} inkLayer - dataURL PNG de la tinta extraída
 */
export default function CompileStatus({
  stage = 'compiling',
  progress = 0,
  elapsedSeconds = 0,
  inkLayer = null,
}) {
  const STAGES = {
    compiling: {
      title: 'Analizando tu tatuaje',
      detail: 'Extrayendo los puntos que lo hacen único.',
    },
    uploading: {
      title: 'Guardando',
      detail: 'Subiendo el descriptor visual de tu tatuaje.',
    },
    saving: {
      title: 'Activando',
      detail: 'Vinculando tu tatuaje con el diseño 3D.',
    },
  }
  const { title, detail } = STAGES[stage] ?? STAGES.compiling
  const showBar = stage === 'compiling'
  const pct = Math.min(100, Math.max(0, progress))

  return (
    <div className="text-center mt-8 px-6">
      {inkLayer ? (
        <div
          className="relative mx-auto mb-6 rounded-2xl overflow-hidden
                     bg-gradient-to-b from-gray-900 to-black border border-white/10"
          style={{ width: 220, height: 260 }}
        >
          {/* La tinta extraída, invertida a blanco para que resalte sobre el fondo
              oscuro. El filtro evita tener que generar una segunda máscara. */}
          <img
            src={inkLayer}
            alt="Tu tatuaje"
            className="absolute inset-0 w-full h-full object-contain"
            style={{ filter: 'invert(1)' }}
          />

          {/*
            Línea de escaneo. Su posición sigue el progreso REAL de compilación,
            no un bucle decorativo: si el proceso se detiene, la línea se detiene.
            El usuario percibe que está atada a algo real.
          */}
          <div
            className="absolute left-0 right-0 h-16 pointer-events-none transition-all duration-500 ease-out"
            style={{
              top: `${pct}%`,
              transform: 'translateY(-100%)',
              background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.18))',
              borderBottom: '2px solid rgba(255,255,255,0.85)',
            }}
          />

          {/* Zona ya procesada, sutilmente resaltada */}
          <div
            className="absolute left-0 right-0 top-0 pointer-events-none bg-white/5 transition-all duration-500 ease-out"
            style={{ height: `${pct}%` }}
          />
        </div>
      ) : (
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full
                        animate-spin mx-auto mb-6" />
      )}

      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-gray-400 text-sm mb-6">{detail}</p>

      {showBar && (
        <div className="max-w-xs mx-auto">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500 font-mono">
            <span>{Math.round(pct)}%</span>
            <span>{formatElapsed(elapsedSeconds)}</span>
          </div>
        </div>
      )}

      {/* Aviso solo si tarda más de lo normal — evita que el usuario abandone
          creyendo que se trabó */}
      {showBar && elapsedSeconds > 45 && (
        <p className="text-gray-600 text-xs mt-4 max-w-xs mx-auto">
          Está tardando más de lo normal. No cierres la app.
        </p>
      )}
    </div>
  )
}

function formatElapsed(seconds) {
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

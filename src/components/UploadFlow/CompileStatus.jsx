/**
 * Progreso de la activación del tatuaje.
 *
 * El porcentaje de compilación es REAL, no estimado: viene del callback de
 * MindAR retransmitido por SSE desde el worker (ver worker/index.js
 * /compile-stream). En su escala interna, 0-50% es la extracción de features de
 * detección y 50-100% la de seguimiento.
 *
 * Por qué importa mostrarlo: la compilación tarda decenas de segundos. Sin
 * feedback el usuario asume que la app se colgó y sale de la pantalla — que es
 * justo lo que pasaba antes.
 *
 * @param {'compiling'|'uploading'|'saving'} stage - Etapa actual del flujo
 * @param {number} progress - Avance de compilación 0-100
 * @param {number} elapsedSeconds - Segundos transcurridos, para dar referencia
 */
export default function CompileStatus({ stage = 'compiling', progress = 0, elapsedSeconds = 0 }) {
  const STAGES = {
    compiling: {
      title: 'Compilando tu tatuaje',
      detail: 'Analizando los puntos únicos de tu tatuaje para reconocerlo después.',
    },
    uploading: {
      title: 'Guardando tu tatuaje',
      detail: 'Subiendo el descriptor visual.',
    },
    saving: {
      title: 'Activando',
      detail: 'Vinculando tu tatuaje con el diseño 3D.',
    },
  }
  const { title, detail } = STAGES[stage] ?? STAGES.compiling

  // Solo la compilación reporta avance real; las otras etapas son cortas
  const showBar = stage === 'compiling'

  return (
    <div className="text-center mt-12 px-6">
      <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full
                      animate-spin mx-auto mb-6" />

      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-gray-400 text-sm mb-6">{detail}</p>

      {showBar && (
        <div className="max-w-xs mx-auto">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500 font-mono">
            <span>{Math.round(progress)}%</span>
            <span>{formatElapsed(elapsedSeconds)}</span>
          </div>
        </div>
      )}

      {/* Aviso solo si se está tardando más de lo normal — evita que el usuario
          abandone pensando que se trabó */}
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

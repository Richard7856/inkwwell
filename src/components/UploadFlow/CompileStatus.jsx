/**
 * Progreso de la compilación del .mind.
 *
 * Por qué barra con porcentaje y no un spinner:
 * la compilación corre en el dispositivo y tarda decenas de segundos. Un spinner
 * indefinido tanto tiempo se lee como "se colgó" y la gente cierra la app.
 * El compilador de MindAR reporta avance real, así que se muestra.
 *
 * @param {{ progress: number }} props - avance de 0 a 100
 */
export default function CompileStatus({ progress = 0 }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)))

  return (
    <div className="text-center mt-12 max-w-xs mx-auto">
      <h2 className="text-xl font-semibold mb-2">Preparando tu tatuaje...</h2>
      <p className="text-gray-400 text-sm mb-6">
        Estamos aprendiendo a reconocer tu tatuaje desde cualquier ángulo.
        Deja la app abierta.
      </p>

      <div
        className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Progreso de la compilación"
      >
        <div
          className="h-full bg-white rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-gray-500 text-xs mt-3 tabular-nums">{pct}%</p>
    </div>
  )
}

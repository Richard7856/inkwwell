/**
 * Indicador de progreso durante la compilación del .mind.
 * Phase 1: simulado (compilación manual).
 * Phase 2: polling real al worker de compilación.
 */
export default function CompileStatus() {
  return (
    <div className="text-center mt-12">
      {/* Spinner CSS simple — no necesita librería externa */}
      <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full
                      animate-spin mx-auto mb-6" />
      <h2 className="text-xl font-semibold mb-2">Compilando tu tatuaje...</h2>
      <p className="text-gray-400 text-sm">
        Generando el descriptor visual de tu tatuaje. Esto toma unos segundos.
      </p>
    </div>
  )
}

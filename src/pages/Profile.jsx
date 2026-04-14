import { Link } from 'react-router-dom'

/**
 * Perfil del usuario con su tatuaje activo.
 * Phase 1: placeholder estático.
 * Phase 2: datos reales de Supabase + perfil público (inkwell.ar/@username).
 */
export default function Profile() {
  return (
    <div className="min-h-screen px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">Mi perfil</h1>

      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <p className="text-gray-400 text-center">
          Inicia sesión para ver tus tatuajes activados
        </p>
        <p className="text-gray-600 text-xs text-center mt-2">
          Auth disponible en Phase 2
        </p>
      </div>

      <Link
        to="/"
        className="block text-center text-gray-500 mt-8 hover:text-white transition-colors"
      >
        Volver al inicio
      </Link>
    </div>
  )
}

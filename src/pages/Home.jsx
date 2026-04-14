import { Link } from 'react-router-dom'

/**
 * Landing page — primer contacto del usuario.
 * Dos CTAs claros: escanear un tatuaje (Flujo B) o activar el tuyo (Flujo A).
 */
export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight mb-2">
        Inkwell AR
      </h1>
      <p className="text-gray-400 text-lg mb-10 max-w-xs">
        Tu tatuaje cobra vida en realidad aumentada
      </p>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Link
          to="/scan"
          className="bg-white text-black font-semibold py-3 px-6 rounded-full text-center
                     hover:bg-gray-200 transition-colors"
        >
          Escanear tatuaje
        </Link>
        <Link
          to="/activate"
          className="bg-white/10 text-white font-semibold py-3 px-6 rounded-full text-center
                     border border-white/20 hover:bg-white/20 transition-colors"
        >
          Activar mi tatuaje
        </Link>
      </div>

      <p className="text-gray-600 text-xs mt-12">
        Apunta tu cámara a un tatuaje activado y ve la magia
      </p>
    </div>
  )
}

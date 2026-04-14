import { Link } from 'react-router-dom'

/**
 * Landing page — primer contacto del usuario.
 *
 * ¿Por qué "Activar" es el CTA primario?
 * El flujo de escaneo requiere un ?tattoo=uuid específico — no tiene sentido
 * abrir /scan sin ese parámetro (no hay target que detectar).
 * Los usuarios que quieren escanear llegan vía link compartido, no desde Home.
 * Los usuarios que llegan a Home sin link quieren activar su propio tatuaje.
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
        {/* CTA primario — activa tu propio tatuaje */}
        <Link
          to="/activate"
          className="bg-white text-black font-semibold py-3 px-6 rounded-full text-center
                     hover:bg-gray-200 transition-colors"
        >
          Activar mi tatuaje
        </Link>

        {/* CTA secundario — para quien ya tiene un link */}
        <p className="text-gray-500 text-sm">
          ¿Te compartieron un link de tatuaje?{' '}
          <span className="text-gray-300">Ábrelo directo desde tu celular.</span>
        </p>
      </div>

      <p className="text-gray-600 text-xs mt-12 max-w-xs leading-relaxed">
        Activa tu tatuaje una vez. Cualquier persona que apunte su cámara verá tu mundo 3D.
      </p>
    </div>
  )
}

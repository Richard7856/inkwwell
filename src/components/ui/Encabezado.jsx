import { Link } from 'react-router-dom'

/**
 * Cabecera de las pantallas interiores: flecha de regreso + título.
 *
 * ── Por qué regresa a /app y no a / ──
 * En el navegador `/` es la landing de marketing; `/app` es el inicio de la
 * app en los dos entornos. Un usuario que vuelve desde "Créditos" quiere el
 * inicio de la app, no una página que le vende lo que ya tiene instalado.
 *
 * El h1 toma Montserrat de la regla global de index.css: no hace falta
 * repetir la fuente aquí.
 *
 * @param {string} titulo
 * @param {string} [volver='/app']
 * @param {import('react').ReactNode} [accion] - Algo a la derecha (opcional)
 */
export default function Encabezado({ titulo, volver = '/app', accion = null }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <Link
        to={volver}
        aria-label="Volver"
        className="text-gray-500 hover:text-white transition-colors -ml-1 p-1"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </Link>
      <h1 className="text-2xl font-bold flex-1 min-w-0">{titulo}</h1>
      {accion}
    </div>
  )
}

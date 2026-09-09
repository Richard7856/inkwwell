import { Link } from 'react-router-dom'

/**
 * Botón de la app.
 *
 * ── Por qué existe ──
 * Antes cada pantalla declaraba el suyo: `bg-white text-black rounded-full` en
 * ocho archivos, con hover y disabled ligeramente distintos en cada uno. Un
 * cambio de marca obligaba a tocar todos y siempre quedaba uno atrás.
 *
 * ── Por qué el primario es violeta y no blanco ──
 * `realidad` es el acento del tablero de marca. Sobre el fondo oscuro de la
 * app, un botón blanco lee a sistema operativo genérico; el acento lee a
 * InkAR. Los colores semánticos (rojo de error, ámbar de aviso, verde de
 * listo) NO son el acento y no pasan por aquí: viven en `Aviso`.
 *
 * @param {'primario'|'secundario'|'enlace'} [variante]
 * @param {string} [to] - Si se da, renderiza un Link en vez de un button
 * @param {'button'|'submit'} [type] - Solo para button. Por defecto 'button'
 *   para que un botón suelto dentro de un form no lo envíe sin querer.
 */
export default function Boton({ variante = 'primario', to, type = 'button', className = '', children, ...rest }) {
  const forma = variante === 'enlace'
    ? 'text-sm py-2 transition-colors'
    : 'w-full py-3.5 px-6 rounded-full text-center transition-colors active:scale-95 disabled:opacity-40 disabled:active:scale-100'

  const cls = `${forma} ${VARIANTES[variante] ?? VARIANTES.primario} ${className}`

  if (to) {
    return (
      <Link to={to} className={`block ${cls}`} {...rest}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  )
}

const VARIANTES = {
  primario: 'bg-realidad text-white font-semibold hover:bg-realidad/90',
  secundario: 'bg-white/10 text-white font-medium border border-white/15 hover:bg-white/15',
  enlace: 'text-gray-400 underline hover:text-white',
}

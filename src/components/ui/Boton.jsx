import { Link } from 'react-router-dom'

/**
 * Botón de la app.
 *
 * ── Por qué existe ──
 * Antes cada pantalla declaraba el suyo: `bg-white text-black rounded-full` en
 * ocho archivos, con hover y disabled ligeramente distintos en cada uno. Un
 * cambio de marca obligaba a tocar todos y siempre quedaba uno atrás.
 *
 * ── Por qué tinta sobre papel, en mayúsculas espaciadas ──
 * Desde el 16 sep la app sigue la pieza de marca que eligió Richard: papel,
 * tinta negra y el lema en mayúsculas con mucho tracking. El primario es un
 * bloque de tinta; el secundario, solo su contorno. El violeta anterior
 * quedó para el visor AR, que sigue siendo oscuro. Los colores semánticos
 * (rojo de error, ámbar de aviso, verde de listo) no pasan por aquí.
 *
 * @param {'primario'|'secundario'|'peligro'|'enlace'} [variante]
 * @param {string} [to] - Si se da, renderiza un Link en vez de un button
 * @param {'button'|'submit'} [type] - Solo para button. Por defecto 'button'
 *   para que un botón suelto dentro de un form no lo envíe sin querer.
 */
export default function Boton({ variante = 'primario', to, type = 'button', className = '', children, ...rest }) {
  const forma = variante === 'enlace'
    ? 'text-sm py-2 transition-colors'
    : 'w-full py-3.5 px-6 rounded-md text-center text-[13px] uppercase tracking-[0.16em] transition-colors active:scale-[0.97] disabled:opacity-35 disabled:active:scale-100'

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
  primario: 'bg-tinta text-claridad font-semibold hover:bg-tinta/85',
  secundario: 'bg-transparent text-tinta font-semibold border border-tinta hover:bg-tinta/5',
  // El borrado NO lleva el acento: rojo es semántico, y el acento es identidad.
  // Confundirlos haría que lo destructivo se sintiera como lo principal.
  peligro: 'bg-red-600 text-white font-semibold hover:bg-red-500',
  enlace: 'text-gray-600 underline underline-offset-4 hover:text-tinta',
}

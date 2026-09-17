/**
 * Superficie contenedora: la tarjeta que antes se escribía a mano como
 * `bg-white/5 border border-white/10 rounded-2xl p-5` en cada pantalla.
 *
 * ── Cuándo va destacada ──
 * Solo la UNA cosa de la pantalla que pide atención: el primer crédito a mitad
 * de precio, el recuerdo frente al catálogo. Si dos tarjetas van destacadas,
 * ninguna lo está — por eso no se usa como decoración.
 *
 * @param {boolean} [destacada]
 * @param {'div'|'button'} [as] - 'button' para tarjetas que se eligen (catálogo)
 * @param {boolean} [compacta] - p-3 en vez de p-5: filas de miniatura, no bloques
 */
export default function Tarjeta({ destacada = false, as = 'div', compacta = false, className = '', children, ...rest }) {
  // Destacada = contorno de tinta completo; normal = línea fina. Sin color:
  // en el papel, el peso del trazo es lo que jerarquiza.
  const tono = destacada
    ? 'bg-white border-tinta shadow-[4px_4px_0_0_rgba(0,0,0,0.9)]'
    : 'bg-white border-tinta/10'

  const interactiva = as === 'button'
    ? 'text-left w-full hover:border-tinta/40 transition-colors active:scale-[0.98]'
    : ''

  const Etiqueta = as
  return (
    <Etiqueta
      type={as === 'button' ? 'button' : undefined}
      className={`rounded-lg border ${compacta ? 'p-3' : 'p-5'} ${tono} ${interactiva} ${className}`}
      {...rest}
    >
      {children}
    </Etiqueta>
  )
}

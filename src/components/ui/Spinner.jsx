/**
 * Indicador de espera: un arco de tinta sobre un anillo apenas visible. Para
 * esperas largas (generar un video) va `PantallaCarga`, no esto.
 *
 * @param {'sm'|'md'|'lg'} [tam]
 */
export default function Spinner({ tam = 'md', className = '' }) {
  const tamano = { sm: 'w-5 h-5 border-2', md: 'w-8 h-8 border-4', lg: 'w-12 h-12 border-4' }[tam]
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={`${tamano} border-tinta/10 border-t-tinta rounded-full animate-spin ${className}`}
    />
  )
}

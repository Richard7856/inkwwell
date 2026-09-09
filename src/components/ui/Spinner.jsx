/**
 * Indicador de espera. El borde que gira lleva el acento: es lo único que se
 * mueve en la pantalla y por eso es donde la marca se nota sin estorbar.
 *
 * @param {'sm'|'md'|'lg'} [tam]
 */
export default function Spinner({ tam = 'md', className = '' }) {
  const tamano = { sm: 'w-5 h-5 border-2', md: 'w-8 h-8 border-4', lg: 'w-12 h-12 border-4' }[tam]
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={`${tamano} border-white/15 border-t-realidad rounded-full animate-spin ${className}`}
    />
  )
}

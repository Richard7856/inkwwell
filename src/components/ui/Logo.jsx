/**
 * Logotipo InkAR.
 *
 * Los dos archivos miden 1400×467 (3:1): se fija la altura y el ancho sale
 * solo. El blanco es para la app (fondo oscuro); el negro para la landing y
 * el material impreso.
 *
 * Es el logotipo ORIGINAL aprobado (brand/logo.png), no una composición
 * tipográfica: por eso no se dibuja con texto ni con la clase `.marca`, que
 * queda para el nombre cuando va escrito dentro de un párrafo.
 *
 * @param {number} [alto=40] - Altura en px
 * @param {boolean} [claro=false] - true para fondos claros
 */
export default function Logo({ alto = 40, claro = false, className = '' }) {
  return (
    <img
      src={claro ? '/logo-inkar.png' : '/logo-inkar-blanco.png'}
      alt="InkAR"
      style={{ height: alto, width: 'auto' }}
      className={`select-none ${className}`}
      draggable={false}
    />
  )
}

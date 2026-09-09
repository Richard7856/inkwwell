/**
 * Trazo de tinta decorativo.
 *
 * Se dibuja como MÁSCARA CSS y no como <img>: los archivos guardan solo el
 * canal alfa —la tinta es negra en todos lados, el color no aporta nada— así
 * que pesan una cuarta parte, y el color sale de `background-color`. El mismo
 * archivo sirve sobre fondo claro y sobre oscuro sin duplicar assets: en la
 * landing (papel) va `bg-tinta`; en la app (fondo oscuro) va `bg-white`, que
 * es la tinta invertida — el mismo gesto, el mismo trazo.
 *
 * Van a baja opacidad porque viven DETRÁS del texto: a plena intensidad
 * compiten con lo que hay que leer, y la página deja de leerse.
 *
 * Antes vivía dentro de Landing.jsx; se movió aquí al usarse también en la app.
 *
 * @param {string} src - Ruta del PNG de alfa en /tinta/
 * @param {string} [color='bg-tinta'] - Clase de color de fondo
 */
export default function Tinta({ src, color = 'bg-tinta', className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none absolute ${color} ${className}`}
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
      }}
    />
  )
}

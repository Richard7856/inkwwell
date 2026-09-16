/**
 * Arma el primer (y opcionalmente el último) cuadro de un video que NACE del
 * tatuaje.
 *
 * Uso:
 *   node componer-inicio.js <foto-compilada.jpg> <salida-inicio.png> \
 *        [<cuadro-final-de-otro-video.png> <salida-final.png>]
 *
 * ── Por qué este lienzo ──
 * El generador (Hailuo-02) hereda la proporción de la imagen de entrada, y el
 * video se dibuja en AR sobre un plano anclado al tatuaje. Si la foto ocupa
 * TODO el ancho del lienzo y va centrada, basta con `escala: 1` para que el
 * dibujo del cuadro 0 quede encima del tatuaje real, sin más ajustes.
 *
 * El lienzo es 9:16 (768x1364) y no la proporción de la foto porque así el
 * cuadro final puede ser, tal cual, el primer cuadro de otro video del mismo
 * tamaño: los dos videos quedan encadenados en la misma posición.
 *
 * Edge cases: la foto DEBE ser la misma que se compiló en el .mind (otra toma
 * del mismo tatuaje no calza). Si la foto es más vertical que 9:16, se sale
 * del lienzo por arriba y abajo: se avisa y no se genera.
 */
import { loadImage, createCanvas } from 'canvas'
import { writeFileSync } from 'fs'
import { calcularMascaraTinta, limpiarMascara } from './mascara-tinta.js'

const ANCHO = 768
const ALTO = 1364
/*
  Verde medido en las piezas que devuelve el generador ([95,196,77] en el
  primer cuadro). Se usa ese y no #00FF00 para que el generador no "corrija" el
  fondo a mitad del video y el recorte tenga que perseguir dos verdes.
*/
const VERDE = [95, 196, 77]
// Tinta casi negra, con un matiz frío como el de un tatuaje sanado
const TINTA = [28, 30, 36]

const [fotoRuta, salidaInicio, finalRuta, salidaFinal] = process.argv.slice(2)
if (!fotoRuta || !salidaInicio) {
  console.error('Uso: node componer-inicio.js <foto.jpg> <inicio.png> [<final-origen.png> <final.png>]')
  process.exit(1)
}

const foto = await loadImage(fotoRuta)
const altoFoto = Math.round(foto.height * (ANCHO / foto.width))
if (altoFoto > ALTO) {
  console.error(`La foto (${foto.width}x${foto.height}) es más vertical que 9:16; no cabe en el lienzo sin recortar el tatuaje.`)
  process.exit(1)
}
const y0 = Math.round((ALTO - altoFoto) / 2)

// Foto escalada al ancho del lienzo, en gris, para la máscara
const c = createCanvas(ANCHO, altoFoto)
const ctx = c.getContext('2d')
ctx.drawImage(foto, 0, 0, ANCHO, altoFoto)
const rgba = ctx.getImageData(0, 0, ANCHO, altoFoto).data
const gris = new Uint8Array(ANCHO * altoFoto)
for (let i = 0; i < gris.length; i++) {
  gris[i] = Math.round(rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114)
}
const mascara = limpiarMascara(calcularMascaraTinta(gris, ANCHO, altoFoto), ANCHO, altoFoto)

const lienzo = createCanvas(ANCHO, ALTO)
const lctx = lienzo.getContext('2d')
const img = lctx.createImageData(ANCHO, ALTO)
for (let y = 0; y < ALTO; y++) {
  for (let x = 0; x < ANCHO; x++) {
    const o = (y * ANCHO + x) * 4
    const fy = y - y0
    // Umbral suave: sin él quedan puntos sueltos de poros que el generador
    // interpreta como textura y "anima" como ruido
    const m = fy >= 0 && fy < altoFoto ? suave(0.22, 0.55, mascara[fy * ANCHO + x]) : 0
    for (let k = 0; k < 3; k++) img.data[o + k] = Math.round(VERDE[k] + (TINTA[k] - VERDE[k]) * m)
    img.data[o + 3] = 255
  }
}
lctx.putImageData(img, 0, 0)
writeFileSync(salidaInicio, lienzo.toBuffer('image/png'))
console.log(`inicio → ${salidaInicio} (foto en y=${y0}..${y0 + altoFoto})`)

if (finalRuta && salidaFinal) {
  const fin = await loadImage(finalRuta)
  if (fin.width !== ANCHO || fin.height !== ALTO) {
    console.error(`El cuadro final mide ${fin.width}x${fin.height}; debe ser ${ANCHO}x${ALTO} para encadenar sin reposicionar.`)
    process.exit(1)
  }
  const f = createCanvas(ANCHO, ALTO)
  f.getContext('2d').drawImage(fin, 0, 0)
  writeFileSync(salidaFinal, f.toBuffer('image/png'))
  console.log(`final  → ${salidaFinal}`)
}

function suave(a, b, v) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Arma el primer (y opcionalmente el último) cuadro de un video que NACE del
 * tatuaje.
 *
 * Uso:
 *   node componer-inicio.js [--modo=gota|trazo] <foto-compilada.jpg> <salida-inicio.png> \
 *        [<cuadro-final-de-otro-video.png> <salida-final.png>]
 *
 * ── Modos ──
 * - `gota` (por defecto): solo una gota de tinta sobre el centro de la zona
 *   más oscura del tatuaje. El video la hace brotar y de ahí sale el sujeto.
 * - `trazo`: el dibujo completo del tatuaje. Se ve espectacular quieto, pero
 *   con el brazo en movimiento el rastreo se desfasa unos milímetros y las
 *   líneas aparecen DOBLES — se lee como error (probado el 16 sep). Una gota
 *   sobre un relleno oscuro tolera ese desfase sin que se note.
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

const argumentos = process.argv.slice(2)
const modo = (argumentos.find((a) => a.startsWith('--modo='))?.split('=')[1]) ?? 'gota'
const [fotoRuta, salidaInicio, finalRuta, salidaFinal] = argumentos.filter((a) => !a.startsWith('--'))
if (!['gota', 'trazo'].includes(modo)) {
  console.error(`Modo desconocido: ${modo}. Usa gota o trazo.`)
  process.exit(1)
}
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

if (modo === 'trazo') {
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
} else {
  const { cx, cy, radio } = centroDeTinta(mascara, ANCHO, altoFoto)
  lctx.fillStyle = `rgb(${VERDE.join(',')})`
  lctx.fillRect(0, 0, ANCHO, ALTO)
  dibujarGota(lctx, cx, cy + y0, radio)
  console.log(`gota en (${Math.round(cx)}, ${Math.round(cy + y0)}), radio ${Math.round(radio)}`)
}
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

/**
 * Dónde poner la gota: en el corazón de la forma de tinta más grande.
 *
 * Ahí debajo hay relleno oscuro por todos lados, así que la gota tolera el
 * desfase del rastreo en cualquier dirección. Dos intentos previos fallaron:
 * buscar la zona más densa cayó en la orilla entre dos almohadillas (los
 * contornos pesan más que el punteado), y ponderar por el centro del diseño
 * cayó en el hueco de piel entre ellas.
 *
 * Método: se cierra el punteado (dilatar y luego erosionar) para que cada
 * almohadilla sea una forma sólida, se toma la mayor, y dentro de ella el
 * punto más alejado de su borde (transformada de distancia).
 *
 * Edge case: un diseño sin formas rellenas (solo líneas) da una forma
 * delgada; el radio se limita por esa distancia para no desbordarla.
 */
function centroDeTinta(mascara, ancho, alto) {
  const paso = Math.max(2, Math.round(ancho / 192))
  const gw = Math.ceil(ancho / paso)
  const gh = Math.ceil(alto / paso)
  let lleno = new Uint8Array(gw * gh)
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      lleno[y * gw + x] = mascara[Math.min(alto - 1, y * paso) * ancho + Math.min(ancho - 1, x * paso)] > 0.15 ? 1 : 0
    }
  }
  // Cierre morfológico: el punteado de un relleno queda como una sola forma
  const R = 3
  lleno = morfologia(morfologia(lleno, gw, gh, R, true), gw, gh, R, false)

  // Forma más grande
  const etiqueta = new Int32Array(gw * gh).fill(-1)
  let mayorId = -1, mayorArea = 0
  for (let i = 0, id = 0; i < lleno.length; i++) {
    if (!lleno[i] || etiqueta[i] >= 0) continue
    let area = 0
    const pila = [i]
    etiqueta[i] = id
    while (pila.length) {
      const j = pila.pop()
      area++
      const x = j % gw, y = (j - x) / gw
      for (const [xx, yy] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue
        const k = yy * gw + xx
        if (lleno[k] && etiqueta[k] < 0) { etiqueta[k] = id; pila.push(k) }
      }
    }
    if (area > mayorArea) { mayorArea = area; mayorId = id }
    id++
  }
  if (mayorId < 0) return { cx: ancho / 2, cy: alto / 2, radio: ancho / 24 }

  // Transformada de distancia (chamfer 3-4) dentro de esa forma
  const INF = 1e9
  const d = new Float32Array(gw * gh)
  for (let i = 0; i < d.length; i++) d[i] = etiqueta[i] === mayorId ? INF : 0
  const pasada = (orden) => {
    for (const y of orden(gh)) {
      for (const x of orden(gw)) {
        const i = y * gw + x
        if (!d[i]) continue
        for (const [dx, dy, c] of [[-1, 0, 3], [1, 0, 3], [0, -1, 3], [0, 1, 3], [-1, -1, 4], [1, -1, 4], [-1, 1, 4], [1, 1, 4]]) {
          const xx = x + dx, yy = y + dy
          const v = xx < 0 || yy < 0 || xx >= gw || yy >= gh ? 0 : d[yy * gw + xx]
          if (v + c < d[i]) d[i] = v + c
        }
      }
    }
  }
  const adelante = (n) => Array.from({ length: n }, (_, k) => k)
  pasada(adelante)
  pasada((n) => adelante(n).reverse())

  let mejor = 0, mi = 0
  for (let i = 0; i < d.length; i++) if (d[i] > mejor) { mejor = d[i]; mi = i }
  const distPx = (mejor / 3) * paso
  return {
    cx: (mi % gw) * paso,
    cy: Math.floor(mi / gw) * paso,
    // Bien dentro de la forma: la mitad de lo que cabe, y nunca más de 1/20
    // del ancho (una gota enorme ya no se lee como gota)
    radio: Math.min(distPx * 0.5, ancho / 20),
  }
}

/** Dilatación (true) o erosión (false) con un cuadrado de radio r. */
function morfologia(m, w, h, r, dilatar) {
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = dilatar ? 0 : 1
      for (let dy = -r; dy <= r && v === (dilatar ? 0 : 1); dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx, yy = y + dy
          const s = xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : m[yy * w + xx]
          if (dilatar && s) { v = 1; break }
          if (!dilatar && !s) { v = 0; break }
        }
      }
      out[y * w + x] = v
    }
  }
  return out
}

/** Gota orgánica: un círculo con bordes irregulares y un par de salpicaduras. */
function dibujarGota(ctx, cx, cy, r) {
  ctx.fillStyle = `rgb(${TINTA.join(',')})`
  ctx.beginPath()
  const lobulos = 9
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2
    // Irregularidad determinista: la misma foto da siempre la misma gota
    const k = 1 + 0.12 * Math.sin(a * lobulos) + 0.07 * Math.sin(a * 4 + 1.3)
    const x = cx + Math.cos(a) * r * k
    const y = cy + Math.sin(a) * r * k
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.fill()
  for (const [dx, dy, s] of [[1.5, -0.6, 0.18], [-1.3, 0.9, 0.13], [0.4, 1.6, 0.1]]) {
    ctx.beginPath()
    ctx.arc(cx + dx * r, cy + dy * r, r * s, 0, Math.PI * 2)
    ctx.fill()
  }
}

function suave(a, b, v) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

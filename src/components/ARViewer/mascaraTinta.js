/**
 * Separa la tinta de la piel en la imagen que MindAR guarda de cada tatuaje.
 *
 * Es la pieza que permite que el contenido salga DEL tatuaje y no solo
 * encima: con esta máscara la GPU sabe qué píxeles son trazo, y de ahí se
 * iluminan las líneas y nacen las partículas.
 *
 * Módulo puro, sin Three ni DOM, para poder calibrarlo en Node contra los
 * `.mind` reales antes de verlo en el teléfono.
 */

/*
  Dos escalas de "cómo se ve la piel alrededor", en px de la imagen de rastreo
  (256 de ancho, donde un trazo mide 2-6 px):

  - FINA (6 px): el entorno inmediato de una línea. Capta trazos finos y
    puntillismo, pero dentro de un relleno sólido el entorno también es tinta
    y lo pierde.
  - AMPLIA (36 px): la iluminación de la zona. Capta los rellenos sólidos, y
    como las sombras de la piel son suaves, se desenfocan junto con ella y NO
    cuentan como tinta.

  La primera versión comparaba contra un nivel de piel global y la sombra que
  cae sobre el brazo del founder brillaba como si fuera tatuaje.
*/
const RADIO_FINO = 6
const RADIO_AMPLIO = 36

/*
  Umbrales en PROPORCIÓN de oscurecimiento respecto al entorno, no en niveles
  absolutos: una línea en zona sombreada oscurece lo mismo en proporción que
  una en zona iluminada, aunque en niveles de gris la diferencia sea la mitad.
*/
const FINO_MIN = 0.07, FINO_PLENO = 0.28
const AMPLIO_MIN = 0.18, AMPLIO_PLENO = 0.45

/**
 * @param {Uint8Array|number[]} gris - Píxeles en escala de grises, fila 0 = arriba
 * @param {number} ancho
 * @param {number} alto
 * @returns {Float32Array} Valor 0..1 por píxel, MISMA orientación que la entrada
 */
export function calcularMascaraTinta(gris, ancho, alto) {
  const fino = desenfocar(gris, ancho, alto, RADIO_FINO)
  const amplio = desenfocar(gris, ancho, alto, RADIO_AMPLIO)
  const mascara = new Float32Array(ancho * alto)

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x
      const g = gris[i]
      // +8 evita dividir entre casi cero en zonas negras del fondo
      const trazo = suave(FINO_MIN, FINO_PLENO, (fino[i] - g) / (fino[i] + 8))
      const relleno = suave(AMPLIO_MIN, AMPLIO_PLENO, (amplio[i] - g) / (amplio[i] + 8))

      /*
        Peso radial: la guía de foto pide el tatuaje centrado, así que lo que
        está en los bordes es casi siempre fondo (piso, ropa, el borde del
        brazo contra la pared).

        Los RELLENOS se atenúan antes que los trazos: el fondo oscuro que se
        cuela en las orillas de la foto se detecta como relleno, mientras que
        el contorno de un diseño que llega cerca del borde es trazo y debe
        seguir encendiéndose.
      */
      const r = Math.hypot((x / ancho - 0.5) / 0.5, (y / alto - 0.5) / 0.5)
      const centro = 1 - suave(0.6, 1.05, r)
      const centroRelleno = 1 - suave(0.45, 0.8, r)

      mascara[i] = Math.max(trazo * centro, relleno * centroRelleno)
    }
  }
  return mascara
}

/**
 * Elige hasta `n` puntos de tinta, más probables donde la máscara es alta.
 * Devuelve coordenadas normalizadas 0..1 con y hacia ARRIBA (convención de
 * Three), listas para mapear al plano del ancla.
 *
 * Determinista por semilla: el mismo tatuaje da siempre la misma nube, así que
 * dos grabaciones del demo se ven iguales.
 */
export function muestrearPuntosDeTinta(mascara, ancho, alto, n, semilla = 7) {
  const azar = generadorAzar(semilla)
  const puntos = []
  let intentos = 0
  // Muestreo por rechazo: simple, y con ~90k píxeles es de milisegundos
  while (puntos.length < n && intentos < n * 60) {
    intentos++
    const x = Math.floor(azar() * ancho)
    const y = Math.floor(azar() * alto)
    const peso = mascara[y * ancho + x]
    if (peso > 0.25 && azar() < peso) {
      puntos.push({ u: (x + azar()) / ancho, v: 1 - (y + azar()) / alto, peso })
    }
  }
  return puntos
}

/** Desenfoque de caja separable con imagen integral por fila/columna. */
function desenfocar(gris, ancho, alto, r) {
  const tmp = new Float32Array(ancho * alto)
  const out = new Float32Array(ancho * alto)
  for (let y = 0; y < alto; y++) {
    let suma = 0, cuenta = 0
    for (let x = -r; x < ancho; x++) {
      const entra = x + r, sale = x - r - 1
      if (entra < ancho) { suma += gris[y * ancho + entra]; cuenta++ }
      if (sale >= 0) { suma -= gris[y * ancho + sale]; cuenta-- }
      if (x >= 0) tmp[y * ancho + x] = suma / cuenta
    }
  }
  for (let x = 0; x < ancho; x++) {
    let suma = 0, cuenta = 0
    for (let y = -r; y < alto; y++) {
      const entra = y + r, sale = y - r - 1
      if (entra < alto) { suma += tmp[entra * ancho + x]; cuenta++ }
      if (sale >= 0) { suma -= tmp[sale * ancho + x]; cuenta-- }
      if (y >= 0) out[y * ancho + x] = suma / cuenta
    }
  }
  return out
}

function suave(a, b, v) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** mulberry32: diminuto y suficiente para repartir partículas. */
function generadorAzar(semilla) {
  let s = semilla >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

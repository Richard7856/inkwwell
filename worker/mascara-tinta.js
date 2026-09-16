/**
 * Separa la tinta de la piel en la foto de un tatuaje.
 *
 * Sirve para armar el PRIMER CUADRO del video generado: el dibujo del tatuaje
 * solo, sobre fondo de croma, en la misma posición que en la foto compilada.
 * Así el video arranca calzado sobre el tatuaje real y la animación nace de
 * él (ver DECISIONS.md, 16 sep, "el video empieza en el tatuaje").
 *
 * Módulo puro, sin DOM: corre igual en Node (worker, scripts) que en el
 * navegador. Se calibró contra los tatuajes reales del founder y el marcador.
 */

/*
  Dos escalas de "cómo se ve la piel alrededor", en px de una imagen de 256 de
  ancho (donde un trazo mide 2-6 px). Se escalan con el ancho real, porque la
  proporción entre el trazo y el brazo no cambia con la resolución:

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
  const k = ancho / 256
  const fino = desenfocar(gris, ancho, alto, Math.max(2, Math.round(RADIO_FINO * k)))
  const amplio = desenfocar(gris, ancho, alto, Math.round(RADIO_AMPLIO * k))
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

/**
 * Quita de la máscara lo que no pertenece al dibujo: las orillas del brazo y
 * el fondo de la foto, que salen como líneas largas y sueltas.
 *
 * Se agrupa la tinta en manchas (dilatando un poco, para que los trazos de un
 * mismo diseño queden unidos) y se conservan solo las manchas grandes. Una
 * línea de la orilla del brazo es larga pero delgada: su área es mínima frente
 * al tatuaje, y cae fuera.
 *
 * Edge case: un tatuaje con elementos sueltos pequeños (estrellas, puntos
 * lejanos) puede perderlos. Por eso el corte es relativo a la mancha mayor y
 * bajo (15%), no un área fija.
 *
 * @param {Float32Array} mascara - Se modifica en su lugar
 * @returns {Float32Array} la misma máscara
 */
export function limpiarMascara(mascara, ancho, alto, { umbral = 0.3, fraccionMin = 0.15 } = {}) {
  // Rejilla reducida: la limpieza no necesita detalle y así es instantánea
  const paso = Math.max(1, Math.round(ancho / 192))
  const gw = Math.ceil(ancho / paso)
  const gh = Math.ceil(alto / paso)
  const tinta = new Uint8Array(gw * gh)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (mascara[y * ancho + x] > umbral) tinta[Math.floor(y / paso) * gw + Math.floor(x / paso)] = 1
    }
  }

  // Dilatación de 2 celdas: une los puntos de un relleno punteado
  const unida = new Uint8Array(gw * gh)
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (!tinta[y * gw + x]) continue
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const yy = y + dy, xx = x + dx
          if (yy >= 0 && yy < gh && xx >= 0 && xx < gw) unida[yy * gw + xx] = 1
        }
      }
    }
  }

  // Componentes conexas, midiendo el área con TINTA real (no la dilatada),
  // para que una línea larga no gane área por la dilatación
  const etiqueta = new Int32Array(gw * gh).fill(-1)
  const areas = []
  const pila = []
  for (let i = 0; i < gw * gh; i++) {
    if (!unida[i] || etiqueta[i] >= 0) continue
    const id = areas.length
    let area = 0
    etiqueta[i] = id
    pila.push(i)
    while (pila.length) {
      const j = pila.pop()
      area += tinta[j]
      const x = j % gw, y = (j - x) / gw
      for (const [xx, yy] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue
        const k = yy * gw + xx
        if (unida[k] && etiqueta[k] < 0) { etiqueta[k] = id; pila.push(k) }
      }
    }
    areas.push(area)
  }
  if (!areas.length) return mascara

  const mayor = Math.max(...areas)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const id = etiqueta[Math.floor(y / paso) * gw + Math.floor(x / paso)]
      if (id < 0 || areas[id] < mayor * fraccionMin) mascara[y * ancho + x] = 0
    }
  }
  return mascara
}

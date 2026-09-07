/**
 * Extrae la tinta del tatuaje separándola de la piel, para mostrarla como una
 * capa limpia mientras se compila.
 *
 * ── ES SOLO PRESENTACIÓN ──
 * Lo que se compila y se manda al worker es SIEMPRE la foto original, con piel.
 * MindAR no reconoce siluetas sino gradientes locales: el borde de una línea
 * contra piel tiene una firma distinta a esa misma línea contra blanco.
 * Compilar la tinta aislada generaría descriptores que no corresponden a lo que
 * la cámara verá en el escaneo. Además el compilador pasa todo a escala de
 * grises e ignora el canal alfa, así que la transparencia se volvería negro.
 */

/*
  Umbral ADAPTATIVO, no global.

  Un valor de corte único falla con iluminación desigual: probado con una foto
  real donde la parte baja del brazo estaba en sombra, esa piel se clasificaba
  como tinta y el resultado era una mancha negra sólida.

  Comparando cada píxel contra la media de su vecindario, el gradiente de
  iluminación se cancela: lo que decide es si el píxel es más oscuro que la piel
  QUE LO RODEA.

  El radio del desenfoque debe superar bastante el grosor de los trazos. Si
  fuera parecido, la media local se contaminaría con la propia tinta y los
  trazos gruesos saldrían huecos, solo con el contorno.
*/
const BLUR_RATIO = 0.05
const DARKNESS_MARGIN = 8
const WORK_SIZE = 900

/*
  Tamaño mínimo de un grupo conectado para contar como tinta, como fracción del
  total. Sobre 900x1200 son ~540 píxeles: un trazo o una letra lo superan con
  holgura; un vello o un poro no se acercan.
*/
const MIN_BLOB_RATIO = 0.0005

/*
  Viñeteado: desvanece los bordes del encuadre.

  El umbral adaptativo marca como tinta cualquier cosa más oscura que su
  entorno, y en una foto real eso incluye las juntas del piso, el borde de un
  mueble o el contorno del brazo. Todo ese ruido vive en la PERIFERIA, porque la
  guía de captura pide el tatuaje centrado.

  Se intentó antes recortar automáticamente a la mancha de tinta más grande,
  pero en fotos reales esa mancha queda conectada al sombreado del borde del
  brazo y abarcaba la imagen completa. El viñeteado resuelve lo mismo sin
  depender de detectar correctamente dónde termina el tatuaje, y de paso se ve
  mejor: enfoca la atención en el centro como un reflector.
*/
const VIGNETTE_INNER = 0.42   // hasta aquí, opacidad total
const VIGNETTE_OUTER = 0.72   // de aquí para afuera, transparente

/**
 * @param {HTMLImageElement|HTMLCanvasElement} img - Imagen ya cargada
 * @returns {{ maskCanvas: HTMLCanvasElement, inkRatio: number }}
 *   maskCanvas — tinta opaca sobre fondo transparente, lista para superponer
 *   inkRatio — fracción de píxeles clasificados como tinta (para diagnóstico)
 */
export function extractInk(img) {
  const srcW = img.width
  const srcH = img.height
  const scale = Math.min(1, WORK_SIZE / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))

  const base = document.createElement('canvas')
  base.width = w
  base.height = h
  const baseCtx = base.getContext('2d', { willReadFrequently: true })
  baseCtx.drawImage(img, 0, 0, w, h)
  const baseData = baseCtx.getImageData(0, 0, w, h).data

  // Media local = la misma imagen desenfocada. El desenfoque nativo del canvas
  // hace en hardware lo que a mano serían dos pasadas de convolución.
  const blurred = document.createElement('canvas')
  blurred.width = w
  blurred.height = h
  const blurCtx = blurred.getContext('2d', { willReadFrequently: true })
  blurCtx.filter = `blur(${Math.round(Math.max(w, h) * BLUR_RATIO)}px)`
  blurCtx.drawImage(img, 0, 0, w, h)
  const blurData = blurCtx.getImageData(0, 0, w, h).data

  const mask = document.createElement('canvas')
  mask.width = w
  mask.height = h
  const maskCtx = mask.getContext('2d')
  const out = maskCtx.createImageData(w, h)

  for (let i = 0; i < baseData.length; i += 4) {
    // Luminancia perceptual: el ojo humano pesa más el verde
    const lum = 0.299 * baseData[i] + 0.587 * baseData[i + 1] + 0.114 * baseData[i + 2]
    const media = 0.299 * blurData[i] + 0.587 * blurData[i + 1] + 0.114 * blurData[i + 2]

    if (lum < media - DARKNESS_MARGIN) {
      // Opacidad proporcional a qué tan oscuro es respecto a su entorno: da
      // bordes suaves en vez de un recorte duro de un solo bit
      const fuerza = Math.min(1, (media - DARKNESS_MARGIN - lum) / 60)
      out.data[i] = 12
      out.data[i + 1] = 12
      out.data[i + 2] = 12
      out.data[i + 3] = Math.round(110 + fuerza * 145)
    }
  }

  const inkCount = removeSmallBlobs(out.data, w, h)
  maskCtx.putImageData(out, 0, 0)
  applyVignette(maskCtx, w, h)

  return { maskCanvas: mask, inkRatio: inkCount / (w * h) }
}

/**
 * Borra los grupos conectados más chicos que el mínimo (vello, poros, motas).
 *
 * Recorre con una pila explícita en lugar de recursión: una mancha grande puede
 * tener cientos de miles de píxeles y desbordaría la pila de llamadas.
 *
 * @returns {number} Píxeles de tinta que sobrevivieron
 */
function removeSmallBlobs(data, w, h) {
  const total = w * h
  const minBlob = Math.max(30, Math.floor(total * MIN_BLOB_RATIO))
  const visitado = new Uint8Array(total)
  const pila = new Int32Array(total)
  const grupo = new Int32Array(total)
  let inkCount = 0

  const esTinta = (i) => data[i * 4 + 3] > 0

  for (let inicio = 0; inicio < total; inicio++) {
    if (visitado[inicio] || !esTinta(inicio)) continue

    let sp = 0
    let n = 0
    pila[sp++] = inicio
    visitado[inicio] = 1

    while (sp > 0) {
      const i = pila[--sp]
      grupo[n++] = i
      const x = i % w
      const y = (i / w) | 0
      // 4-conectividad: suficiente para trazos continuos, la mitad de costo que 8
      if (x > 0     && !visitado[i - 1] && esTinta(i - 1)) { visitado[i - 1] = 1; pila[sp++] = i - 1 }
      if (x < w - 1 && !visitado[i + 1] && esTinta(i + 1)) { visitado[i + 1] = 1; pila[sp++] = i + 1 }
      if (y > 0     && !visitado[i - w] && esTinta(i - w)) { visitado[i - w] = 1; pila[sp++] = i - w }
      if (y < h - 1 && !visitado[i + w] && esTinta(i + w)) { visitado[i + w] = 1; pila[sp++] = i + w }
    }

    if (n < minBlob) {
      for (let k = 0; k < n; k++) data[grupo[k] * 4 + 3] = 0
    } else {
      inkCount += n
    }
  }

  return inkCount
}

/**
 * Desvanece la periferia del encuadre, donde vive el ruido del fondo.
 * destination-in conserva el contenido existente solo donde el gradiente es
 * opaco — recorta por alfa sin repintar la tinta.
 */
function applyVignette(ctx, w, h) {
  const cx = w / 2
  const cy = h / 2
  const radio = Math.max(w, h) / 2

  const grad = ctx.createRadialGradient(cx, cy, radio * VIGNETTE_INNER, cx, cy, radio * VIGNETTE_OUTER)
  grad.addColorStop(0, 'rgba(0,0,0,1)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')

  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'
}

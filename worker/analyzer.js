/**
 * Analizador de calidad de image target.
 *
 * PROBLEMA QUE RESUELVE:
 * MindAR no "aprende" ni se entrena — extrae descriptores visuales de forma
 * determinista. Si un tatuaje no tiene suficientes puntos de interés únicos,
 * NO hay parámetro que lo arregle. El tracking va a fallar siempre.
 *
 * Por eso conviene medir ANTES de activar: le decimos al usuario si su tatuaje
 * va a funcionar y, si no, exactamente por qué (poca textura, mala luz, muy chico).
 *
 * ── Las dos familias de puntos de MindAR ──
 *
 * matchingData → DETECCIÓN. Encontrar el tatuaje en el frame de cámara desde cero.
 *   Un keyframe por nivel de escala (full size → hasta que el lado menor mide 100px).
 *   Muchos niveles con puntos = se detecta desde lejos y desde cerca.
 *   Pocos niveles = solo se detecta a una distancia específica.
 *
 * trackingData → SEGUIMIENTO. Una vez detectado, seguirlo frame a frame.
 *   Solo 2 niveles (lado menor a 256px y 128px).
 *   Es el predictor más directo de si el 3D se queda pegado o se despega al moverse.
 *
 * ── Sobre los umbrales ──
 * Los thresholds de abajo son HEURÍSTICAS INICIALES, no verdad absoluta. Están
 * puestos para tener una línea base sobre la cual calibrar con fotos reales.
 * Cuando tengamos el banco de pruebas con 15-20 tatuajes medidos contra su
 * comportamiento real en cámara, hay que ajustarlos con datos, no con intuición.
 */

import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js'
import { loadImage } from 'canvas'

// Resolución mínima recomendada — por debajo de esto la extracción de features
// pierde detalle fino y el tracking se degrada notablemente.
const MIN_RECOMMENDED_DIMENSION = 800

// Umbrales iniciales a calibrar con datos reales (ver nota arriba)
const THRESHOLDS = {
  // Fracción del máximo teórico de puntos de tracking (0-1), NO conteo absoluto.
  // Ver computeMaxTrackingFeatures() para por qué.
  trackingFill: { excelente: 0.5, bueno: 0.3, aceptable: 0.15 },
  detection:    { excelente: 800, bueno: 400, aceptable: 150 },
  // Celdas ocupadas de una grilla 3x3 (máx 9). Mide qué tan repartidos están
  // los puntos: si todos caen en una esquina, el tracking se pierde apenas
  // esa esquina sale del encuadre.
  gridCells:    { excelente: 7, bueno: 5, aceptable: 4 },
}

/*
  Constantes copiadas de mind-ar/src/image-target/tracker/extract.js.
  Se replican aquí para poder calcular el techo teórico de puntos sin
  importar internals privados del paquete.

  OJO: si se actualiza mind-ar, verificar que estos valores sigan vigentes.
*/
const TEMPLATE_SIZE = 6
const DIV_SIZE = (TEMPLATE_SIZE * 2 + 1) * 3   // 39

/**
 * Techo teórico de puntos de tracking para una imagen de w×h.
 *
 * POR QUÉ ESTA FUNCIÓN EXISTE:
 * El extractor de tracking de MindAR no devuelve "todos los puntos buenos que
 * encuentre" — tiene un tope duro por ocupación de grilla:
 *
 *   maxFeatureNum = floor(w/occSize) * floor(h/occSize) + xDiv * yDiv
 *   con occSize = floor(min(w,h)/10) y divSize = 39
 *
 * Es decir, el máximo depende SOLO de las dimensiones, no de la textura.
 * Una imagen de tracking de 256×256 tope ~136 puntos; una de 128×128, ~109.
 *
 * Consecuencia práctica: un umbral absoluto ("necesitas 200 puntos") es
 * incorrecto — puede ser inalcanzable. Lo que importa es qué fracción del
 * techo se llenó, que sí es comparable entre imágenes de distinto tamaño.
 */
function computeMaxTrackingFeatures(width, height) {
  const occSize = Math.floor(Math.min(width, height) / 10)
  if (occSize <= 0) return 0
  const gridPoints = Math.floor(width / occSize) * Math.floor(height / occSize)
  const divPoints = Math.floor(width / DIV_SIZE) * Math.floor(height / DIV_SIZE)
  return gridPoints + divPoints
}

/**
 * Compila la imagen y calcula métricas de calidad de tracking.
 *
 * Devuelve también el .mind compilado para no tener que compilar dos veces:
 * el flujo de producto ideal analiza primero y, si pasa el umbral, reutiliza
 * ese mismo buffer para activar el tatuaje.
 *
 * @param {Buffer} imageBuffer - Buffer de la imagen (JPG/PNG/WebP)
 * @param {(pct: number) => void} [onProgress] - Callback de progreso 0-100
 * @returns {Promise<{ metrics: object, mindBuffer: ArrayBuffer }>}
 */
export async function analyzeTattooImage(imageBuffer, onProgress = () => {}) {
  const img = await loadImage(imageBuffer)

  const compiler = new OfflineCompiler()
  // compileImageTargets devuelve el array de datos internos (uno por imagen),
  // que es exactamente lo que necesitamos para medir. exportData() los serializa
  // a msgpack pero pierde la estructura navegable.
  const data = await compiler.compileImageTargets([img], onProgress)
  const target = data[0]

  const detection = analyzeDetectionPoints(target.matchingData)
  const tracking = analyzeTrackingPoints(target.trackingData)
  const distribution = analyzeSpatialDistribution(target.matchingData)
  const resolution = analyzeResolution(img.width, img.height)

  const verdict = buildVerdict({ detection, tracking, distribution, resolution })

  return {
    metrics: {
      image: { width: img.width, height: img.height },
      resolution,
      detection,
      tracking,
      distribution,
      verdict,
    },
    mindBuffer: compiler.exportData(),
  }
}

/**
 * Puntos de detección por nivel de escala.
 *
 * Por qué importa el desglose por escala y no solo el total:
 * cada keyframe corresponde a la imagen reducida a cierto tamaño. MindAR busca
 * el target en todos esos niveles. Si solo los niveles grandes tienen puntos,
 * el tatuaje solo se detecta con la cámara cerca. Si están repartidos, se
 * detecta desde varias distancias — mucho mejor UX.
 */
function analyzeDetectionPoints(matchingData) {
  const byScale = matchingData.map((kf) => ({
    scale: Number(kf.scale.toFixed(4)),
    width: kf.width,
    height: kf.height,
    maxima: kf.maximaPoints.length,
    minima: kf.minimaPoints.length,
    total: kf.maximaPoints.length + kf.minimaPoints.length,
  }))

  const totalPoints = byScale.reduce((sum, s) => sum + s.total, 0)

  // Un nivel es "útil" si aporta suficientes puntos para intentar un match.
  // Por debajo de ~20 el nivel es ruido, no ayuda a detectar.
  const usableScaleLevels = byScale.filter((s) => s.total >= 20).length

  return {
    totalPoints,
    scaleLevels: byScale.length,
    usableScaleLevels,
    // El keyframe de mayor escala es el más rico y el que se usa de cerca
    fullScalePoints: byScale[0]?.total ?? 0,
    byScale,
  }
}

/**
 * Puntos de seguimiento frame a frame.
 * Es el predictor más directo de estabilidad: pocos puntos aquí = el 3D
 * se despega o vibra apenas mueves la cámara.
 */
function analyzeTrackingPoints(trackingData) {
  const byScale = trackingData.map((fs) => {
    const max = computeMaxTrackingFeatures(fs.width, fs.height)
    return {
      scale: Number(fs.scale.toFixed(4)),
      width: fs.width,
      height: fs.height,
      points: fs.points.length,
      maxPossible: max,
      fill: max > 0 ? Number((fs.points.length / max).toFixed(3)) : 0,
    }
  })

  const totalPoints = byScale.reduce((sum, s) => sum + s.points, 0)
  const totalMax = byScale.reduce((sum, s) => sum + s.maxPossible, 0)

  return {
    totalPoints,
    maxPossible: totalMax,
    // Métrica principal: qué fracción del techo teórico se llenó.
    // Comparable entre imágenes de distinto tamaño, a diferencia del conteo crudo.
    fillRatio: totalMax > 0 ? Number((totalPoints / totalMax).toFixed(3)) : 0,
    byScale,
  }
}

/**
 * Distribución espacial de los puntos sobre una grilla 3x3.
 *
 * Por qué esta métrica existe:
 * el conteo total engaña. Un tatuaje puede tener 500 puntos concentrados todos
 * en una firma diminuta de una esquina — el número se ve bien pero el tracking
 * se cae apenas esa esquina sale del encuadre. Repartidos por toda la superficie,
 * el tracking sobrevive a oclusiones parciales y a encuadres incompletos.
 *
 * Usamos el keyframe de mayor escala porque es el que tiene los puntos más finos
 * y representativos de la textura real del tatuaje.
 */
function analyzeSpatialDistribution(matchingData) {
  const kf = matchingData[0]
  if (!kf) {
    return { occupiedCells: 0, totalCells: 9, maxCellShare: 1, grid: [] }
  }

  const points = [...kf.maximaPoints, ...kf.minimaPoints]
  const GRID = 3
  const cells = Array.from({ length: GRID * GRID }, () => 0)

  for (const p of points) {
    // Clamp por seguridad: un punto exactamente en el borde daría índice fuera de rango
    const cx = Math.min(GRID - 1, Math.floor((p.x / kf.width) * GRID))
    const cy = Math.min(GRID - 1, Math.floor((p.y / kf.height) * GRID))
    cells[cy * GRID + cx]++
  }

  // Una celda cuenta como ocupada si tiene al menos el 2% de los puntos.
  // Umbral relativo (no absoluto) para que funcione igual con 100 o 2000 puntos.
  const minPerCell = Math.max(3, points.length * 0.02)
  const occupiedCells = cells.filter((c) => c >= minPerCell).length

  // Qué fracción de puntos cae en la celda más densa. >0.5 = muy concentrado.
  const maxCellShare = points.length > 0 ? Math.max(...cells) / points.length : 1

  return {
    occupiedCells,
    totalCells: GRID * GRID,
    maxCellShare: Number(maxCellShare.toFixed(3)),
    grid: cells,
  }
}

function analyzeResolution(width, height) {
  const minDimension = Math.min(width, height)
  return {
    width,
    height,
    minDimension,
    isBelowRecommended: minDimension < MIN_RECOMMENDED_DIMENSION,
  }
}

/**
 * Combina las métricas en un veredicto accionable.
 *
 * Diseño: el nivel lo determina la MÉTRICA MÁS DÉBIL, no el promedio.
 * Un tatuaje con 900 puntos concentrados en una esquina va a fallar igual que
 * uno con 80 puntos bien repartidos. Promediar escondería el problema real.
 */
function buildVerdict({ detection, tracking, distribution, resolution }) {
  const reasons = []
  const tips = []

  const levelFor = (value, t) =>
    value >= t.excelente ? 3 : value >= t.bueno ? 2 : value >= t.aceptable ? 1 : 0

  const trackingLevel = levelFor(tracking.fillRatio, THRESHOLDS.trackingFill)
  const detectionLevel = levelFor(detection.totalPoints, THRESHOLDS.detection)
  const gridLevel = levelFor(distribution.occupiedCells, THRESHOLDS.gridCells)

  if (trackingLevel <= 1) {
    reasons.push(
      `Pocos puntos de seguimiento: ${tracking.totalPoints} de ${tracking.maxPossible} posibles ` +
      `(${Math.round(tracking.fillRatio * 100)}%). El 3D va a vibrar o despegarse al mover la cámara.`
    )
    tips.push('Tatuajes con sombreado, textura o líneas densas trackean mucho mejor que line-art fino.')
  }

  if (detectionLevel <= 1) {
    reasons.push(
      `Pocos puntos de detección (${detection.totalPoints}). Va a costar que la cámara reconozca el tatuaje.`
    )
    tips.push('Mejora el contraste: luz lateral suave, sin flash directo, sin reflejos en la piel.')
  }

  if (gridLevel <= 1) {
    reasons.push(
      `Puntos concentrados en ${distribution.occupiedCells} de 9 zonas. El tracking se pierde si esa zona sale del encuadre.`
    )
    tips.push('Encuadra el tatuaje completo y centrado, sin partes cortadas ni piel vacía de más.')
  }

  if (distribution.maxCellShare > 0.5) {
    reasons.push(
      `El ${Math.round(distribution.maxCellShare * 100)}% de los puntos cae en una sola zona de la imagen.`
    )
  }

  if (resolution.isBelowRecommended) {
    reasons.push(
      `Resolución baja (lado menor ${resolution.minDimension}px, recomendado ${MIN_RECOMMENDED_DIMENSION}px).`
    )
    tips.push('Toma la foto más cerca o con mejor cámara — no la recortes de una imagen más grande.')
  }

  if (detection.usableScaleLevels <= 2) {
    reasons.push(
      `Solo ${detection.usableScaleLevels} niveles de escala con puntos útiles. Se va a detectar únicamente a una distancia específica.`
    )
  }

  // El nivel final es el mínimo — la cadena se rompe por el eslabón más débil
  const worst = Math.min(trackingLevel, detectionLevel, gridLevel)
  const level = ['malo', 'aceptable', 'bueno', 'excelente'][worst]

  return {
    level,
    score: worst,
    isUsable: worst >= 1,
    breakdown: {
      tracking: ['malo', 'aceptable', 'bueno', 'excelente'][trackingLevel],
      detection: ['malo', 'aceptable', 'bueno', 'excelente'][detectionLevel],
      distribution: ['malo', 'aceptable', 'bueno', 'excelente'][gridLevel],
    },
    reasons,
    // Deduplicar: varios problemas pueden sugerir el mismo tip
    tips: [...new Set(tips)],
  }
}

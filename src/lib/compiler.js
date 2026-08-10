/**
 * Compilación del image target (.mind) a partir de la foto del tatuaje.
 *
 * ── Por qué se compila en el dispositivo y no en un servidor ──
 * MindAR trae DOS compiladores: `OfflineCompiler` (Node, el que usa worker/) y
 * `Compiler` (navegador, que corre la parte pesada en un Web Worker). Los dos
 * producen exactamente el mismo .mind — el formato no cambia.
 *
 * Usar el del navegador elimina un servicio entero: sin Railway, sin ngrok, sin
 * subir la foto y esperar la respuesta. También quita el punto de fallo más
 * frágil del flujo de activación, porque el worker era la única pieza que podía
 * estar caída mientras todo lo demás funcionaba.
 *
 * El worker sigue existiendo como respaldo (ver más abajo).
 *
 * ── Por qué se reduce la imagen antes de compilar ──
 * Una foto de celular moderna trae 12 megapíxeles. El costo de extraer
 * características crece con el área, así que compilar la foto original en un
 * teléfono de gama media puede tardar minutos o quedarse sin memoria.
 *
 * 1024px en el lado largo está en línea con lo que recomienda MindAR para
 * imágenes objetivo y conserva de sobra el detalle que necesita el tracking.
 */
const MAX_DIMENSION = 1024

const COMPILER_URL = import.meta.env.VITE_COMPILER_URL || ''

/**
 * Compila la foto y devuelve el .mind como ArrayBuffer.
 *
 * @param {File|Blob} imageFile - la foto del tatuaje
 * @param {(percent: number) => void} [onProgress] - avance de 0 a 100
 * @returns {Promise<ArrayBuffer>}
 */
export async function compileMindFile(imageFile, onProgress) {
  try {
    return await compileInBrowser(imageFile, onProgress)
  } catch (err) {
    console.warn('[compiler] falló la compilación local:', err.message)

    // Respaldo: si hay un worker configurado, se intenta allá. Sirve para
    // dispositivos viejos sin Web Workers o con poca memoria. Si no hay worker,
    // se propaga el error original, que es más útil que "no hay compilador".
    if (!COMPILER_URL) throw err

    console.warn('[compiler] reintentando en el worker remoto')
    return compileInWorker(imageFile)
  }
}

/** Compila usando el Web Worker de MindAR, dentro del dispositivo. */
async function compileInBrowser(imageFile, onProgress) {
  /*
    Import dinámico a propósito.

    El Compiler arrastra su Web Worker embebido: ~900KB sin comprimir. Con un
    import estático eso entra al bundle principal y lo descarga TODO el que abre
    la landing, aunque nunca active un tatuaje — que va a ser la enorme mayoría
    de las visitas. Cargándolo aquí, solo lo paga quien de verdad compila.

    Se importa del bundle ya construido (dist/) y no del código fuente
    (src/image-target/compiler.js). El fuente importa su worker como
    "./compiler.worker.js?worker&inline" — sintaxis de Vite que el pre-bundler
    de dependencias no entiende, así que `npm run build` funcionaba pero
    `npm run dev` reventaba con "No such file or directory". El bundle de dist
    ya trae el worker resuelto. Es además la misma vía que usa useMindAR.js.
  */
  const { Compiler } = await import('mind-ar/dist/mindar-image.prod.js')

  const img = await downscaleToImage(imageFile)

  const compiler = new Compiler()
  await compiler.compileImageTargets([img], (percent) => {
    onProgress?.(Math.min(100, Math.round(percent)))
  })

  // exportData() es síncrono y devuelve el msgpack ya codificado
  const buffer = compiler.exportData()

  // Normalizar a ArrayBuffer: uploadMindFile lo sube tal cual y un Uint8Array
  // con offset subiría bytes de más.
  return buffer instanceof Uint8Array
    ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    : buffer
}

/**
 * Carga la foto en un <img> reduciéndola si hace falta.
 * Devuelve un HTMLImageElement, que es lo que espera compileImageTargets.
 */
async function downscaleToImage(imageFile) {
  const bitmap = await createImageBitmap(imageFile)

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  const url = URL.createObjectURL(blob)

  try {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('No se pudo leer la imagen'))
      img.src = url
    })
    // Decodificar antes de revocar la URL: si se revoca demasiado pronto,
    // el drawImage posterior pinta un canvas en blanco sin lanzar error.
    if (img.decode) await img.decode().catch(() => {})
    return img
  } finally {
    // La imagen ya está decodificada en memoria; la URL se puede liberar.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

/** Respaldo: envía la foto al worker de Node y recibe el .mind ya compilado. */
async function compileInWorker(imageFile) {
  const formData = new FormData()
  formData.append('image', imageFile)

  const response = await fetch(`${COMPILER_URL}/compile`, {
    method: 'POST',
    body: formData,
    headers: {
      // ngrok intercepta las peticiones del plan gratuito con una página HTML
      // de advertencia que no trae CORS, así que el navegador reporta un error
      // de CORS cuando el problema real es que nunca llegó al worker.
      'ngrok-skip-browser-warning': 'true',
    },
  })

  if (!response.ok) {
    throw new Error(`Compilación fallida: ${response.status} ${response.statusText}`)
  }

  return response.arrayBuffer()
}

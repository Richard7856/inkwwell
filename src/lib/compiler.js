// Client del worker de compilación .mind

/*
  Se normaliza el esquema en vez de confiar en la variable de entorno.

  Sin esto, un valor sin `https://` (fácil de producir al copiar y pegar en el
  panel de un hosting) convierte cada llamada en una ruta RELATIVA: el navegador
  pide `midominio.com/mi-worker.railway.app/compile-stream`, recibe el index.html
  del sitio y falla al interpretarlo. El síntoma no menciona la URL por ningún
  lado. Pasó en producción.
*/
const COMPILER_URL = (() => {
  const crudo = (import.meta.env.VITE_COMPILER_URL || '').trim().replace(/\/+$/, '')
  if (!crudo) return ''
  return /^https?:\/\//i.test(crudo) ? crudo : `https://${crudo}`
})()

// ngrok (plan gratuito) intercepta con una página de advertencia que rompe el
// request. Con Railway es innecesario, pero se conserva por si se vuelve a
// exponer el worker por un túnel en desarrollo.
const COMMON_HEADERS = { 'ngrok-skip-browser-warning': 'true' }

/** Error de compilación real (la imagen falló), no de transporte */
class CompileError extends Error {
  constructor(message) {
    super(message)
    this.isFatal = true
  }
}

/**
 * Envía la foto del tatuaje al worker y devuelve el .mind compilado.
 *
 * Intenta primero el endpoint con progreso (SSE) y cae al clásico si no está
 * disponible — un APK viejo apuntando a un worker nuevo, o un proxy que no
 * soporte respuestas incrementales, siguen funcionando sin progreso.
 *
 * @param {File} imageFile - Foto del tatuaje (ya reducida por PhotoUpload)
 * @param {(pct: number) => void} [onProgress] - Avance real 0-100
 * @returns {Promise<ArrayBuffer>} Binario del .mind
 */
export async function compileMindFile(imageFile, onProgress) {
  if (!COMPILER_URL) {
    throw new Error(
      'Compilador .mind no configurado. Falta VITE_COMPILER_URL en el entorno.'
    )
  }

  try {
    return await compileWithProgress(imageFile, onProgress)
  } catch (err) {
    // Si la compilación falló de verdad, reintentar por el otro endpoint solo
    // repetiría un proceso caro para llegar al mismo error
    if (err.isFatal) throw err
    console.warn('[compiler] Streaming no disponible, usando /compile:', err.message)
    return await compilePlain(imageFile)
  }
}

/**
 * Compilación con progreso real vía Server-Sent Events.
 *
 * No se usa EventSource porque solo soporta GET y hay que subir la imagen por
 * POST. En su lugar se lee el cuerpo de la respuesta como stream y se parsean
 * los eventos a mano.
 */
async function compileWithProgress(imageFile, onProgress) {
  const formData = new FormData()
  formData.append('image', imageFile)

  const response = await fetch(`${COMPILER_URL}/compile-stream`, {
    method: 'POST',
    body: formData,
    headers: COMMON_HEADERS,
  })

  if (!response.ok || !response.body) {
    // 404 = worker viejo sin el endpoint → que decida el llamador si cae al otro
    throw new Error(`compile-stream no disponible (${response.status})`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Los eventos SSE se separan por línea en blanco. El último fragmento puede
    // estar incompleto, así que se conserva en el buffer para el siguiente chunk.
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      const line = chunk.trim()
      if (!line.startsWith('data:')) continue

      const payload = JSON.parse(line.slice(5).trim())

      if (payload.type === 'progress') {
        onProgress?.(toDisplayProgress(payload.value))
      } else if (payload.type === 'error') {
        throw new CompileError(payload.message)
      } else if (payload.type === 'done') {
        result = payload
      }
    }
  }

  if (!result) {
    // El stream terminó sin evento 'done': se cortó la conexión a media
    // compilación. No es fatal — vale la pena reintentar por el endpoint normal.
    throw new Error('El stream terminó sin completar la compilación')
  }

  onProgress?.(100)
  return base64ToArrayBuffer(result.mind)
}

/** Compilación clásica: una sola respuesta binaria, sin progreso */
async function compilePlain(imageFile) {
  const formData = new FormData()
  formData.append('image', imageFile)

  const response = await fetch(`${COMPILER_URL}/compile`, {
    method: 'POST',
    body: formData,
    headers: COMMON_HEADERS,
  })

  if (!response.ok) {
    // El worker manda detalle del fallo en JSON — mucho más útil que el status
    const detail = await response.json().catch(() => null)
    throw new CompileError(
      detail?.error ?? `Compilación fallida: ${response.status} ${response.statusText}`
    )
  }

  return await response.arrayBuffer()
}

/*
  Remapea el progreso de MindAR a algo que represente tiempo real.

  Medido contra Railway con una imagen de 1 MP:
      0% ->  3.2s     25% ->  8.7s
     50% -> 10.4s    100% -> 10.4s
  La primera mitad (features de detección, que corre sobre TensorFlow) consume
  prácticamente todo el tiempo; la segunda (features de seguimiento) es
  instantánea.

  Sin remapear, la barra se arrastra hasta 50% y salta a 100% de golpe — parece
  que se atoró y luego que hizo trampa. Estirando 0-50 sobre 0-95 el avance
  visible corresponde al tiempo que el usuario realmente espera.

  Sigue siendo progreso real: se transforma la escala, no se inventa el dato.
*/
function toDisplayProgress(raw) {
  if (raw <= 50) return (raw / 50) * 95
  return 95 + ((raw - 50) / 50) * 5
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

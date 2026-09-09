/**
 * Cliente mínimo de la API pública de Higgsfield.
 *
 * ── Qué se sabe de la API (verificado en docs.higgsfield.ai, 9 sep 2026) ──
 * - Base `https://api.higgsfield.ai`, cabecera `Authorization: Key ID:SECRET`.
 * - Un POST por modelo: el cuerpo cambia según el modelo (tipos y enums
 *   distintos para duración y resolución), por eso hay un perfil por endpoint.
 * - Devuelve `request_id`; se sondea `GET /requests/{id}/status` hasta un
 *   estado terminal: completed | failed | nsfw | canceled. El video sale en
 *   `video.url`.
 * - La imagen de entrada es una URL https pública: nuestro Storage sirve.
 * - Los archivos de salida caducan a los 7 días: hay que copiarlos.
 *
 * ── Por qué el endpoint es configurable ──
 * El catálogo de la API pública NO es el del panel: aquí no existe MiniMax.
 * Cambiar de modelo debe ser una variable de entorno, no un despliegue —
 * sobre todo mientras no sepamos cuál da mejor resultado sobre piel.
 */

const BASE = 'https://api.higgsfield.ai'
const ID = process.env.HIGGSFIELD_KEY_ID
const SECRET = process.env.HIGGSFIELD_KEY_SECRET

export const higgsfieldConfigurado = Boolean(ID && SECRET)

/** Endpoint por defecto: el imagen-a-video más barato con control de duración y 9:16 */
export const ENDPOINT = process.env.HIGGSFIELD_ENDPOINT || '/bytedance/seedance/v1/lite/image-to-video'
const DURACION = Number(process.env.HIGGSFIELD_DURACION || 6)

/*
  Cuerpo de la petición por endpoint. Cada familia tiene sus propios tipos:
  Seedance quiere la duración como entero y la resolución como "720"; Veo la
  quiere como cadena de un conjunto cerrado y exige generate_audio. Mezclarlos
  da 422 sin explicación útil.

  9:16 siempre: el video se ve en vertical, sobre un brazo.
  Cámara fija donde exista la opción: el plano está anclado al tatuaje; un
  paneo del generador se sentiría como si el tatuaje se moviera solo.
*/
const PERFILES = {
  '/bytedance/seedance/v1/lite/image-to-video': (prompt, image_url) => ({
    prompt, image_url,
    duration: Math.min(12, Math.max(2, Math.round(DURACION))),
    resolution: '720', aspect_ratio: '9:16', camera_fixed: true,
  }),
  '/bytedance/seedance/v1/pro/fast/image-to-video': (prompt, image_url) => ({
    prompt, image_url,
    duration: Math.min(12, Math.max(2, Math.round(DURACION))),
    resolution: '720', aspect_ratio: '9:16', camera_fixed: true,
  }),
  '/veo3.1/image-to-video': (prompt, image_url) => ({
    prompt, image_url,
    duration: String([4, 6, 8].reduce((a, b) => Math.abs(b - DURACION) < Math.abs(a - DURACION) ? b : a)),
    resolution: '720', aspect_ratio: '9:16', generate_audio: false,
  }),
  '/veo3.1/fast/image-to-video': (prompt, image_url) => ({
    prompt, image_url,
    duration: String([4, 6, 8].reduce((a, b) => Math.abs(b - DURACION) < Math.abs(a - DURACION) ? b : a)),
    resolution: '720', aspect_ratio: '9:16', generate_audio: false,
  }),
  '/kling-video/v2.5-turbo/standard/image-to-video': (prompt, image_url) => ({
    prompt, image_url, duration: DURACION <= 5 ? 5 : 10, cfg_scale: 0.5, negative_prompt: '',
  }),
}

function cabeceras() {
  if (!higgsfieldConfigurado) {
    const e = new Error('Faltan HIGGSFIELD_KEY_ID o HIGGSFIELD_KEY_SECRET en el entorno del worker')
    e.codigo = 'no_configurado'
    e.status = 503
    throw e
  }
  return { Authorization: `Key ${ID}:${SECRET}`, 'Content-Type': 'application/json' }
}

/**
 * Envía la generación. Devuelve el `request_id` en cuanto la API la acepta.
 * @param {{ prompt: string, imageUrl: string }} datos
 * @returns {Promise<{ requestId: string }>}
 */
export async function enviar({ prompt, imageUrl }) {
  const cuerpo = PERFILES[ENDPOINT]
  if (!cuerpo) {
    throw new Error(`HIGGSFIELD_ENDPOINT no reconocido: ${ENDPOINT}. Perfiles: ${Object.keys(PERFILES).join(', ')}`)
  }

  const res = await fetch(`${BASE}${ENDPOINT}`, {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify(cuerpo(prompt, imageUrl)),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    // `detail` es donde la API pone el motivo; sin él, al menos el status
    throw new Error(`Higgsfield respondió ${res.status}: ${json?.detail ?? JSON.stringify(json) ?? res.statusText}`)
  }
  if (!json?.request_id) {
    throw new Error(`Higgsfield aceptó pero no devolvió request_id: ${JSON.stringify(json)}`)
  }
  return { requestId: json.request_id }
}

/**
 * Estado actual de una petición.
 * @returns {Promise<{ status: string, videoUrl: string|null, error: string|null }>}
 */
export async function estado(requestId) {
  const res = await fetch(`${BASE}/requests/${requestId}/status`, { headers: cabeceras() })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(`Estado ${requestId}: ${res.status} ${json?.detail ?? ''}`)
  }
  return {
    status: json?.status ?? 'unknown',
    videoUrl: json?.video?.url ?? null,
    error: json?.error ?? null,
  }
}

const TERMINALES = new Set(['completed', 'failed', 'nsfw', 'canceled'])

/**
 * Sondea hasta un estado terminal.
 *
 * Un fallo de red en un sondeo NO termina la espera: la petición sigue viva
 * en Higgsfield y el siguiente intento puede verla. Solo cuenta el tiempo.
 *
 * @param {string} requestId
 * @param {object} [opciones]
 * @param {number} [opciones.intervaloMs=5000]
 * @param {number} [opciones.maxMs=900000] - 15 min. Después se declara fallo
 *   (y quien llama reembolsa): un video que tarda eso no va a llegar.
 * @param {(status: string) => void} [opciones.onEstado]
 */
export async function esperar(requestId, opciones = {}) {
  const { intervaloMs = 5000, maxMs = 15 * 60 * 1000, onEstado } = opciones
  const inicio = Date.now()
  let ultimo = null

  while (Date.now() - inicio < maxMs) {
    try {
      const r = await estado(requestId)
      if (r.status !== ultimo) {
        ultimo = r.status
        onEstado?.(r.status)
      }
      if (TERMINALES.has(r.status)) return r
    } catch (err) {
      console.warn(`[higgsfield ${requestId}] sondeo falló, se reintenta:`, err.message)
    }
    await new Promise((r) => setTimeout(r, intervaloMs))
  }

  return { status: 'timeout', videoUrl: null, error: `Sin respuesta terminal en ${Math.round(maxMs / 60000)} min` }
}

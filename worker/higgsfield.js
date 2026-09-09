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
 * ── Por qué el endpoint es configurable, y por qué importa MÁS de lo que parece ──
 * El catálogo del spec NO es el que tu cuenta puede usar. Verificado el 9 sep
 * 2026 contra la cuenta de InkAR: Seedance devuelve 404 `model_not_found` y
 * Veo 3.1 devuelve 503 `model_disabled`, aunque ambos estén documentados.
 * La disponibilidad depende del plan, así que el modelo tiene que poder
 * cambiarse por variable de entorno sin tocar código.
 *
 * ── Cómo saber qué modelos SÍ tienes, sin gastar ──
 *   node --env-file=.env modelos.js
 * Manda un cuerpo vacío a cada ruta: la API resuelve el modelo ANTES de
 * validar, así que 404 = no disponible, 400/422 = disponible. Cero costo.
 */

const BASE = 'https://api.higgsfield.ai'
const ID = process.env.HIGGSFIELD_KEY_ID
const SECRET = process.env.HIGGSFIELD_KEY_SECRET

export const higgsfieldConfigurado = Boolean(ID && SECRET)

/*
  Endpoint por defecto: MiniMax Hailuo-02 estándar.

  Se eligió por eliminación, con el barrido de disponibilidad del 9 sep 2026:
  Seedance (404) y Veo 3.1 (503) no están disponibles en esta cuenta. De los
  que sí responden —MiniMax 02 y 2.3, Kling 2.1 y 2.5, Wan 2.5— este es el
  más barato con imagen de entrada.
*/
export const ENDPOINT = process.env.HIGGSFIELD_ENDPOINT || '/minimax/hailuo-02/standard/image-to-video'
const DURACION = Number(process.env.HIGGSFIELD_DURACION || 6)

/*
  Cuerpo de la petición por endpoint, leído del openapi.json real (no de un
  resumen: la primera versión de este archivo se escribió desde uno y los
  perfiles salieron mal).

  Cada familia usa tipos distintos para lo mismo: MiniMax quiere la duración en
  un enum de enteros {6,10} y la resolución como "768P"; Kling usa {5,10}; Veo
  la quiere como CADENA de {"4","6","8"} y exige generate_audio. Mezclarlos da
  400 o 422 sin explicación útil.

  Y no todos aceptan aspect_ratio: MiniMax y Kling heredan la proporción de la
  imagen de entrada. Por eso la vertical no se puede dar por hecha en el
  perfil — sale de la foto que suba el usuario.
*/
const PERFILES = {
  /*
    MiniMax Hailuo-02 y 2.3. NO aceptan aspect_ratio: la proporción del video
    la hereda de la foto de entrada. Para nosotros funciona — la foto del
    recuerdo la toma el usuario con su teléfono, casi siempre vertical.

    prompt_optimizer va en FALSE a propósito. Por defecto reescribe el prompt,
    y ahí se pierde la instrucción del fondo verde plano de la que depende
    TODO el recorte de croma (ver videoLayer.js). Mejor un prompt literal que
    uno bonito que devuelva un fondo de bosque.
  */
  '/minimax/hailuo-02/standard/image-to-video': (prompt, image_url) => ({
    prompt, image_url,
    duration: DURACION > 8 ? 10 : 6,   // enum cerrado: 6 o 10
    resolution: '768P',
    prompt_optimizer: false,
  }),
  '/minimax/hailuo-02/pro/image-to-video': (prompt, image_url) => ({
    prompt, image_url,
    duration: DURACION > 8 ? 10 : 6,
    resolution: '768P',
    prompt_optimizer: false,
  }),
  '/minimax/hailuo-2.3-fast/standard/image-to-video': (prompt, image_url) => ({
    prompt, image_url,
    duration: DURACION > 8 ? 10 : 6,
    resolution: '768P',
    prompt_optimizer: false,
  }),
  '/minimax/hailuo-2.3/standard/image-to-video': (prompt, image_url) => ({
    prompt, image_url,
    duration: DURACION > 8 ? 10 : 6,
    resolution: '768P',
    prompt_optimizer: false,
  }),

  // Kling: duración en enum 5|10, sin aspect_ratio en imagen-a-video.
  // cfg_scale 0.5 es el valor por defecto de la API; se deja explícito.
  '/kling-video/v2.5-turbo/standard/image-to-video': (prompt, image_url) => ({
    prompt, image_url, duration: DURACION > 7 ? 10 : 5, cfg_scale: 0.5, negative_prompt: '',
  }),
  '/kling-video/v2.1/standard/image-to-video': (prompt, image_url) => ({
    prompt, image_url, duration: DURACION > 7 ? 10 : 5, cfg_scale: 0.5, negative_prompt: '',
  }),

  '/wan-25-preview/image-to-video': (prompt, image_url) => ({ prompt, image_url }),

  /*
    Veo 3.1 — hoy 503 model_disabled en esta cuenta, pero se conserva el perfil:
    es el único con aspect_ratio explícito, y si el plan cambia es el candidato
    natural para vertical garantizado.
  */
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
}

/*
  Fallos que NO son culpa del usuario y hay que distinguir en los registros:
  su crédito se devuelve igual, pero a él no se le puede decir "tu foto falló"
  cuando lo que pasa es que NOSOTROS no tenemos saldo o el modelo no existe.
*/
const FALLOS_DE_CUENTA = {
  not_enough_credits: 'La cuenta de Higgsfield no tiene saldo. Recárgala en higgsfield.ai.',
  model_not_found: `El modelo ${'${ENDPOINT}'} no está disponible en esta cuenta. Corre modelos.js para ver cuáles sí.`,
  model_disabled: `El modelo ${'${ENDPOINT}'} está deshabilitado. Corre modelos.js para ver alternativas.`,
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
    const detalle = String(json?.detail ?? '')
    const nuestro = FALLOS_DE_CUENTA[detalle]
    if (nuestro) {
      const e = new Error(nuestro.replace('${ENDPOINT}', ENDPOINT))
      e.esDeCuenta = true   // para el registro: revisar la cuenta, no la foto
      throw e
    }
    // `detail` es donde la API pone el motivo; sin él, al menos el status
    throw new Error(`Higgsfield respondió ${res.status}: ${detalle || JSON.stringify(json) || res.statusText}`)
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

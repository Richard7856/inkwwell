import { supabase } from './supabase.js'
import { COMPILER_URL, COMMON_HEADERS } from './compiler.js'

/**
 * Generación de video: foto + historia → video anclado al tatuaje.
 *
 * ── Por qué el worker y no el cliente ──
 * La llave de Higgsfield no puede ir en el bundle, y una generación tarda
 * minutos: hay que sondear, descargar el video y guardarlo en nuestro Storage
 * (los de Higgsfield caducan a los 7 días). Eso lo hace el worker de Railway,
 * que ya existe y no tiene límite de tiempo. El cliente solo pide y espera.
 *
 * ── Por qué el crédito lo reserva el worker y no el cliente ──
 * Si el cliente descontara y luego la petición al worker fallara, el usuario
 * perdería un crédito por un tropiezo de red nuestro. El worker reserva y, si
 * la generación falla, reembolsa — todo del lado del servidor, con cerrojo.
 */

/** Error de generación ya interpretado, para que la pantalla diga qué hacer */
export class ErrorGeneracion extends Error {
  /** @param {'sin_creditos'|'sin_sesion'|'no_configurado'|'no_disponible'|'tatuaje_invalido'|'desconocido'} codigo */
  constructor(codigo, message) {
    super(message)
    this.codigo = codigo
  }
}

/*
  ── Disponibilidad: por qué se pregunta antes de ofrecer ──

  "Anima tu recuerdo" es lo que se vende y lo que cuesta un crédito. Si el
  generador está caído —sin saldo en Higgsfield, llaves ausentes en Railway, el
  modelo deshabilitado— ofrecerlo igual manda al usuario a subir una foto y
  escribir su historia para chocar con un error al final. El crédito se le
  devuelve (el worker reembolsa), pero el esfuerzo no.

  ── Por qué ante la duda se OFRECE ──
  El sondeo puede fallar por la red del usuario, no por el generador. Esconder
  el producto por un parpadeo de 4G sería peor que el error que se quiere
  evitar: se pierde una venta por algo que probablemente funcionaba. Solo se
  esconde cuando el worker lo dice explícitamente. Y como el guardia real está
  en el worker, esconderlo aquí es cortesía, no seguridad: un cliente viejo que
  no pregunte sigue recibiendo su 503 y su reembolso.

  ── Por qué se recuerda un rato ──
  Se consulta al llegar a la elección, que es un paso por el que se pasa varias
  veces al activar varios tatuajes. Un minuto de memoria evita repetir el
  sondeo sin ocultar un cambio real por mucho tiempo.
*/

const VIGENCIA_MS = 60 * 1000
const ESPERA_MS = 4000

let recordado = null // { valor, cuando }

/**
 * ¿Se puede generar video ahora? Consulta `/health` del worker.
 *
 * @param {{ forzar?: boolean }} [opciones]
 * @returns {Promise<{ disponible: boolean, motivo: 'ok'|'no_configurado'|'sin_saldo'|'modelo'|'desconocido' }>}
 */
export async function disponibilidadGeneracion({ forzar = false } = {}) {
  const ofrecer = { disponible: true, motivo: 'desconocido' }
  if (!COMPILER_URL) return { disponible: false, motivo: 'no_configurado' }

  if (!forzar && recordado && Date.now() - recordado.cuando < VIGENCIA_MS) {
    return recordado.valor
  }

  // Sin tiempo límite, una red que no responde dejaría la pantalla esperando
  // por una consulta que es opcional. Pasados 4 s se ofrece y ya.
  const corte = new AbortController()
  const reloj = setTimeout(() => corte.abort(), ESPERA_MS)

  try {
    const res = await fetch(`${COMPILER_URL}/health`, {
      headers: COMMON_HEADERS,
      signal: corte.signal,
    })
    if (!res.ok) return ofrecer

    const cuerpo = await res.json()
    // Worker anterior a la v4: no conoce el campo. Se ofrece, como siempre se hizo.
    if (!cuerpo?.generacion || typeof cuerpo.generacion.disponible !== 'boolean') return ofrecer

    const valor = {
      disponible: cuerpo.generacion.disponible,
      motivo: cuerpo.generacion.motivo ?? 'desconocido',
    }
    recordado = { valor, cuando: Date.now() }
    return valor
  } catch {
    // Red caída, CORS, tiempo agotado: no es evidencia de que el generador esté
    // mal, así que no se esconde el producto. Tampoco se recuerda este no-dato.
    return ofrecer
  } finally {
    clearTimeout(reloj)
  }
}

/** Olvida lo recordado — tras una compra o al reintentar a mano. */
export function olvidarDisponibilidad() {
  recordado = null
}

/**
 * Pide al worker que genere el video de un tatuaje.
 *
 * @param {object} datos
 * @param {string} datos.tattooId - Tatuaje ya creado (con su .mind subido)
 * @param {string} datos.fotoUrl - Foto del RECUERDO (la mascota, la persona), ya en Storage
 * @param {string} datos.historia - Qué debe pasar en el video, en palabras del usuario
 * @returns {Promise<{generacionId: string, saldo: number}>}
 */
export async function solicitarGeneracion({ tattooId, fotoUrl, historia }) {
  if (!supabase) throw new ErrorGeneracion('no_configurado', 'Supabase no configurado')
  if (!COMPILER_URL) throw new ErrorGeneracion('no_configurado', 'Worker no configurado (VITE_COMPILER_URL)')

  // El worker verifica este token contra Supabase: es lo que le dice a quién
  // cobrarle el crédito y de quién es el tatuaje
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new ErrorGeneracion('sin_sesion', 'Inicia sesión para generar tu video')

  const res = await fetch(`${COMPILER_URL}/generar`, {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ tattooId, fotoUrl, historia: historia.trim() }),
  })

  const cuerpo = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ErrorGeneracion(
      cuerpo?.codigo ?? 'desconocido',
      cuerpo?.error ?? `El worker respondió ${res.status}`
    )
  }
  return cuerpo
}

/**
 * Espera a que una generación termine, informando cada cambio de estado.
 *
 * Se sondea la tabla `generaciones` (el usuario lee sus propias filas por
 * política) en vez de mantener una conexión con el worker: si la app se cierra
 * a media espera, el worker sigue y el video llega igual; al volver, se lee el
 * estado final de la base.
 *
 * @param {string} generacionId
 * @param {object} [opciones]
 * @param {(estado: string) => void} [opciones.onEstado]
 * @param {number} [opciones.intervaloMs=4000]
 * @param {number} [opciones.maxMs=600000] - 10 minutos; después se deja de esperar
 *   pero NO se declara fallo: el video puede llegar más tarde.
 * @returns {Promise<{estado: string, videoUrl: string|null, error: string|null, agotado: boolean}>}
 */
export async function esperarGeneracion(generacionId, opciones = {}) {
  const { onEstado, intervaloMs = 4000, maxMs = 10 * 60 * 1000 } = opciones
  const inicio = Date.now()
  let ultimo = null

  while (Date.now() - inicio < maxMs) {
    const { data, error } = await supabase
      .from('generaciones')
      .select('estado, video_url, error')
      .eq('id', generacionId)
      .maybeSingle()

    if (!error && data) {
      if (data.estado !== ultimo) {
        ultimo = data.estado
        onEstado?.(data.estado)
      }
      if (data.estado === 'lista' || data.estado === 'fallida' || data.estado === 'rechazada') {
        return { estado: data.estado, videoUrl: data.video_url, error: data.error, agotado: false }
      }
    }
    // Un error de lectura a media espera no cancela la espera: el worker
    // sigue su curso y el siguiente sondeo puede verlo
    await new Promise((r) => setTimeout(r, intervaloMs))
  }

  return { estado: ultimo ?? 'pendiente', videoUrl: null, error: null, agotado: true }
}

/** Última generación de un tatuaje, para retomar la espera al volver a la app */
export async function ultimaGeneracion(tattooId) {
  if (!supabase) return null
  const { data } = await supabase
    .from('generaciones')
    .select('id, estado, video_url, error, created_at')
    .eq('tattoo_id', tattooId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

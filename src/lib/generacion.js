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
  /** @param {'sin_creditos'|'sin_sesion'|'no_configurado'|'tatuaje_invalido'|'desconocido'} codigo */
  constructor(codigo, message) {
    super(message)
    this.codigo = codigo
  }
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

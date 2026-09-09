/**
 * Acceso a Supabase desde el worker, con la llave de SERVICIO.
 *
 * ── Por qué el worker necesita la llave de servicio ──
 * Reservar un crédito en nombre de un usuario, escribir en `generaciones` y
 * subir a Storage son operaciones que el cliente NO puede hacer por diseño (la
 * llave anónima es pública). Solo un proceso de confianza, con esta llave,
 * puede hacerlas. Por eso esta llave vive en las variables de Railway y jamás
 * en el repo ni en el bundle.
 *
 * ── Por qué se verifica el JWT del usuario aunque tengamos la llave de servicio ──
 * La llave de servicio nos deja hacer todo, y justo por eso hay que saber CON
 * CERTEZA quién pide: el JWT de la sesión es lo que dice a quién cobrarle el
 * crédito y de quién es el tatuaje. Sin verificarlo, cualquiera con la URL del
 * worker generaría videos con los créditos de otro.
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const LLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseConfigurado = Boolean(URL && LLAVE)

const admin = supabaseConfigurado
  ? createClient(URL, LLAVE, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

/** Error con código estable, para que el endpoint responda con el status correcto */
export class ErrorGeneracion extends Error {
  constructor(codigo, message, status = 500) {
    super(message)
    this.codigo = codigo
    this.status = status
  }
}

function exigirAdmin() {
  if (!admin) {
    throw new ErrorGeneracion(
      'no_configurado',
      'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno del worker',
      503,
    )
  }
  return admin
}

/**
 * Devuelve el id del usuario dueño del JWT, o lanza si no es válido.
 * @param {string|undefined} authorization - Cabecera `Bearer <jwt>`
 */
export async function verificarUsuario(authorization) {
  const jwt = (authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) throw new ErrorGeneracion('sin_sesion', 'Falta el token de sesión', 401)

  const { data, error } = await exigirAdmin().auth.getUser(jwt)
  if (error || !data?.user) {
    throw new ErrorGeneracion('sin_sesion', 'La sesión no es válida o expiró', 401)
  }
  return data.user.id
}

/** Comprueba que el tatuaje exista y sea del usuario. Devuelve la fila. */
export async function tatuajeDelUsuario(userId, tattooId) {
  const { data, error } = await exigirAdmin()
    .from('tattoos')
    .select('id, user_id, image_url')
    .eq('id', tattooId)
    .maybeSingle()

  if (error) throw new ErrorGeneracion('desconocido', `No se pudo leer el tatuaje: ${error.message}`)
  if (!data || data.user_id !== userId) {
    // Mismo mensaje exista o no: no se le confirma a un tercero que el id es real
    throw new ErrorGeneracion('tatuaje_invalido', 'Ese tatuaje no existe o no es tuyo', 404)
  }
  return data
}

export async function crearGeneracion({ userId, tattooId, modelo, fotoUrl, historia }) {
  const { data, error } = await exigirAdmin()
    .from('generaciones')
    .insert({ user_id: userId, tattoo_id: tattooId, modelo, foto_url: fotoUrl, historia })
    .select('id')
    .single()

  if (error) throw new ErrorGeneracion('desconocido', `No se pudo registrar la generación: ${error.message}`)
  return data.id
}

/**
 * Reserva el crédito. Lanza `sin_creditos` si no alcanza.
 * La función de la base lleva cerrojo por usuario e idempotencia por generación.
 */
export async function reservarCredito(userId, generacionId) {
  const { data, error } = await exigirAdmin().rpc('reservar_credito_generacion', {
    p_user: userId,
    p_generacion: generacionId,
  })
  if (error) {
    if (error.code === 'P0001') {
      throw new ErrorGeneracion('sin_creditos', 'No tienes créditos suficientes', 402)
    }
    throw new ErrorGeneracion('desconocido', `No se pudo reservar el crédito: ${error.message}`)
  }
  return data
}

/** Devuelve el crédito. Nunca lanza: un fallo aquí se registra, no tumba el flujo. */
export async function reembolsar(userId, generacionId) {
  const { error } = await exigirAdmin().rpc('reembolsar_generacion', {
    p_user: userId,
    p_generacion: generacionId,
  })
  if (error) console.error(`[generacion ${generacionId}] NO se pudo reembolsar:`, error.message)
}

export async function actualizarGeneracion(id, cambios) {
  const { error } = await exigirAdmin()
    .from('generaciones')
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) console.error(`[generacion ${id}] no se pudo actualizar:`, error.message)
}

/**
 * Sube el video terminado a nuestro Storage y devuelve la URL pública.
 * Se copia porque los archivos de Higgsfield caducan a los 7 días.
 */
export async function subirVideo(generacionId, buffer, contentType = 'video/mp4') {
  const path = `generados/${generacionId}.mp4`
  const { error } = await exigirAdmin().storage
    .from('videos')
    .upload(path, buffer, { contentType, upsert: true })
  if (error) throw new ErrorGeneracion('desconocido', `No se pudo guardar el video: ${error.message}`)

  const { data } = exigirAdmin().storage.from('videos').getPublicUrl(path)
  return data.publicUrl
}

/**
 * El tatuaje pasa a mostrar el video. Se vacía glb_url a propósito: un tatuaje
 * lleva video O modelo, nunca ambos (regla 6 de CLAUDE.md).
 */
export async function asignarVideoAlTatuaje(tattooId, videoUrl) {
  const { error } = await exigirAdmin()
    .from('tattoos')
    .update({ video_url: videoUrl, glb_url: null })
    .eq('id', tattooId)
  if (error) throw new ErrorGeneracion('desconocido', `No se pudo asignar el video al tatuaje: ${error.message}`)
}

/** Generaciones aceptadas por Higgsfield que aún no llegaron a estado terminal */
export async function generacionesEnCurso() {
  const { data, error } = await exigirAdmin()
    .from('generaciones')
    .select('id, user_id, tattoo_id, request_id')
    .in('estado', ['pendiente', 'en_proceso'])
    .not('request_id', 'is', null)
  if (error) throw new ErrorGeneracion('desconocido', `No se pudieron leer las generaciones en curso: ${error.message}`)
  return data ?? []
}

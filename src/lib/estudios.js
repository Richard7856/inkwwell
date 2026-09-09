import { supabase } from './supabase.js'

/**
 * Estudios de tatuaje: el canal de distribución.
 *
 * ── Por qué el estudio elige su código ──
 * El código se dicta de viva voz en el estudio, con la tinta fresca. "Pon
 * TINTA" se recuerda; "pon 7K2MX9" no. De que se recuerde depende que se use,
 * y de que se use depende que el estudio cobre — y que siga promoviendo.
 *
 * ── Por qué la atribución es permanente ──
 * El estudio que trajo al cliente lo conserva. Si otro código pudiera
 * sobreescribirlo después, se abriría la puerta a robar atribuciones, y el
 * primer estudio dejaría de confiar en el sistema. Ver `atribuir_estudio` en
 * la migración 008.
 */

// El código de estudio se guarda aquí hasta que exista sesión para aplicarlo:
// llega por URL o por el formulario ANTES de que el usuario esté identificado.
const CLAVE_PENDIENTE = 'inkar.estudio-pendiente'

/** Errores que la base nombra para que la pantalla diga qué hacer */
const MENSAJES = {
  codigo_ocupado: 'Ese código ya está tomado. Prueba otro.',
  codigo_invalido: 'El código debe tener de 4 a 12 letras o números, sin espacios.',
  contacto_invalido: 'Revisa el correo.',
  nombre_invalido: 'Escribe el nombre del estudio.',
}

function traducirError(error) {
  const clave = Object.keys(MENSAJES).find((k) => error.message?.includes(k))
  return new Error(clave ? MENSAJES[clave] : `No se pudo registrar el estudio: ${error.message}`)
}

/**
 * Da de alta un estudio desde la landing. No pide sesión.
 *
 * @param {object} datos
 * @param {string} datos.nombre
 * @param {string} datos.contacto - Correo
 * @param {string} datos.codigo - El que el estudio quiere usar
 * @param {string} [datos.ciudad]
 * @returns {Promise<{codigo: string, fundador: boolean}>}
 */
export async function registrarEstudio({ nombre, contacto, codigo, ciudad = '' }) {
  if (!supabase) throw new Error('Supabase no configurado')

  const { data, error } = await supabase.rpc('registrar_estudio', {
    p_nombre: nombre,
    p_contacto: contacto,
    p_codigo: codigo,
    p_ciudad: ciudad,
  })
  if (error) throw traducirError(error)

  // La función devuelve una tabla de una fila
  const fila = Array.isArray(data) ? data[0] : data
  return { codigo: fila.codigo, fundador: fila.fundador }
}

/** Propuesta de código a partir del nombre: "Tinta Negra Studio" → "TINTANEGRA" */
export function sugerirCodigo(nombre) {
  return nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sin acentos
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
}

/** Guarda un código para aplicarlo en cuanto haya sesión */
export function recordarCodigoPendiente(codigo) {
  try {
    localStorage.setItem(CLAVE_PENDIENTE, codigo.trim().toUpperCase())
  } catch { /* almacenamiento bloqueado: se pierde, no se rompe */ }
}

/** Lee el código pendiente sin borrarlo; lo borra quien lo aplica */
export function leerCodigoPendiente() {
  try {
    return localStorage.getItem(CLAVE_PENDIENTE) || null
  } catch {
    return null
  }
}

/**
 * Acredita al estudio en el perfil del usuario con sesión.
 *
 * Un código que no existe NO es un error: devuelve null y la pantalla lo dice
 * con suavidad. Es fácil teclearlo mal y no queremos que un dedazo bloquee el
 * registro.
 *
 * @param {string} codigo
 * @returns {Promise<string|null>} Nombre del estudio, o null si no existe
 */
export async function atribuirEstudio(codigo) {
  if (!supabase) throw new Error('Supabase no configurado')

  const { data, error } = await supabase.rpc('atribuir_estudio', { p_codigo: codigo })
  if (error) throw new Error(`No se pudo acreditar al estudio: ${error.message}`)

  // Con o sin acierto, ya se intentó: no se vuelve a aplicar en cada arranque
  try { localStorage.removeItem(CLAVE_PENDIENTE) } catch { /* nada */ }

  return data ?? null
}

/**
 * Aplica el código pendiente si lo hay. Pensado para llamarse justo después de
 * `ensureProfile()`: en ese punto ya hay sesión y perfil.
 *
 * Nunca lanza — acreditar a un estudio no puede impedir que el usuario active
 * su tatuaje. Si falla, se registra y se sigue.
 *
 * @returns {Promise<string|null>} Nombre del estudio acreditado, si hubo
 */
export async function aplicarCodigoPendiente() {
  const codigo = leerCodigoPendiente()
  if (!codigo) return null
  try {
    return await atribuirEstudio(codigo)
  } catch (err) {
    console.error('[estudios] no se aplicó el código pendiente:', err)
    return null
  }
}

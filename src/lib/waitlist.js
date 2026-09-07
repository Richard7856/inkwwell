import { supabase } from './supabase.js'

/**
 * Inscripción a la lista de espera desde la landing.
 *
 * No pide sesión a propósito: exigir cuenta para apuntarse a una lista mata la
 * conversión justo donde más importa, en el primer contacto.
 *
 * Las políticas de la base permiten INSERT a cualquiera pero NO SELECT, así que
 * desde el cliente se puede escribir en la lista y no leerla. Sin esa asimetría,
 * la llave anónima —que va pública en el bundle— expondría todos los correos.
 */

/**
 * @param {object} datos
 * @param {string} datos.email
 * @param {'persona'|'artista'} datos.perfil
 * @param {string} [datos.ciudad]
 * @param {string} [datos.source] - De dónde llegó (campaña, referido)
 * @returns {Promise<{yaEstaba: boolean}>}
 */
export async function inscribirEnLista({ email, perfil, ciudad = '', source = 'landing' }) {
  if (!supabase) throw new Error('Supabase no configurado')

  const { error } = await supabase.from('waitlist').insert({
    email: email.trim().toLowerCase(),
    perfil,
    ciudad: ciudad.trim() || null,
    source,
  })

  if (error) {
    /*
      23505 es violación de unicidad: ya se había inscrito.

      No es un error desde el punto de vista del usuario — hizo lo correcto y ya
      estaba dentro. Mostrarle "error al guardar" lo haría dudar de si quedó
      inscrito y probablemente reintentar. Se responde con éxito y una señal
      para que la pantalla lo diga con otras palabras.
    */
    if (error.code === '23505') return { yaEstaba: true }
    throw new Error(`No se pudo guardar tu correo: ${error.message}`)
  }

  return { yaEstaba: false }
}

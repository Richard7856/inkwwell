import { supabase } from './supabase.js'

/**
 * Pide el borrado de la cuenta y de todos los datos del usuario en sesión.
 *
 * No recibe correo ni identificador a propósito: la función del servidor borra
 * al dueño del token de sesión. Si aceptara un correo, cualquiera podría pedir
 * el borrado de la cuenta de otra persona.
 *
 * @returns {Promise<{alcance: 'completo'|'solo_inkar', tatuajes: number, archivos: number, mensaje: string}>}
 */
export async function eliminarMiCuenta() {
  if (!supabase) throw new Error('Supabase no configurado')

  const { data, error } = await supabase.functions.invoke('eliminar-cuenta', { method: 'POST' })

  if (error) {
    /*
      invoke() envuelve los errores HTTP y deja el mensaje real dentro de la
      respuesta cruda. Sin desenvolverlo, el usuario solo vería
      "Edge Function returned a non-2xx status code" — inútil para saber qué
      pasó y, peor aún, para saber si sus datos se borraron o no.
    */
    let detalle = error.message
    try {
      const cuerpo = await error.context?.json()
      if (cuerpo?.error) detalle = cuerpo.error
    } catch { /* la respuesta no era JSON; queda el mensaje genérico */ }
    throw new Error(detalle)
  }

  /*
    Cerrar sesión en el dispositivo después de borrar.

    El token sigue guardado en local aunque la cuenta ya no exista, y la app lo
    seguiría presentando como sesión válida hasta que venza: el usuario vería su
    cuenta "viva" justo después de que le confirmamos que la borramos.
    Se ignora el fallo — la cuenta ya no existe, que el cierre local falle no
    cambia el resultado.
  */
  await supabase.auth.signOut().catch(() => {})

  return data
}

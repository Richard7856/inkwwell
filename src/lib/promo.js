import { supabase } from './supabase.js'

/**
 * Canje de códigos promocionales.
 *
 * Un código regala créditos. Es la "prueba gratis" que exigen las reglas del
 * Shipaton —los jueces no van a pagar para calificar— y la forma en que un
 * estudio le muestra el producto a un cliente sin cobrarle.
 *
 * Toda la validación vive en la base (`canjear_codigo`, migración 008): si
 * existe, si está activo, si quedan usos, si este usuario ya lo canjeó. El
 * cliente solo traduce el resultado a palabras.
 */

const MENSAJES = {
  codigo_invalido: 'Ese código no existe o ya no está activo.',
  codigo_agotado: 'Ese código ya se agotó.',
  codigo_ya_canjeado: 'Ya usaste ese código.',
}

/**
 * @param {string} codigo
 * @returns {Promise<number>} Créditos otorgados
 */
export async function canjearCodigo(codigo) {
  if (!supabase) throw new Error('Supabase no configurado')

  const { data, error } = await supabase.rpc('canjear_codigo', { p_codigo: codigo })
  if (error) {
    const clave = Object.keys(MENSAJES).find((k) => error.message?.includes(k))
    throw new Error(clave ? MENSAJES[clave] : `No se pudo canjear el código: ${error.message}`)
  }
  return data
}

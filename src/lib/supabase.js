import { createClient } from '@supabase/supabase-js'

// Singleton Supabase client — env vars loaded from .env at build time
// Phase 1: estas vars pueden estar vacías, el demo funciona sin backend
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

/**
 * Crea un registro de tatuaje en la tabla `tattoos`.
 *
 * El UUID que devuelve identifica al tatuaje y se usa en la URL de escaneo.
 *
 * @param {object} datos
 * @param {string} datos.imageUrl
 * @param {string} datos.mindUrl
 * @param {string} datos.glbUrl
 * @param {string|null} [datos.userId] - Dueño del tatuaje. Las políticas de la
 *   base exigen que coincida con la sesión activa; enviarlo distinto es
 *   rechazado por el servidor, no solo por el cliente.
 * @param {number} [datos.targetIndex] - Posición dentro del .mind combinado
 * @returns {Promise<string>} UUID del tatuaje recién creado
 */
export async function createTattoo({ imageUrl, mindUrl, glbUrl, userId = null, targetIndex = 0 }) {
  if (!supabase) {
    throw new Error('Supabase no configurado. Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY a .env')
  }

  const { data, error } = await supabase
    .from('tattoos')
    .insert({
      image_url: imageUrl,
      mind_url: mindUrl,
      glb_url: glbUrl,
      is_active: true,
      user_id: userId,
      target_index: targetIndex,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Error guardando tatuaje: ${error.message}`)
  }

  // Retornar solo el UUID — es lo que el frontend necesita para construir el link
  return data.id
}

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
 * En Phase 1 no hay auth, por lo tanto user_id queda null.
 * El UUID generado por Supabase es el "identificador" del tatuaje
 * y se usa como parámetro en la URL de escaneo: /scan?tattoo=<uuid>
 *
 * @param {{ imageUrl: string, mindUrl: string, glbUrl: string }} tattooData
 * @returns {Promise<string>} UUID del tatuaje recién creado
 */
export async function createTattoo({ imageUrl, mindUrl, glbUrl }) {
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
      // user_id: null — Phase 1 sin auth. Phase 2: pasar el user id de Supabase Auth
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Error guardando tatuaje: ${error.message}`)
  }

  // Retornar solo el UUID — es lo que el frontend necesita para construir el link
  return data.id
}

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
 * @param {object|null} [datos.metrics] - Métricas del analizador. Puede venir
 *   nula si el worker no midió (endpoint de respaldo o worker viejo); en ese
 *   caso las columnas de calidad quedan nulas, que significa "no medido" — no
 *   se confunde con "medido y salió mal", que se guarda como 'malo'.
 * @param {boolean} [datos.overridden] - El usuario activó pese a la advertencia
 * @returns {Promise<string>} UUID del tatuaje recién creado
 */
export async function createTattoo({
  imageUrl,
  mindUrl,
  glbUrl,
  userId = null,
  targetIndex = 0,
  metrics = null,
  overridden = false,
}) {
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
      quality_level: metrics?.verdict?.level ?? null,
      quality_tracking_fill: metrics?.tracking?.fillRatio ?? null,
      quality_metrics: metrics,
      quality_overridden: overridden,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Error guardando tatuaje: ${error.message}`)
  }

  // Retornar solo el UUID — es lo que el frontend necesita para construir el link
  return data.id
}

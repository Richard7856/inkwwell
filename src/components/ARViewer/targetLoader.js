/**
 * Fuente de verdad para resolver qué .mind y GLB corresponde a cada tatuaje.
 * Phase 1: rutas hardcodeadas en /public/
 * Phase 2: consulta Supabase por tattoo_id y devuelve URLs de Storage
 */
import { supabase } from '../../lib/supabase.js'

// Phase 1 — assets estáticos del demo
const DEMO_TARGETS = {
  default: {
    mindUrl: '/targets/tattoo-demo.mind',
    glbUrl: '/models/alaskan_malamute_dog.glb',
  },
}

/**
 * Resuelve las URLs del .mind y GLB para un tatuaje.
 * @param {string} tattooId - ID del tatuaje o 'default' para el demo
 * @returns {{ mindUrl: string, glbUrl: string }}
 */
export async function loadTarget(tattooId = 'default') {
  // Phase 1: usar assets hardcodeados
  if (DEMO_TARGETS[tattooId]) {
    return DEMO_TARGETS[tattooId]
  }

  // Phase 2: buscar en Supabase
  if (!supabase) {
    throw new Error(`Tatuaje "${tattooId}" no encontrado y Supabase no está configurado`)
  }

  const { data, error } = await supabase
    .from('tattoos')
    .select('mind_url, glb_url')
    .eq('id', tattooId)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    throw new Error(`Tatuaje "${tattooId}" no encontrado: ${error?.message}`)
  }

  return {
    mindUrl: data.mind_url,
    glbUrl: data.glb_url,
  }
}

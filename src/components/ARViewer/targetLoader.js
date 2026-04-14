/**
 * Fuente de verdad para resolver qué .mind y GLB corresponde a cada tatuaje.
 * Phase 1: rutas hardcodeadas en /public/ para el demo
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
 *
 * ¿Por qué validar que el .mind existe antes de devolver la URL?
 * MindAR intenta parsear el archivo como msgpack binario. Si la URL devuelve
 * un 404 (HTML), el parser lanza un RangeError críptico en lugar de un error
 * legible. Validar aquí permite mostrar un mensaje claro al usuario.
 *
 * @param {string} tattooId - ID del tatuaje o 'default' para el demo
 * @returns {Promise<{ mindUrl: string, glbUrl: string }>}
 */
export async function loadTarget(tattooId = 'default') {
  // Phase 1: usar assets hardcodeados del demo
  if (DEMO_TARGETS[tattooId]) {
    const target = DEMO_TARGETS[tattooId]

    // Validar que el .mind existe antes de pasárselo a MindAR.
    // HEAD request es suficiente — solo necesitamos el status code, no el body.
    try {
      const res = await fetch(target.mindUrl, { method: 'HEAD' })
      if (!res.ok) {
        throw new Error(
          'El archivo de demo no está compilado aún. ' +
          'Ve a /activate para activar tu tatuaje primero.'
        )
      }
    } catch (err) {
      // Re-lanzar errores con mensaje claro (incluyendo el nuestro de arriba)
      if (err.message.includes('activar')) throw err
      throw new Error(
        'No se pudo verificar el archivo de demo. ' +
        'Verifica tu conexión e intenta de nuevo.'
      )
    }

    return target
  }

  // Phase 2: buscar en Supabase por UUID del tatuaje
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
    throw new Error(`Tatuaje "${tattooId}" no encontrado: ${error?.message ?? 'sin datos'}`)
  }

  return {
    mindUrl: data.mind_url,
    glbUrl: data.glb_url,
  }
}

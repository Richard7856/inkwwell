/**
 * Resuelve qué .mind y qué modelos 3D corresponden a lo que se va a escanear.
 *
 * Un .mind puede contener VARIOS tatuajes (targets). Cada uno tiene su propio
 * modelo 3D, y su posición dentro del archivo (targetIndex) es lo que los
 * relaciona: el target 0 del .mind usa targets[0].glbUrl, y así.
 */
import { supabase } from '../../lib/supabase.js'

/*
  Demo multi-tatuaje.

  TEMPORAL: sirve para validar que MindAR distingue entre dos tatuajes reales
  antes de construir perfiles, links y toda la capa de producto encima. El .mind
  se armó fusionando los archivos ya compilados de cada tatuaje, sin recompilar.

  Se retira cuando exista el perfil de usuario, que resolverá esto mismo desde
  la base de datos.
*/
const DEMO_MULTI = {
  mindUrl: 'https://duzfvyfhsvhavptuxehi.supabase.co/storage/v1/object/public/mind-files/compiled/multi-demo-1788750830.mind',
  targets: [
    { glbUrl: '/models/shiba_negro.glb', label: 'Huella' },
    { glbUrl: '/models/Fenix.glb', label: 'Esqueleto' },
  ],
}

/*
  Demo público con marcador universal.

  El problema que resuelve: nadie que llega a la landing tiene un tatuaje
  activado, y los jueces del concurso tampoco tienen tatuajes. Sin esto, la
  única forma de conocer el producto es que alguien te lo cuente.

  El marcador es una imagen ornamental generada a propósito y medida con el
  analizador del worker: veredicto BUENO, 3440 puntos de detección y 33% de
  seguimiento — mejor que los tatuajes reales con los que se validó el sistema.
  Se sirve desde /public para que funcione sin red dentro del APK.
*/
const DEMO_MARCADOR = {
  mindUrl: '/targets/demo.mind',
  targets: [{ glbUrl: '/models/Fenix.glb', label: 'Fénix' }],
}

/**
 * @param {object} params
 * @param {string|null} params.tattooId - UUID de un tatuaje concreto
 * @param {string|null} params.demo - Nombre de un demo precargado
 * @returns {Promise<{ mindUrl: string, targets: {glbUrl: string, label?: string}[] }>}
 */
export async function loadTarget({ tattooId = null, demo = null } = {}) {
  if (demo === 'multi') return DEMO_MULTI
  if (demo === 'marcador') return DEMO_MARCADOR

  if (!tattooId) {
    throw new Error('No se indicó qué tatuaje escanear')
  }

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

  // Un tatuaje suelto es el caso de un solo target — misma estructura, un
  // elemento. Así el visor no necesita dos caminos distintos.
  return {
    mindUrl: data.mind_url,
    targets: [{ glbUrl: data.glb_url }],
  }
}

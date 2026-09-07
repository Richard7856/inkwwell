/**
 * Perfil de Inkwell del usuario: su link compartible y el .mind con todos sus
 * tatuajes.
 *
 * El perfil se crea desde aquí y NO con un disparador sobre auth.users, porque
 * este proyecto de Supabase se comparte con otra aplicación: un disparador se
 * ejecutaría también con las altas de esa app y generaría perfiles de gente que
 * nunca usó Inkwell.
 */
import { supabase } from './supabase.js'

/*
  Longitud del identificador compartible.

  7 caracteres en base 36 dan ~78 mil millones de combinaciones: suficiente para
  que las colisiones sean anecdóticas, y corto para que el link se pueda dictar
  de viva voz o escribir a mano sin equivocarse.
*/
const SLUG_LENGTH = 7

function generateSlug() {
  // Se excluyen las letras que se confunden al leer o dictar: i, l, o
  const alfabeto = 'abcdefghjkmnpqrstuvwxyz23456789'
  let s = ''
  const random = crypto.getRandomValues(new Uint32Array(SLUG_LENGTH))
  for (let i = 0; i < SLUG_LENGTH; i++) s += alfabeto[random[i] % alfabeto.length]
  return s
}

/**
 * Devuelve el perfil del usuario, creándolo si es su primera vez.
 *
 * @param {{id: string}} user - Usuario de Supabase Auth
 * @returns {Promise<{id, share_slug, mind_url, username}>}
 */
export async function ensureProfile(user) {
  if (!supabase) throw new Error('Supabase no configurado')

  const { data: existente, error: errorLectura } = await supabase
    .from('users')
    .select('id, share_slug, mind_url, username')
    .eq('id', user.id)
    .maybeSingle()

  if (errorLectura) throw new Error(`No se pudo leer el perfil: ${errorLectura.message}`)
  if (existente) return existente

  /*
    Reintento por colisión de slug.

    El slug tiene restricción de unicidad en la base. La probabilidad de choque
    es mínima, pero si ocurriera sin reintento el usuario quedaría sin poder
    entrar y con un error incomprensible. El código 23505 es violación de unicidad.
  */
  for (let intento = 0; intento < 5; intento++) {
    const { data, error } = await supabase
      .from('users')
      .insert({ id: user.id, share_slug: generateSlug() })
      .select('id, share_slug, mind_url, username')
      .single()

    if (!error) return data
    if (error.code !== '23505') {
      throw new Error(`No se pudo crear el perfil: ${error.message}`)
    }
    // 23505 también se dispara si el perfil ya existía (carrera entre dos
    // pestañas): se vuelve a leer antes de insistir con otro slug
    const { data: recuperado } = await supabase
      .from('users')
      .select('id, share_slug, mind_url, username')
      .eq('id', user.id)
      .maybeSingle()
    if (recuperado) return recuperado
  }

  throw new Error('No se pudo generar un identificador único para tu perfil')
}

/** Tatuajes del usuario, en el orden que ocupan dentro del .mind combinado */
export async function getMyTattoos(userId) {
  if (!supabase) throw new Error('Supabase no configurado')
  const { data, error } = await supabase
    .from('tattoos')
    .select('id, image_url, glb_url, target_index, created_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('target_index', { ascending: true })

  if (error) throw new Error(`No se pudieron cargar tus tatuajes: ${error.message}`)
  return data ?? []
}

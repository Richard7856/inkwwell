import { supabase } from './supabase.js'

/**
 * Sube una imagen de tatuaje a Supabase Storage y devuelve la URL pública.
 *
 * Bucket: tattoo-images (debe crearse en Supabase Dashboard con acceso público).
 * Naming: timestamp + random suffix para evitar colisiones sin requerir auth/user_id.
 *
 * @param {File} file - Archivo de imagen (JPG/PNG)
 * @returns {Promise<{ url: string, path: string }>} URL pública y path en storage
 */
export async function uploadTattooImage(file) {
  if (!supabase) {
    throw new Error('Supabase no configurado. Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY a .env')
  }

  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const path = `uploads/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('tattoo-images')
    .upload(path, file, {
      contentType: file.type,
      // upsert false — cada foto es única, nunca sobreescribir
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Error subiendo imagen: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('tattoo-images')
    .getPublicUrl(path)

  return {
    url: urlData.publicUrl,
    path,
  }
}

/**
 * Sube el archivo .mind compilado a Supabase Storage y devuelve la URL pública.
 *
 * Bucket: mind-files (debe crearse en Supabase Dashboard con acceso público).
 * El .mind llega como ArrayBuffer o Blob desde el worker — se sube tal cual.
 *
 * ¿Por qué bucket separado de tattoo-images?
 * Los .mind son assets técnicos (binarios pesados, ~500KB-2MB) que solo consulta
 * el ARViewer. Tenerlos separados facilita políticas de acceso y cleanup independiente.
 *
 * @param {ArrayBuffer | Blob} mindData - Datos binarios del .mind compilado
 * @returns {Promise<{ url: string, path: string }>} URL pública y path en storage
 */
export async function uploadMindFile(mindData) {
  if (!supabase) {
    throw new Error('Supabase no configurado. Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY a .env')
  }

  // Nombre único igual que uploadTattooImage — sin requerir UUID previo
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mind`
  const path = `compiled/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('mind-files')
    .upload(path, mindData, {
      contentType: 'application/octet-stream',
      // upsert false — cada .mind es único, nunca sobreescribir
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Error subiendo .mind: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('mind-files')
    .getPublicUrl(path)

  return {
    url: urlData.publicUrl,
    path,
  }
}

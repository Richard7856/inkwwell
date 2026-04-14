// Client para el worker de compilación .mind (Phase 2)
// Phase 1: compilación manual — este módulo es un placeholder

const COMPILER_URL = import.meta.env.VITE_COMPILER_URL || ''

/**
 * Envía la foto del tatuaje al worker y recibe el .mind compilado.
 * Phase 1: no implementado — retorna error descriptivo.
 */
export async function compileMindFile(imageFile) {
  if (!COMPILER_URL) {
    throw new Error(
      'Compilador .mind no configurado. Phase 1 usa archivos pre-compilados en /public/targets/'
    )
  }

  const formData = new FormData()
  formData.append('image', imageFile)

  const response = await fetch(`${COMPILER_URL}/compile`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Compilación fallida: ${response.status} ${response.statusText}`)
  }

  // Worker devuelve el .mind como binary blob
  return await response.arrayBuffer()
}

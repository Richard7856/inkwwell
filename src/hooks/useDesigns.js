import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Catálogo de GLBs disponibles.
 * Phase 1: datos estáticos (no hay Supabase).
 * Phase 2: carga de tabla `designs` con previews.
 */

const STATIC_DESIGNS = [
  {
    id: 'malamute',
    name: 'Alaskan Malamute',
    glb_url: '/models/alaskan_malamute_dog.glb',
    tier: 'catalog',
    preview_url: null,
  },
]

export function useDesigns() {
  const [designs, setDesigns] = useState(STATIC_DESIGNS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase) return

    setLoading(true)

    supabase
      .from('designs')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data?.length) setDesigns(data)
        setLoading(false)
      })
  }, [])

  return { designs, loading }
}

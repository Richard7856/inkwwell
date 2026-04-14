import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * CRUD de tatuajes en Supabase.
 * Phase 1: no-op (sin Supabase configurado).
 * Phase 2: operaciones reales contra la tabla `tattoos`.
 */
export function useTattoo(userId) {
  const [tattoos, setTattoos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!supabase || !userId) return

    setLoading(true)

    supabase
      .from('tattoos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setTattoos(data || [])
        setLoading(false)
      })
  }, [userId])

  return { tattoos, loading, error }
}

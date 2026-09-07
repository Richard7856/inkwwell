import { useEffect, useState } from 'react'
import { getSession, onAuthChange, signOut as doSignOut } from '../lib/auth.js'

/**
 * Estado de sesión del usuario.
 *
 * `loading` importa: al abrir la app la sesión se recupera del almacenamiento
 * de forma asíncrona. Sin ese estado, una pantalla que dependa de la sesión
 * mostraría el login por un instante antes de darse cuenta de que sí había
 * sesión — un parpadeo desconcertante en cada arranque.
 */
export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    getSession()
      .then((s) => { if (!cancelled) setSession(s) })
      .catch(() => { /* sin sesión — el estado se queda en null */ })
      .finally(() => { if (!cancelled) setLoading(false) })

    // Mantiene el estado al día ante login, logout o refresco del token
    const unsubscribe = onAuthChange((s) => { if (!cancelled) setSession(s) })

    return () => { cancelled = true; unsubscribe() }
  }, [])

  return {
    session,
    user: session?.user ?? null,
    isLoggedIn: !!session,
    loading,
    signOut: doSignOut,
  }
}

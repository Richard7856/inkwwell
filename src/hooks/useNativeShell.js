import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { isNative } from '../lib/native.js'

/**
 * Comportamientos que solo existen dentro del APK: deep links y botón físico de atrás.
 *
 * En web el hook es un no-op completo — sale en el primer `if` y nunca registra
 * listeners. Se monta una sola vez en App.jsx.
 */
export function useNativeShell() {
  const navigate = useNavigate()
  const location = useLocation()

  /*
    DEEP LINKS — que un link compartido abra la app en la pantalla correcta.

    Sin esto, tocar "https://inkwell-ar.vercel.app/scan?tattoo=uuid" con la app
    instalada abre el NAVEGADOR, no la app. Android decide eso con App Links,
    que requiere dos piezas:
      1. El intent-filter en AndroidManifest.xml (lo agregamos ahí)
      2. Un archivo /.well-known/assetlinks.json servido por el dominio, con la
         huella SHA-256 del certificado de firma (ver DECISIONS.md)

    Cuando Android decide abrir la app, Capacitor emite 'appUrlOpen' con la URL
    completa. Nosotros extraemos path + query y navegamos con React Router:
    la app ya está corriendo, no queremos una recarga completa.
  */
  useEffect(() => {
    if (!isNative) return

    let listener
    CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      try {
        const parsed = new URL(url)
        // Descartamos el origen a propósito: el link puede venir del dominio de
        // producción, de un preview de Vercel o de un custom scheme. Lo único
        // que nos importa es a qué ruta interna corresponde.
        navigate(`${parsed.pathname}${parsed.search}`)
      } catch {
        // URL malformada — ignorar en vez de romper la app
      }
    }).then((handle) => { listener = handle })

    return () => { listener?.remove() }
  }, [navigate])

  /*
    BOTÓN FÍSICO DE ATRÁS (Android).

    Por defecto Capacitor cierra la app con cualquier "atrás", sin importar
    en qué pantalla estés. Eso se siente roto: estás en /activate a media
    captura, das atrás esperando volver al inicio, y se cierra la app.

    Comportamiento correcto:
      - En una ruta interna → volver a la pantalla anterior
      - En la raíz → salir de la app (que es lo que el usuario espera ahí)
  */
  useEffect(() => {
    if (!isNative) return

    let listener
    CapacitorApp.addListener('backButton', () => {
      if (location.pathname !== '/') {
        navigate(-1)
      } else {
        CapacitorApp.exitApp()
      }
    }).then((handle) => { listener = handle })

    return () => { listener?.remove() }
  }, [navigate, location.pathname])
}

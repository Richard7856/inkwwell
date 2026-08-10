import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Privacidad from './pages/Privacidad.jsx'
import { useNativeShell } from './hooks/useNativeShell.js'

/*
  Rutas de AR cargadas bajo demanda.

  Por qué: MindAR y Three.js pesan ~2.3MB de JavaScript. Con imports estáticos,
  ese peso entra al grafo de módulos de la página inicial y lo descarga TODO el
  que abre la landing — aunque la enorme mayoría solo va a leer y registrarse.
  En datos móviles eso son segundos de espera antes de ver nada, y en una página
  cuyo único trabajo es convertir, se paga en registros perdidos.

  Con lazy(), la landing carga solo su propio código. El peso del AR lo asume
  quien entra a activar o escanear, que es justo quien lo necesita.

  Landing y Privacidad se quedan con import estático: son las páginas públicas
  y no deben esperar un chunk extra.
*/
const Home = lazy(() => import('./pages/Home.jsx'))
const Scan = lazy(() => import('./pages/Scan.jsx'))
const Activate = lazy(() => import('./pages/Activate.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))

/**
 * `/` es la landing pública de validación — la puerta de entrada para quien
 * llega desde redes o desde un estudio. El menú del demo vive en `/app`.
 */
function App() {
  // Deep links + botón físico de atrás. No-op en web.
  useNativeShell()

  return (
    <Suspense fallback={<PantallaCargando />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/privacidad" element={<Privacidad />} />
        <Route path="/app" element={<Home />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/activate" element={<Activate />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Suspense>
  )
}

/** Se muestra mientras baja el chunk de una ruta con AR. */
function PantallaCargando() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink">
      <div
        className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"
        role="status"
        aria-label="Cargando"
      />
    </div>
  )
}

export default App

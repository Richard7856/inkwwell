import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Privacidad from './pages/Privacidad.jsx'
import Home from './pages/Home.jsx'
import Scan from './pages/Scan.jsx'
import Activate from './pages/Activate.jsx'
import Profile from './pages/Profile.jsx'
import { useNativeShell } from './hooks/useNativeShell.js'

/**
 * Rutas.
 *
 * `/` es la landing pública de validación — la puerta de entrada para quien
 * llega desde redes o desde un estudio. El menú del demo se movió a `/app`:
 * sigue existiendo para pruebas, pero ya no es lo primero que ve un visitante.
 */
function App() {
  // Deep links + botón físico de atrás. No-op en web.
  useNativeShell()

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/privacidad" element={<Privacidad />} />
      <Route path="/app" element={<Home />} />
      <Route path="/scan" element={<Scan />} />
      <Route path="/activate" element={<Activate />} />
      <Route path="/profile" element={<Profile />} />
    </Routes>
  )
}

export default App

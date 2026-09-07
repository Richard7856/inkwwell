import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Landing from './pages/Landing.jsx'
import Scan from './pages/Scan.jsx'
import Activate from './pages/Activate.jsx'
import Profile from './pages/Profile.jsx'
import ModelPreview from './pages/ModelPreview.jsx'
import Privacidad from './pages/Privacidad.jsx'
import EliminarCuenta from './pages/EliminarCuenta.jsx'
import { useAuth } from './hooks/useAuth.js'
import { initBilling } from './lib/billing.js'

function App() {
  const { user } = useAuth()

  /*
    RevenueCat se arranca al haber sesión, no al abrir la app.

    Necesita el id del usuario para atar las compras a la persona y no al
    teléfono. Arrancarlo antes crearía un identificador anónimo que luego habría
    que reconciliar. En navegador y sin llave configurada no hace nada.
  */
  useEffect(() => {
    if (user?.id) initBilling(user.id)
  }, [user?.id])

  return (
    <Routes>
      {/*
        La raíz sirve a dos públicos distintos.

        En el navegador llega gente que no conoce el producto: va la landing,
        cuyo único objetivo es recoger su correo. Dentro del APK arranca quien
        YA instaló: mostrarle una página de marketing pidiéndole el correo que
        ya dio sería absurdo, así que ve el inicio de la app.

        Se resuelve aquí y no con dos rutas distintas porque Capacitor arranca
        siempre en "/" y cambiar eso exige configuración nativa.
      */}
      <Route path="/" element={Capacitor.isNativePlatform() ? <Home /> : <Landing />} />
      <Route path="/app" element={<Home />} />
      <Route path="/scan" element={<Scan />} />
      <Route path="/activate" element={<Activate />} />
      <Route path="/profile" element={<Profile />} />
      {/*
        Rutas exigidas por Google Play. Ambas deben abrir en el navegador SIN
        instalar la app: son las direcciones que se registran en Play Console,
        y quien ya desinstaló debe poder llegar a borrar su cuenta.
      */}
      <Route path="/privacidad" element={<Privacidad />} />
      <Route path="/eliminar-cuenta" element={<EliminarCuenta />} />

      {/* Herramienta de desarrollo: revisar modelos sin AR ni backend */}
      <Route path="/preview" element={<ModelPreview />} />
    </Routes>
  )
}

export default App

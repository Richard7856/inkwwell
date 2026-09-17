import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

/*
  Retira la pantalla de carga de index.html en cuanto React pintó.

  El retraso mínimo deja que el trazo termine de entrar: si la app carga
  rápido (en la web, con caché), cortarlo a la mitad se ve como un parpadeo.
*/
const carga = document.getElementById('carga-inicial')
if (carga) {
  const MINIMO_MS = 900
  const restante = Math.max(0, MINIMO_MS - performance.now())
  setTimeout(() => {
    carga.classList.add('sale')
    /*
      Se retira por temporizador y no con 'transitionend': en una pestaña en
      segundo plano (o con movimiento reducido) la transición no corre, el
      evento nunca llega y la pantalla se quedaba encima de la app. Visto en la
      revisión del 16 sep. 450 ms cubre los 400 de la transición.
    */
    setTimeout(() => carga.remove(), 450)
  }, restante)
}

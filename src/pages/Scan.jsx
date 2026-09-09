import { useSearchParams } from 'react-router-dom'
import Logo from '../components/ui/Logo.jsx'
import Boton from '../components/ui/Boton.jsx'
import ARViewer from '../components/ARViewer/index.jsx'
import { t } from '../lib/i18n.js'

/**
 * Página de experiencia AR — Flujo B.
 * El usuario apunta su cámara a un tatuaje y ve el contenido 3D.
 *
 * ¿Por qué requiere ?tattoo=<uuid>?
 * Sin el param, no hay target específico que cargar. La ruta /scan sin ID
 * intentaba cargar el demo hardcodeado que no existe en producción, causando
 * un crash interno de MindAR (msgpack parse error en respuesta HTML del 404).
 * El flujo correcto: activar en /activate → recibir link con UUID → compartir.
 */
export default function Scan() {
  const [searchParams] = useSearchParams()
  const tattooId = searchParams.get('tattoo')
  // Demos precargados para validar mecánicas sin depender de la base de datos
  const demo = searchParams.get('demo')

  // Sin ID ni demo — el usuario llegó directo a /scan sin un link de tatuaje
  if (!tattooId && !demo) {
    return <NoTattooScreen />
  }

  return (
    /*
      position: fixed + inset: 0 garantiza que el container mida EXACTAMENTE el viewport
      visible en el momento que MindAR inicializa el video.

      Por qué NO usar h-screen (100vh):
      En Android Chrome, 100vh incluye la altura de la barra de URL aunque esté visible.
      El container resulta más alto que el área visible → MindAR lee dimensiones incorrectas
      al inicializar → calcula mal el aspect ratio del video → imagen aparece torcida/chueca.

      position:fixed + inset:0 siempre mide el viewport visible real, sin importar
      si la barra de URL está visible o no, o si hay barra de navegación inferior.
    */
    <div style={{ position: 'fixed', inset: 0 }}>
      <ARViewer tattooId={tattooId} demo={demo} />
    </div>
  )
}

/** Pantalla cuando se accede a /scan sin un ?tattoo=uuid */
function NoTattooScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <Logo alto={36} className="mb-8 opacity-90" />
      <h1 className="text-xl font-semibold mb-3">{t('Sin tatuaje seleccionado')}</h1>
      <p className="text-gray-400 text-sm mb-8 max-w-xs leading-relaxed">
        {t('Para escanear un tatuaje, necesitas el link que te compartió el dueño. Si quieres activar el tuyo, empieza aquí:')}
      </p>
      <Boton to="/activate" className="max-w-xs">{t('Activar mi tatuaje')}</Boton>
      <Boton to="/app" variante="enlace" className="mt-4">{t('Volver al inicio')}</Boton>
    </div>
  )
}

import { Link, useSearchParams } from 'react-router-dom'
import ARViewer from '../components/ARViewer/index.jsx'

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

  // Sin ID — el usuario llegó directo a /scan sin un link de tatuaje
  if (!tattooId) {
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
      <ARViewer tattooId={tattooId} />
    </div>
  )
}

/** Pantalla cuando se accede a /scan sin un ?tattoo=uuid */
function NoTattooScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="text-5xl mb-6">🔍</div>
      <h1 className="text-xl font-semibold mb-3">Sin tatuaje seleccionado</h1>
      <p className="text-gray-400 text-sm mb-8 max-w-xs leading-relaxed">
        Para escanear un tatuaje, necesitas el link que te compartió el dueño.
        Si quieres activar el tuyo, empieza aquí:
      </p>
      <Link
        to="/activate"
        className="bg-white text-black font-semibold py-3 px-6 rounded-full
                   hover:bg-gray-200 transition-colors"
      >
        Activar mi tatuaje
      </Link>
      <Link to="/" className="text-gray-600 text-sm mt-4 hover:text-gray-400 transition-colors">
        Volver al inicio
      </Link>
    </div>
  )
}

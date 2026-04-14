import { useSearchParams } from 'react-router-dom'
import ARViewer from '../components/ARViewer/index.jsx'

/**
 * Página de experiencia AR — Flujo B.
 * El usuario apunta su cámara a un tatuaje y ve el contenido 3D.
 * Acepta ?tattoo=<id> como query param; sin él usa el demo default.
 */
export default function Scan() {
  const [searchParams] = useSearchParams()
  const tattooId = searchParams.get('tattoo') || 'default'

  return (
    <div className="w-full h-screen">
      <ARViewer tattooId={tattooId} />
    </div>
  )
}

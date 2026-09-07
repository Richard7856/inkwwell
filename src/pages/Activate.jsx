import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PhotoUpload from '../components/UploadFlow/PhotoUpload.jsx'
import DesignPicker from '../components/UploadFlow/DesignPicker.jsx'
import CompileStatus from '../components/UploadFlow/CompileStatus.jsx'
import { uploadTattooImage, uploadMindFile } from '../lib/storage.js'
import { createTattoo } from '../lib/supabase.js'
import { compileMindFile } from '../lib/compiler.js'
import { useAuth } from '../hooks/useAuth.js'
import { ensureProfile } from '../lib/profile.js'
import { ligaDeTatuaje } from '../lib/urls.js'
import LoginGate from '../components/Auth/LoginGate.jsx'

/**
 * Flujo de activación — Flujo A.
 * Pasos: capturar foto → upload a Supabase → elegir GLB → compilar .mind → guardar en DB → confirmación.
 *
 * ¿Por qué guardamos imageFile en estado además de imageUrl?
 * La foto se sube a Supabase al terminar el paso 1, pero el worker de compilación
 * necesita el File original (binario) — no la URL pública. Mantener ambas referencias
 * evita tener que re-descargar la imagen desde Supabase para compilar.
 *
 * ¿Por qué volver a 'design' en error de compilación y no a 'upload'?
 * La foto ya está subida — no tiene sentido pedirla de nuevo. El usuario puede
 * intentar con otro diseño o reintentar el mismo. Esto también preserva imageUrl.
 */
export default function Activate() {
  const { user, isLoggedIn, loading: cargandoSesion } = useAuth()
  const [step, setStep] = useState('upload') // upload | uploading | design | compiling | done
  const [imageUrl, setImageUrl] = useState(null)
  const [imageFile, setImageFile] = useState(null) // referencia al File original para el worker
  const [selectedDesign, setSelectedDesign] = useState(null)
  const [tattooId, setTattooId] = useState(null) // UUID del tatuaje en Supabase
  const [error, setError] = useState('')
  // Progreso real de compilación (0-100) reportado por el worker vía SSE
  const [compileProgress, setCompileProgress] = useState(0)
  const [compileStage, setCompileStage] = useState('compiling')
  const [elapsed, setElapsed] = useState(0)
  // Capa de tinta extraída de la foto — solo para mostrar durante la compilación
  const [inkLayer, setInkLayer] = useState(null)

  /*
    Cronómetro de la etapa de compilación.

    Se muestra junto al porcentaje porque el avance de MindAR no es lineal en el
    tiempo: la primera mitad (features de detección) es bastante más lenta que la
    segunda. Ver solo el porcentaje daría la impresión de que se atoró.
  */
  useEffect(() => {
    if (step !== 'compiling') {
      setElapsed(0)
      return
    }
    const startedAt = Date.now()
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [step])

  const handlePhotoSelected = async (file, extractedInk = null) => {
    setStep('uploading')
    setError('')

    // Guardar referencia al File — lo necesitamos después para el worker de compilación
    setImageFile(file)
    setInkLayer(extractedInk)

    try {
      const { url } = await uploadTattooImage(file)
      setImageUrl(url)
      setStep('design')
    } catch (err) {
      setError(err.message)
      setStep('upload')
    }
  }

  const handleDesignSelected = async (design) => {
    setSelectedDesign(design)
    setStep('compiling')
    setError('')
    setCompileProgress(0)
    setCompileStage('compiling')

    try {
      // Paso 1: enviar la foto al worker — el worker ejecuta MindAR OfflineCompiler
      // Esto toma 10-30 segundos dependiendo del tamaño de la imagen y el servidor
      const mindBuffer = await compileMindFile(imageFile, setCompileProgress)

      // Paso 2: subir el .mind compilado a Supabase Storage (bucket: mind-files)
      setCompileStage('uploading')
      const { url: mindUrl } = await uploadMindFile(mindBuffer)

      // Paso 3: crear el registro en la tabla tattoos y obtener el UUID
      // Este UUID es el "identificador permanente" del tatuaje — vive en la URL de escaneo
      setCompileStage('saving')
      /*
        Se asegura el perfil antes de guardar: las políticas de la base exigen
        que user_id coincida con la sesión, y el perfil es lo que sostiene el
        link compartible del usuario.
      */
      const perfil = await ensureProfile(user)

      const id = await createTattoo({
        imageUrl,
        mindUrl,
        glbUrl: design.glbUrl,
        userId: perfil.id,
      })

      setTattooId(id)
      setStep('done')
    } catch (err) {
      setError(err.message)
      // Volver a 'design' — la foto ya está subida, no hace falta repetir ese paso
      setStep('design')
    }
  }

  /*
    Solo se pide sesión a quien ACTIVA. Quien escanea nunca pasa por aquí.

    Mientras se recupera la sesión del almacenamiento se muestra un intermedio:
    sin él, en cada arranque aparecería el login por un instante aunque el
    usuario ya estuviera dentro.
  */
  if (cargandoSesion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen px-6 py-8 pb-safe">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="text-gray-500 hover:text-white transition-colors">
            <BackArrow />
          </Link>
          <h1 className="text-2xl font-bold">Activa tu tatuaje</h1>
        </div>
        <LoginGate />
      </div>
    )
  }

  return (
    <div className="min-h-screen px-6 py-8 pb-safe">
      {/* Header con botón de regreso */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-gray-500 hover:text-white transition-colors">
          <BackArrow />
        </Link>
        <h1 className="text-2xl font-bold">Activa tu tatuaje</h1>
      </div>

      {/* Indicador de pasos */}
      <StepIndicator current={step} />

      {step === 'upload' && (
        <PhotoUpload onPhotoSelected={handlePhotoSelected} />
      )}

      {step === 'uploading' && (
        <div className="text-center mt-12">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full
                          animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Subiendo foto...</p>
        </div>
      )}

      {step === 'design' && (
        <div>
          {/* Thumbnail de la foto subida — confirmación visual para el usuario */}
          {imageUrl && (
            <div className="mb-6 flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10">
              <img src={imageUrl} alt="Tu tatuaje" className="w-14 h-14 rounded-lg object-cover" />
              <div className="text-left">
                <p className="text-sm font-medium">Foto subida</p>
                <p className="text-xs text-gray-500">Ahora elige tu diseño 3D</p>
              </div>
            </div>
          )}
          <DesignPicker onDesignSelected={handleDesignSelected} />
        </div>
      )}

      {step === 'compiling' && (
        <CompileStatus
          stage={compileStage}
          progress={compileProgress}
          elapsedSeconds={elapsed}
          inkLayer={inkLayer}
        />
      )}

      {step === 'done' && (
        <div className="text-center mt-12">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center
                          mx-auto mb-4 border border-white/20">
            <span className="text-2xl">✓</span>
          </div>
          <h2 className="text-xl font-semibold mb-2">Tu tatuaje está activado</h2>
          <p className="text-gray-400 mb-8 max-w-xs mx-auto">
            Cualquier persona puede apuntar su cámara a tu tatuaje y ver tu experiencia 3D.
          </p>

          {/* Link específico con el UUID del tatuaje — targetLoader lo resuelve en Supabase */}
          <Link
            to={`/scan?tattoo=${tattooId}`}
            className="inline-block bg-white text-black font-semibold py-3 px-6 rounded-full
                       hover:bg-gray-200 transition-colors mb-6"
          >
            Probar ahora →
          </Link>

          {/* Mostrar el link para que el usuario lo guarde / comparta */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-w-xs mx-auto">
            <p className="text-gray-500 text-xs mb-2">Tu link de escaneo:</p>
            <p className="text-gray-300 text-xs font-mono break-all">
              {ligaDeTatuaje(tattooId)}
            </p>
            <button
              onClick={() => navigator.clipboard?.writeText(ligaDeTatuaje(tattooId))}
              className="mt-3 text-xs text-gray-400 hover:text-white transition-colors underline"
            >
              Copiar link
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}

/** Indicador visual de progreso — muestra en qué paso está el usuario */
function StepIndicator({ current }) {
  const steps = [
    { key: 'upload', label: 'Foto' },
    { key: 'design', label: 'Diseño' },
    { key: 'compiling', label: 'Activar' },
  ]

  // Mapear estados intermedios al índice del paso visual correspondiente
  const stepMap = { upload: 0, uploading: 0, design: 1, compiling: 2, done: 3 }
  const currentIdx = stepMap[current] ?? 0

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
            transition-colors duration-300
            ${i < currentIdx
              ? 'bg-white text-black'
              : i === currentIdx
                ? 'bg-white/20 text-white border border-white/40'
                : 'bg-white/5 text-gray-600'
            }
          `}>
            {i < currentIdx ? '\u2713' : i + 1}
          </div>
          <span className={`text-xs ${i <= currentIdx ? 'text-gray-300' : 'text-gray-600'}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${i < currentIdx ? 'bg-white/40' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

import { useRef, useState } from 'react'

/**
 * Captura o selección de foto del tatuaje.
 *
 * Dos modos de entrada:
 * 1. Tomar foto — usa capture="environment" que abre la cámara nativa del OS.
 *    Más confiable que getUserMedia para captura de foto estática en mobile.
 * 2. Subir de galería — input file estándar sin capture.
 *
 * Valida resolución mínima (800x800) — fotos pequeñas generan .mind
 * de baja calidad que fallan en tracking.
 */
export default function PhotoUpload({ onPhotoSelected }) {
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  const validateAndSelect = (file) => {
    if (!file) return

    setError('')

    if (!file.type.startsWith('image/')) {
      setError('Solo se aceptan imágenes JPG o PNG')
      return
    }

    // Validar resolución mínima — 800x800 requerido para tracking confiable
    const img = new Image()
    img.onload = () => {
      if (img.width < 800 || img.height < 800) {
        setError(`Resolución muy baja (${img.width}x${img.height}). Mínimo 800x800px.`)
        URL.revokeObjectURL(img.src)
        return
      }
      setPreview(img.src)
      onPhotoSelected(file)
    }
    img.onerror = () => {
      setError('No se pudo leer la imagen. Intenta con otra.')
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  }

  const handleRetake = () => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setError('')
  }

  return (
    <div className="text-center">
      <p className="text-gray-400 mb-6">
        Toma una foto clara de tu tatuaje. Buena iluminación, sin flash, piel sanada.
      </p>

      {preview ? (
        <div>
          <img
            src={preview}
            alt="Preview del tatuaje"
            className="mx-auto rounded-xl max-h-64 mb-4 border border-white/10"
          />
          <button
            onClick={handleRetake}
            className="text-gray-400 text-sm underline hover:text-white transition-colors"
          >
            Tomar otra foto
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          {/* Opción principal: tomar foto con cámara */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="w-full py-4 rounded-2xl bg-white text-black font-semibold
                       flex items-center justify-center gap-3
                       hover:bg-gray-200 transition-colors"
          >
            <CameraIcon />
            Tomar foto
          </button>

          {/* Opción secundaria: subir de galería */}
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="w-full py-4 rounded-2xl bg-white/10 text-white font-medium
                       flex items-center justify-center gap-3
                       border border-white/10 hover:bg-white/20 transition-colors"
          >
            <GalleryIcon />
            Subir de galería
          </button>

          <p className="text-gray-600 text-xs mt-2">JPG o PNG, mínimo 800x800px</p>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm mt-3">{error}</p>
      )}

      {/* Input cámara — capture="environment" abre cámara trasera en mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        onChange={(e) => validateAndSelect(e.target.files?.[0])}
        className="hidden"
      />

      {/* Input galería — sin capture, abre selector de archivos */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={(e) => validateAndSelect(e.target.files?.[0])}
        className="hidden"
      />
    </div>
  )
}

/** Icono de cámara inline — evita dependencia de librería de iconos */
function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function GalleryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

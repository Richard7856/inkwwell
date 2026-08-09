import { useRef, useState } from 'react'
import { isNative, takePhoto } from '../../lib/native.js'

/**
 * Captura o selección de foto del tatuaje.
 *
 * Dos modos de entrada, cada uno con implementación distinta según plataforma:
 * 1. Tomar foto — APK: plugin nativo de Capacitor. Web: <input capture="environment">.
 * 2. Subir de galería — APK: picker nativo. Web: <input> estándar.
 *
 * Por qué se bifurca (ver src/lib/native.js para el detalle):
 * El file input dentro de un WebView depende de onShowFileChooser y su
 * comportamiento varía entre fabricantes de Android. En web el <input> funciona
 * perfecto y evita cargar el modal de @ionic/pwa-elements que el plugin
 * requeriría en navegador.
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

  /**
   * Punto único de entrada para ambos botones.
   * En APK abre el picker nativo; en web delega al <input> correspondiente.
   */
  const handlePick = async (source) => {
    if (!isNative) {
      const ref = source === 'gallery' ? galleryInputRef : cameraInputRef
      ref.current?.click()
      return
    }

    setError('')
    try {
      const file = await takePhoto(source)
      // null = el usuario cerró la cámara sin tomar foto. No es un error.
      if (file) validateAndSelect(file)
    } catch (err) {
      // El plugin lanza si el permiso fue denegado permanentemente
      setError(
        err.message?.includes('denied') || err.message?.includes('permission')
          ? 'Necesitamos permiso de cámara. Actívalo en Ajustes → Apps → Inkwell AR.'
          : 'No se pudo abrir la cámara. Intenta de nuevo.'
      )
    }
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
            onClick={() => handlePick('camera')}
            className="w-full py-4 rounded-2xl bg-white text-black font-semibold
                       flex items-center justify-center gap-3
                       hover:bg-gray-200 transition-colors"
          >
            <CameraIcon />
            Tomar foto
          </button>

          {/* Opción secundaria: subir de galería */}
          <button
            onClick={() => handlePick('gallery')}
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

      {/* Inputs solo para web — en el APK los reemplaza el picker nativo de Capacitor */}
      {!isNative && (
        <>
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
        </>
      )}
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

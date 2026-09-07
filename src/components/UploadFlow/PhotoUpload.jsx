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
/*
  Reducción de la foto antes de compilar.

  POR QUÉ ES NECESARIO (medido contra el worker en Railway):
    1000x1000 (1.0 MP)  →  11 segundos
    1500x1125 (1.7 MP)  → 111 segundos
  1.7x más píxeles cuesta 10x más tiempo. Una foto de celular de 12 MP tardaría
  minutos o tumbaría el contenedor por memoria — que es exactamente el bug que
  aparecía como "compila mucho rato y regresa al selector".

  POR QUÉ NO PERJUDICA EL TRACKING:
  Medido con el analizador: 1000x1000 da 4429 puntos de detección en 11 escalas
  (veredicto "bueno"); 1500x1125 da 5138 en 12 escalas. Prácticamente lo mismo por
  10x el costo. Además, esos descriptores extra viven a una resolución que la
  cámara nunca va a ver en runtime — el frame de video ronda los 640x480.

  EL MÍNIMO MANDA SOBRE EL OBJETIVO:
  Si reducir a ~1.1 MP dejaría el lado corto por debajo de 800px (el mínimo del
  proyecto para tracking confiable), se respeta el mínimo aunque se exceda el
  objetivo de píxeles. Calidad de tracking antes que velocidad.
*/
const TARGET_PIXELS = 1_100_000
const MIN_SHORT_SIDE = 800

async function downscaleImage(file, img) {
  const { width: w, height: h } = img

  let scale = Math.sqrt(TARGET_PIXELS / (w * h))
  if (scale >= 1) return file // ya es pequeña — nunca ampliar, solo perdería nitidez

  // No dejar que el lado corto caiga por debajo del mínimo de tracking
  scale = Math.max(scale, MIN_SHORT_SIDE / Math.min(w, h))
  if (scale >= 1) return file

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  // Interpolación de alta calidad: el detalle fino es justo lo que alimenta
  // la extracción de features, no conviene degradarlo con el escalado por defecto
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.92)
  )
  if (!blob) return file // si el navegador falla, seguir con la original

  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

export default function PhotoUpload({ onPhotoSelected }) {
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  const validateAndSelect = (file) => {
    if (!file) return

    setError('')

    /*
      Validar contra los formatos que acepta el worker (worker/index.js fileFilter).
      Es más estricto que el accept del input: ese ahora dice "image/*" por el
      requisito de Capacitor para abrir la cámara, así que la galería podría
      devolver un HEIC o un GIF que el compilador rechazaría con un error críptico.
    */
    const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
    if (!ACCEPTED.includes(file.type)) {
      setError(
        `Formato no soportado (${file.type || 'desconocido'}). Usa JPG, PNG o WebP.`
      )
      return
    }

    // Validar resolución mínima — 800x800 requerido para tracking confiable
    const img = new Image()
    img.onload = async () => {
      if (img.width < 800 || img.height < 800) {
        setError(`Resolución muy baja (${img.width}x${img.height}). Mínimo 800x800px.`)
        URL.revokeObjectURL(img.src)
        return
      }
      setPreview(img.src)

      // Reducir antes de entregarla: el tiempo de compilación crece de forma
      // explosiva con los píxeles (ver comentario en downscaleImage)
      const optimized = await downscaleImage(file, img)
      onPhotoSelected(optimized)
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

          <p className="text-gray-600 text-xs mt-2">JPG, PNG o WebP · mínimo 800x800px</p>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm mt-3">{error}</p>
      )}

      {/*
        Input cámara.

        accept DEBE ser exactamente "image/*" — no una lista de tipos concretos.
        Capacitor (BridgeWebChromeClient.onShowFileChooser:283) decide si abre la
        cámara con:
            capturePhoto = captureEnabled && acceptTypes.contains("image/*")
        Con accept="image/jpeg,image/png" esa condición es falsa aunque capture
        esté presente, y cae a showFilePicker() → abre la galería.

        El filtrado real de formatos se hace en validateAndSelect(), que valida
        contra los mismos tipos que acepta el worker.
      */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
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

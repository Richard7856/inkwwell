/**
 * Capa de abstracción sobre las APIs nativas de Capacitor.
 *
 * Toda la ramificación "¿estoy en el APK o en el navegador?" vive AQUÍ.
 * El resto de la app importa estas funciones y no necesita saber en qué
 * plataforma corre. Si mañana agregamos iOS, este es el único archivo a revisar.
 *
 * Regla de diseño: cada función tiene un fallback web funcional. Nada de
 * `if (!isNative) throw` — la web sigue siendo el flujo principal del producto
 * (el escaneo viral vive en el navegador, ver DECISIONS.md).
 */
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Clipboard } from '@capacitor/clipboard'

/** true dentro del APK (Android/iOS), false en el navegador. */
export const isNative = Capacitor.isNativePlatform()

/**
 * Pide el permiso de cámara de Android ANTES de que MindAR llame a getUserMedia.
 *
 * Por qué es necesario aunque el WebView ya maneje onPermissionRequest:
 * Capacitor implementa `onPermissionRequest` en su WebChromeClient, así que
 * getUserMedia técnicamente dispara el diálogo de permiso solo. El problema es
 * el TIMING: ese diálogo aparece a media inicialización de MindAR, con la pantalla
 * ya en negro y el spinner corriendo. Si el usuario tarda en decidir o niega,
 * MindAR falla con un error críptico de stream.
 *
 * Pidiéndolo explícitamente antes, el diálogo sale sobre una pantalla limpia y
 * podemos dar un mensaje entendible si lo niega.
 *
 * En web es un no-op — el navegador pide el permiso al llamar getUserMedia.
 *
 * @returns {Promise<boolean>} true si hay permiso (o si estamos en web)
 */
export async function ensureCameraPermission() {
  if (!isNative) return true

  try {
    const status = await Camera.checkPermissions()
    if (status.camera === 'granted') return true

    const requested = await Camera.requestPermissions({ permissions: ['camera'] })
    return requested.camera === 'granted'
  } catch (err) {
    // Si el plugin falla, no bloqueamos el flujo: dejamos que getUserMedia lo
    // intente por su cuenta y falle con su propio error si de verdad no hay permiso.
    console.warn('[native] checkPermissions falló, continuando:', err.message)
    return true
  }
}

/**
 * Abre la cámara nativa (o la galería) y devuelve un File listo para subir.
 *
 * Por qué NO usamos <input capture="environment"> dentro del APK:
 * En un WebView el file input depende de `onShowFileChooser`, que Capacitor
 * implementa pero con comportamiento inconsistente entre fabricantes — en varios
 * Android el atributo `capture` se ignora y abre el explorador de archivos, o
 * el chooser regresa sin resultado. La cámara nativa del plugin es determinista.
 *
 * En web esta función NO se usa: PhotoUpload mantiene el <input> original,
 * que ahí funciona perfecto y evita cargar el modal de @ionic/pwa-elements.
 *
 * @param {'camera' | 'gallery'} source - de dónde sacar la foto
 * @returns {Promise<File | null>} File JPEG, o null si el usuario canceló
 */
export async function takePhoto(source = 'camera') {
  const photo = await Camera.getPhoto({
    // 90 es el punto dulce: el .mind necesita detalle para trackear bien,
    // pero un JPEG al 100% infla el upload sin ganar features detectables.
    quality: 90,
    allowEditing: false,
    // Uri en vez de Base64: Base64 de una foto de 12MP son ~8MB de string en
    // memoria del WebView, suficiente para tirar la app en gama media.
    // Con Uri leemos el archivo como Blob solo cuando lo necesitamos.
    resultType: CameraResultType.Uri,
    source: source === 'gallery' ? CameraSource.Photos : CameraSource.Camera,
    // Sin corrección de orientación las fotos verticales llegan rotadas 90°
    // y el .mind se compila contra una imagen que no coincide con el tatuaje real.
    correctOrientation: true,
  })

  // El usuario canceló el picker
  if (!photo?.webPath) return null

  // webPath es una URL local del WebView — fetch la convierte en Blob sin red
  const response = await fetch(photo.webPath)
  const blob = await response.blob()

  const ext = photo.format || 'jpeg'
  return new File([blob], `tattoo-${Date.now()}.${ext}`, {
    type: blob.type || `image/${ext}`,
  })
}

/**
 * Origen público del sitio — la base para construir links compartibles.
 *
 * POR QUÉ ESTO EXISTE (bug sutil del APK):
 * En el navegador, `window.location.origin` es el dominio real y sirve para
 * armar el link de escaneo. Dentro del WebView de Capacitor el origen es
 * `https://localhost` — un origen interno de la app. Si construyéramos el link
 * con eso, el usuario copiaría "https://localhost/scan?tattoo=..." y NADIE
 * podría abrirlo. El flujo viral del producto quedaría roto solo en el APK,
 * y de forma silenciosa (el botón "Copiar" funciona, el link es basura).
 *
 * VITE_PUBLIC_URL se hornea en el build y apunta al dominio de producción.
 * En web caemos a window.location.origin para que dev/preview sigan funcionando
 * sin configurar nada.
 *
 * @returns {string} origen sin slash final, ej. "https://inkwell-ar.vercel.app"
 */
export function getPublicOrigin() {
  const configured = import.meta.env.VITE_PUBLIC_URL?.replace(/\/$/, '')
  if (configured) return configured

  if (isNative) {
    // Sin VITE_PUBLIC_URL en un build nativo el link sería inutilizable.
    // Avisamos fuerte en consola en vez de generar un link roto en silencio.
    console.error(
      '[native] VITE_PUBLIC_URL no está definida. Los links de escaneo generados ' +
      'desde el APK apuntarán a localhost y no funcionarán al compartirlos.'
    )
  }
  return window.location.origin
}

/**
 * Construye el link público de escaneo de un tatuaje.
 * @param {string} tattooId - UUID del tatuaje
 */
export function buildScanUrl(tattooId) {
  return `${getPublicOrigin()}/scan?tattoo=${tattooId}`
}

/**
 * Copia texto al portapapeles.
 *
 * Por qué no solo navigator.clipboard:
 * En el WebView de Capacitor el origen es https://localhost (contexto seguro),
 * así que navigator.clipboard existe — pero en algunos Android el write() falla
 * silenciosamente sin permiso de foco. El plugin nativo no tiene ese problema.
 *
 * @param {string} text
 * @returns {Promise<boolean>} true si se copió
 */
export async function copyToClipboard(text) {
  try {
    if (isNative) {
      await Clipboard.write({ string: text })
      return true
    }
    await navigator.clipboard?.writeText(text)
    return true
  } catch (err) {
    console.warn('[native] copyToClipboard falló:', err.message)
    return false
  }
}

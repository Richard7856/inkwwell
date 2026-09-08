/**
 * Traducción español / inglés.
 *
 * ── Por qué sin librería ──
 * `CLAUDE.md` prohíbe agregar peso al bundle: MindAR ya se lleva ~2.5MB, y una
 * librería de i18n traería carga de recursos, pluralización y formato de fechas
 * que este producto no usa. Son ~105 frases: un diccionario basta.
 *
 * ── Por qué la frase en español ES la llave ──
 * Inventar llaves (`home.cta.principal`) para 105 frases repartidas en 20
 * archivos es trabajo mecánico con mucho margen de error, y deja el código
 * ilegible: hay que ir al diccionario para saber qué dice un botón. Con la
 * frase como llave, el código se lee solo y una traducción faltante degrada a
 * español en vez de mostrar `home.cta.principal` en pantalla.
 * El costo: cambiar el texto en español rompe la correspondencia en silencio.
 * Por eso en desarrollo se avisa por consola de cada frase sin traducir.
 *
 * ── Por qué el cambio de idioma recarga la página ──
 * El idioma se decide una vez al abrir. Hacerlo reactivo obligaría a que cada
 * componente se suscribiera, con el riesgo de que uno se quede en el idioma
 * viejo. Recargar es instantáneo y no puede quedar a medias.
 */

const CLAVE_GUARDADO = 'inkar.idioma'

function detectar() {
  try {
    const guardado = localStorage.getItem(CLAVE_GUARDADO)
    if (guardado === 'es' || guardado === 'en') return guardado
  } catch {
    /* almacenamiento bloqueado (modo privado): se sigue con la detección */
  }
  const nav = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase()
  return nav.startsWith('es') ? 'es' : 'en'
}

let idioma = detectar()

/** @returns {'es'|'en'} */
export function getIdioma() {
  return idioma
}

/** Cambia el idioma y recarga, para que no quede ninguna pantalla a medias. */
export function setIdioma(nuevo) {
  try { localStorage.setItem(CLAVE_GUARDADO, nuevo) } catch { /* sin persistencia */ }
  idioma = nuevo
  location.reload()
}

function interpolar(texto, params) {
  if (!params) return texto
  return texto.replace(/\{(\w+)\}/g, (coincidencia, nombre) =>
    params[nombre] !== undefined ? String(params[nombre]) : coincidencia)
}

/**
 * Traduce una frase.
 *
 * @param {string} es - La frase en español; es también la llave del diccionario
 * @param {Record<string, string|number>} [params] - Valores para los {marcadores}
 * @returns {string}
 */
export function t(es, params) {
  if (idioma === 'es') return interpolar(es, params)
  const en = EN[es]
  if (en === undefined && import.meta.env.DEV) {
    console.warn('[i18n] sin traducción al inglés:', JSON.stringify(es))
  }
  return interpolar(en ?? es, params)
}

/*
  Diccionario español → inglés.

  Agrupado por pantalla para que al tocar una sea evidente qué frases revisar.
  Las frases con {marcadores} deben conservarlos idénticos en ambos idiomas.
*/
const EN = {
  // ── Inicio ──
  'Tu tatuaje cobra vida en realidad aumentada': 'Your tattoo comes alive in augmented reality',
  'Activar mi tatuaje': 'Activate my tattoo',
  '¿Te compartieron un link de tatuaje?': 'Got sent a tattoo link?',
  'Ábrelo directo desde tu celular.': 'Open it straight from your phone.',
  'Activa tu tatuaje una vez. Cualquier persona que apunte su cámara verá tu mundo 3D.':
    'Activate your tattoo once. Anyone who points their camera sees your 3D world.',
  'Probar multi-tatuaje (demo)': 'Try multi-tattoo (demo)',
  'Privacidad': 'Privacy',
  'Eliminar mi cuenta': 'Delete my account',
  'Volver al inicio': 'Back to home',
  'Mejor no, volver al inicio': 'Never mind, back to home',

  // ── Acceso ──
  'Identifícate para activar': 'Sign in to activate',
  'Tu cuenta guarda tus tatuajes y tu link, para que no los pierdas si cambias de celular.':
    'Your account keeps your tattoos and your link, so you don’t lose them if you change phones.',
  'Revisa tu correo': 'Check your email',
  'Enviamos un código de 6 dígitos a {email}': 'We sent a 6-digit code to {email}',
  'Enviar código': 'Send code',
  'Enviando...': 'Sending...',
  'Verificando...': 'Verifying...',
  'Entrando...': 'Signing in...',
  'Creando...': 'Creating...',
  'Entrar': 'Sign in',
  'Crear cuenta': 'Create account',
  'Crear una cuenta nueva': 'Create a new account',
  'Ya tengo cuenta': 'I already have an account',
  'Usar otro correo': 'Use another email',
  'Prefiero usar contraseña': 'Use a password instead',
  'Prefiero recibir un código': 'Send me a code instead',
  'Tu contraseña': 'Your password',
  'Al menos {n} caracteres': 'At least {n} characters',
  'Confirma tu correo': 'Confirm your email',
  'tu@correo.com': 'you@email.com',
  'Escribe el correo de la cuenta que quieres eliminar.':
    'Enter the email of the account you want to delete.',

  // ── Errores de acceso ──
  'Demasiados intentos. Espera unos minutos antes de pedir otro código.':
    'Too many attempts. Wait a few minutes before requesting another code.',
  'Código incorrecto o vencido. Pide uno nuevo.': 'Wrong or expired code. Request a new one.',
  'Correo o contraseña incorrectos.': 'Wrong email or password.',
  'La contraseña necesita al menos {n} caracteres.': 'The password needs at least {n} characters.',
  'Ese correo ya tiene cuenta. Entra con tu contraseña.':
    'That email already has an account. Sign in with your password.',
  'Falta confirmar tu correo antes de entrar.': 'You need to confirm your email before signing in.',
  'Sesión inválida o vencida. Vuelve a entrar con tu código.':
    'Invalid or expired session. Sign in again.',

  // ── Activación ──
  'Activa tu tatuaje': 'Activate your tattoo',
  'Foto': 'Photo',
  'Diseño': 'Design',
  'Activar': 'Activate',
  'Toma una foto clara de tu tatuaje. Buena iluminación, sin flash, piel sanada.':
    'Take a clear photo of your tattoo. Good lighting, no flash, healed skin.',
  'Tomar foto': 'Take photo',
  'Subir de galería': 'Upload from gallery',
  'JPG, PNG o WebP · mínimo 800x800px': 'JPG, PNG or WebP · minimum 800x800px',
  'Elige qué aparecerá sobre tu tatuaje': 'Choose what will appear over your tattoo',
  'Continuar': 'Continue',

  // Motivos y consejos del analizador. El worker manda un código estable y su
  // texto en español; estas son las mismas frases, rearmadas aquí para poder
  // traducirlas. Los {marcadores} deben conservarse idénticos.
  'Pocos puntos de seguimiento: {n} de {max} posibles ({pct}%). El contenido va a vibrar o despegarse al mover la cámara.':
    'Few tracking points: {n} of {max} possible ({pct}%). The content will jitter or drift as the camera moves.',
  'Pocos puntos de detección ({n}). Va a costar que la cámara reconozca el tatuaje.':
    'Few detection points ({n}). The camera will struggle to recognize the tattoo.',
  'Puntos concentrados en {n} de 9 zonas. El seguimiento se pierde si esa zona sale del encuadre.':
    'Points concentrated in {n} of 9 zones. Tracking breaks if that zone leaves the frame.',
  'El {pct}% de los puntos cae en una sola zona de la imagen.':
    '{pct}% of the points fall in a single zone of the image.',
  'Resolución baja: el lado menor mide {n}px y se recomiendan al menos 800px.':
    'Low resolution: the short side is {n}px and at least 800px is recommended.',
  'Solo {n} niveles de escala con puntos útiles. Se va a detectar únicamente a una distancia específica.':
    'Only {n} scale levels with usable points. It will only be detected at one specific distance.',
  'Los tatuajes con sombreado, textura o líneas densas se siguen mucho mejor que el trazo fino.':
    'Tattoos with shading, texture or dense linework track far better than fine linework.',
  'Mejora el contraste: luz lateral suave, sin flash directo, sin reflejos en la piel.':
    'Improve contrast: soft side light, no direct flash, no glare on the skin.',
  'Encuadra el tatuaje completo y centrado, sin partes cortadas ni piel vacía de más.':
    'Frame the whole tattoo, centered, with nothing cropped and no excess bare skin.',
  'Toma la foto más cerca o con mejor cámara — no la recortes de una imagen más grande.':
    'Shoot closer or with a better camera — don’t crop it out of a larger image.',
  'Cambiar foto': 'Change photo',
  'Tu tatuaje está activado': 'Your tattoo is activated',
  'Probar ahora →': 'Try it now →',
  'Tu link de escaneo:': 'Your scan link:',
  'Copiar link': 'Copy link',

  // ── Escaneo ──
  'Apunta la cámara a tu tatuaje': 'Point your camera at your tattoo',
  'Buscando tatuaje...': 'Looking for a tattoo...',
  'Permite el acceso a la cámara para escanear': 'Allow camera access to scan',
  'No se pudo iniciar la cámara': 'Camera could not be started',

  // ── Borrado de cuenta ──
  'Para borrar tu cuenta necesitamos confirmar que el correo es tuyo. Te enviaremos un código de 6 dígitos.':
    'To delete your account we need to confirm the email is yours. We’ll send you a 6-digit code.',
  'Sesión activa como': 'Signed in as',
  'Qué se elimina': 'What gets deleted',
  'Las fotos de tus tatuajes': 'Your tattoo photos',
  'Los descriptores visuales generados a partir de ellas':
    'The visual descriptors generated from them',
  'Tu perfil y tu link compartible, que dejará de abrir':
    'Your profile and your shareable link, which will stop working',
  'Tu correo y tu cuenta de acceso': 'Your email and your sign-in account',
  'El borrado es inmediato y definitivo: no hay copia de respaldo de la que podamos recuperarlo después.':
    'Deletion is immediate and permanent: there is no backup we could restore it from later.',
  'Esto no se puede deshacer. Escribe {palabra} para confirmar.':
    'This cannot be undone. Type {palabra} to confirm.',
  'Eliminar mi cuenta para siempre': 'Delete my account forever',
  'BORRAR': 'DELETE',
  'Borrando...': 'Deleting...',
  'Listo': 'Done',
  'Se eliminaron {tatuajes} tatuaje(s) y {archivos} archivo(s). Los links que hayas compartido dejaron de funcionar.':
    '{tatuajes} tattoo(s) and {archivos} file(s) were deleted. Any links you shared have stopped working.',
  'Cargando...': 'Loading...',

  // ── Flujo de activación ──
  'Tomar otra foto': 'Take another photo',
  'Vista previa del tatuaje': 'Tattoo preview',
  'Tu tatuaje': 'Your tattoo',
  'No se pudo leer la imagen. Intenta con otra.': 'Could not read the image. Try another one.',
  'Subiendo foto...': 'Uploading photo...',
  'Foto subida': 'Photo uploaded',
  'Ahora elige tu diseño 3D': 'Now choose your 3D design',
  'Elige el diseño 3D para tu tatuaje': 'Choose the 3D design for your tattoo',
  'Más diseños disponibles próximamente': 'More designs coming soon',
  'Analizando tu tatuaje': 'Analyzing your tattoo',
  'Extrayendo los puntos que lo hacen único.': 'Extracting the points that make it unique.',
  'Guardando': 'Saving',
  'Subiendo el descriptor visual de tu tatuaje.': 'Uploading your tattoo’s visual descriptor.',
  'Activando': 'Activating',
  'Vinculando tu tatuaje con el diseño 3D.': 'Linking your tattoo to the 3D design.',

  // ── Veredicto de calidad de rastreo ──
  'Tu tatuaje, medido': 'Your tattoo, measured',
  'Así se va a comportar con la cámara': 'How it will behave with the camera',
  'Tatuaje listo': 'Tattoo ready',
  'Esta foto va a rastrear mal': 'This photo will track poorly',
  'Esta foto va a funcionar, pero justo': 'This photo will work, but barely',
  'El contenido va a costar que aparezca, y va a vibrar o despegarse al mover la cámara.':
    'The content will be hard to trigger, and will jitter or drift when you move the camera.',
  'Va a funcionar con buena luz y la cámara cerca. Otra foto podría mejorarlo.':
    'It will work in good light with the camera close. Another photo could do better.',
  'Seguimiento': 'Tracking',
  'Que el contenido se quede pegado al mover la cámara':
    'Whether the content stays anchored as the camera moves',
  'Detección': 'Detection',
  'Que la cámara reconozca el tatuaje desde varias distancias':
    'Whether the camera recognizes the tattoo from various distances',
  '{n} puntos': '{n} points',
  'Reparto': 'Spread',
  'Que los puntos no estén todos en una esquina':
    'Whether the points are spread out instead of bunched in one corner',
  'Cómo mejorarla': 'How to improve it',
  'Tomar otra foto': 'Take another photo',
  'Activar de todos modos': 'Activate anyway',
  'Continuar': 'Continue',

  // Motivos y consejos del analizador. El worker manda un código estable y su
  // texto en español; estas son las mismas frases, rearmadas aquí para poder
  // traducirlas. Los {marcadores} deben conservarse idénticos.
  'Pocos puntos de seguimiento: {n} de {max} posibles ({pct}%). El contenido va a vibrar o despegarse al mover la cámara.':
    'Few tracking points: {n} of {max} possible ({pct}%). The content will jitter or drift as the camera moves.',
  'Pocos puntos de detección ({n}). Va a costar que la cámara reconozca el tatuaje.':
    'Few detection points ({n}). The camera will struggle to recognize the tattoo.',
  'Puntos concentrados en {n} de 9 zonas. El seguimiento se pierde si esa zona sale del encuadre.':
    'Points concentrated in {n} of 9 zones. Tracking breaks if that zone leaves the frame.',
  'El {pct}% de los puntos cae en una sola zona de la imagen.':
    '{pct}% of the points fall in a single zone of the image.',
  'Resolución baja: el lado menor mide {n}px y se recomiendan al menos 800px.':
    'Low resolution: the short side is {n}px and at least 800px is recommended.',
  'Solo {n} niveles de escala con puntos útiles. Se va a detectar únicamente a una distancia específica.':
    'Only {n} scale levels with usable points. It will only be detected at one specific distance.',
  'Los tatuajes con sombreado, textura o líneas densas se siguen mucho mejor que el trazo fino.':
    'Tattoos with shading, texture or dense linework track far better than fine linework.',
  'Mejora el contraste: luz lateral suave, sin flash directo, sin reflejos en la piel.':
    'Improve contrast: soft side light, no direct flash, no glare on the skin.',
  'Encuadra el tatuaje completo y centrado, sin partes cortadas ni piel vacía de más.':
    'Frame the whole tattoo, centered, with nothing cropped and no excess bare skin.',
  'Toma la foto más cerca o con mejor cámara — no la recortes de una imagen más grande.':
    'Shoot closer or with a better camera — don’t crop it out of a larger image.',
  'Está tardando más de lo normal. No cierres la app.':
    'This is taking longer than usual. Don’t close the app.',

  // ── Catálogo de modelos ──
  'Perro rigged con animaciones de trote y rascado':
    'Rigged dog with canter and scratch animations',
  'Criatura mítica con 5 animaciones: parado, ataque y más':
    'Mythical creature with 5 animations: idle, attack and more',
  'Personaje 3D extraído de la escena de Farmacias Similares':
    '3D character extracted from the Farmacias Similares scene',
  'Perro negro con pecho blanco — 5 animaciones': 'Black dog with a white chest — 5 animations',
  'Shiba negro': 'Black Shiba',

  // ── Escaneo ──
  'Sin tatuaje seleccionado': 'No tattoo selected',
  'Para escanear un tatuaje, necesitas el link que te compartió el dueño. Si quieres activar el tuyo, empieza aquí:':
    'To scan a tattoo you need the link its owner shared with you. If you want to activate your own, start here:',

  // ── Perfil ──
  'Mi perfil': 'My profile',
  'Inicia sesión para ver tus tatuajes activados': 'Sign in to see your activated tattoos',
}

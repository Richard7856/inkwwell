/**
 * Autenticación: código de 6 dígitos por correo, o correo y contraseña.
 *
 * ── Por qué código y no enlace mágico ──
 * Un enlace obliga a salir de la app al correo y volver, y ese regreso dentro de
 * un APK requiere configurar deep links en Android. Un código se teclea sin
 * salir: funciona igual en web y en la app, sin configuración nativa.
 *
 * ── Quién inicia sesión ──
 * SOLO quien activa un tatuaje (el que paga). Quien escanea nunca — si ver un
 * tatuaje exigiera cuenta, se perdería la viralidad que sostiene el producto.
 * Las políticas de la base de datos están escritas con esa separación.
 *
 * REQUIERE que la plantilla de correo de Supabase incluya {{ .Token }}.
 * La plantilla por defecto solo trae el enlace, y entonces el usuario nunca ve
 * el código. Ver AUTH-SETUP.md.
 *
 * ── Por qué TAMBIÉN hay contraseña ──
 * El código por correo es mejor para el usuario real, pero depende de que un
 * correo llegue, y el servicio integrado de Supabase está limitado a unos pocos
 * envíos por hora y documentado como "solo para pruebas". Eso deja dos huecos:
 * no hay credenciales fijas que entregarle al revisor de Google Play —que
 * rechaza la app si no puede entrar— ni a los jueces del concurso, y un tope de
 * envíos alcanzado durante una demo deja a todos fuera.
 * La contraseña no reemplaza al código: es la vía que no depende del correo.
 */
import { supabase } from './supabase.js'

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase no configurado. Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.')
  }
  return supabase
}

/**
 * Envía el código de acceso al correo. Crea la cuenta si no existía —
 * registro e inicio de sesión son el mismo paso, sin formulario aparte.
 *
 * @param {string} email
 */
export async function sendLoginCode(email) {
  const client = requireClient()
  const { error } = await client.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  })

  if (error) {
    /*
      El servicio de correo integrado de Supabase tiene un límite bajo de envíos
      por hora y está pensado solo para pruebas. Al probar repetidamente se
      alcanza rápido, y el mensaje crudo ("email rate limit exceeded") no le dice
      nada a quien lo lee.
    */
    if (/rate limit/i.test(error.message)) {
      throw new Error('Demasiados intentos. Espera unos minutos antes de pedir otro código.')
    }
    throw new Error(`No se pudo enviar el código: ${error.message}`)
  }
}

/**
 * Valida el código y abre la sesión.
 *
 * @param {string} email - El mismo al que se envió el código
 * @param {string} code - 6 dígitos
 * @returns {Promise<import('@supabase/supabase-js').Session>}
 */
export async function verifyLoginCode(email, code) {
  const client = requireClient()
  const { data, error } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    // 'email' cubre tanto el alta como el reingreso; 'magiclink' solo serviría
    // para cuentas ya existentes y fallaría en el primer acceso
    type: 'email',
  })

  if (error) {
    if (/expired|invalid/i.test(error.message)) {
      throw new Error('Código incorrecto o vencido. Pide uno nuevo.')
    }
    throw new Error(`No se pudo verificar el código: ${error.message}`)
  }
  return data.session
}

export async function signOut() {
  await requireClient().auth.signOut()
}

/** Sesión actual, o null. Se lee del almacenamiento local, no de la red. */
export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session ?? null
}

/**
 * Suscribe a cambios de sesión (login, logout, refresco del token).
 * @returns {() => void} Función para desuscribirse
 */
export function onAuthChange(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

/*
  Longitud mínima de contraseña.

  Supabase acepta 6 por defecto. Se exige 8 y se valida en el cliente para que
  el usuario lo sepa ANTES de enviar: el error del servidor llega en inglés y
  sin decir cuántos caracteres faltan.
*/
export const MIN_PASSWORD = 8

/**
 * Crea la cuenta con correo y contraseña.
 *
 * Con la confirmación de correo desactivada en Supabase, esto abre sesión de
 * inmediato y no manda ningún correo — que es justamente el punto: es la vía
 * que funciona aunque el envío de correos esté caído o topado.
 *
 * @returns {Promise<import('@supabase/supabase-js').Session>}
 */
export async function signUpWithPassword(email, password) {
  const client = requireClient()
  if (password.length < MIN_PASSWORD) {
    throw new Error(`La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`)
  }

  const { data, error } = await client.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      throw new Error('Ese correo ya tiene cuenta. Entra con tu contraseña.')
    }
    throw new Error(`No se pudo crear la cuenta: ${error.message}`)
  }

  /*
    Sin sesión pese a no haber error significa que la confirmación de correo
    sigue activada en el panel: Supabase creó el usuario y mandó un correo de
    verificación. Sin este aviso, la pantalla se quedaría muda y el usuario no
    sabría que le falta un paso.
  */
  if (!data.session) {
    throw new Error(
      'Cuenta creada, pero falta confirmar el correo. Revisa tu bandeja, ' +
      'o desactiva "Confirm email" en Supabase → Authentication → Providers.'
    )
  }
  return data.session
}

/**
 * Abre sesión con correo y contraseña ya existentes.
 * @returns {Promise<import('@supabase/supabase-js').Session>}
 */
export async function signInWithPassword(email, password) {
  const client = requireClient()
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error) {
    // El mensaje crudo ("Invalid login credentials") no distingue entre correo
    // desconocido y contraseña mala — a propósito, para no revelar qué correos
    // existen. Se traduce conservando esa ambigüedad.
    if (/invalid login credentials/i.test(error.message)) {
      throw new Error('Correo o contraseña incorrectos.')
    }
    if (/email not confirmed/i.test(error.message)) {
      throw new Error('Falta confirmar tu correo antes de entrar.')
    }
    throw new Error(`No se pudo entrar: ${error.message}`)
  }
  return data.session
}

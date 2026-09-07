/**
 * Autenticación con código de 6 dígitos por correo.
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
 * el código. Ver DEPLOY.md.
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

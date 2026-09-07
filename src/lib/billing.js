import { Capacitor } from '@capacitor/core'
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor'

/**
 * Cobro con RevenueCat.
 *
 * ── Por qué RevenueCat y no cobrar por fuera ──
 * El premio mayor del Shipaton se mide sobre lo facturado a través de su SDK, así
 * que durante el concurso todo el cobro pasa por aquí aunque las tiendas se
 * queden con 15-30%. Ver SHIPATON.md.
 *
 * ── Por qué solo en nativo ──
 * Este plugin es un puente a código Android; en el navegador no existe y
 * cualquier llamada revienta. Y el navegador es justo donde vive el circuito de
 * crecimiento: alguien abre la liga de un tatuaje sin instalar nada. Si el cobro
 * tumbara esa pantalla, se rompería lo que hace viral al producto por una
 * función que esa persona ni siquiera va a usar. Por eso todo aquí es no-op en web.
 */

const API_KEY = import.meta.env.VITE_REVENUECAT_ANDROID_KEY || ''

let configurado = false

/** ¿Se puede cobrar en este dispositivo? Falso en navegador o sin llave. */
export function isBillingAvailable() {
  return Capacitor.isNativePlatform() && !!API_KEY
}

/**
 * Arranca RevenueCat y lo amarra a la cuenta de Supabase.
 *
 * El `appUserID` es la pieza clave: sin él, RevenueCat inventa un identificador
 * anónimo por instalación, y las compras quedarían atadas al teléfono en vez de
 * a la persona — al cambiar de celular perdería sus créditos y no habría forma
 * de reconciliarlo con lo que dice Supabase.
 *
 * Nunca lanza: un fallo de cobro no puede impedir que la app abra. Si esto
 * falla, la app sigue funcionando y solo el cobro queda inhabilitado.
 *
 * @param {string} userId - id del usuario de Supabase Auth
 * @returns {Promise<boolean>} si quedó listo para cobrar
 */
export async function initBilling(userId) {
  if (!isBillingAvailable() || !userId) return false
  if (configurado) return true

  try {
    if (import.meta.env.DEV) {
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG })
    }
    await Purchases.configure({ apiKey: API_KEY, appUserID: userId })
    configurado = true
    return true
  } catch (err) {
    // Se registra y se sigue: sin esto el fallo sería invisible y luego
    // aparecería como "el botón de comprar no hace nada"
    console.error('[billing] No se pudo configurar RevenueCat:', err)
    return false
  }
}

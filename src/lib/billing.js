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

/*
  ─────────────────────────────────────────────────────────────────────────────
  Compra de créditos
  ─────────────────────────────────────────────────────────────────────────────
*/

/**
 * Error de compra ya interpretado.
 *
 * POR QUÉ EXISTE: RevenueCat devuelve códigos numéricos en texto ("1", "20")
 * que no significan nada para quien llama, y la mitad de ellos NO son fallas.
 * Cancelar una compra es el caso más común de todos y no debe pintarse en rojo.
 * Traducir aquí evita que cada pantalla reinvente esa distinción.
 */
export class ErrorCompra extends Error {
  /** @param {'cancelado'|'pendiente'|'no-disponible'|'tienda'|'red'|'desconocido'} tipo */
  constructor(tipo, message) {
    super(message)
    this.tipo = tipo
    // Cancelar no es un fallo: el usuario cambió de opinión, que es su derecho
    this.esFallo = tipo !== 'cancelado'
  }
}

// Códigos de PURCHASES_ERROR_CODE (@revenuecat/purchases-typescript-internal-esm).
// Se comparan como texto porque el SDK los emite así, no como número.
const TIPO_POR_CODIGO = {
  1: 'cancelado',      // PURCHASE_CANCELLED_ERROR
  2: 'tienda',         // STORE_PROBLEM_ERROR
  3: 'no-disponible',  // PURCHASE_NOT_ALLOWED_ERROR
  5: 'no-disponible',  // PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR
  10: 'red',           // NETWORK_ERROR
  20: 'pendiente',     // PAYMENT_PENDING_ERROR
  23: 'no-disponible', // CONFIGURATION_ERROR
}

function interpretar(err) {
  const tipo = TIPO_POR_CODIGO[String(err?.code)] ?? 'desconocido'
  return new ErrorCompra(tipo, err?.message || 'La compra no se pudo completar')
}

/**
 * Paquetes de créditos disponibles para comprar.
 *
 * ── Por qué la Offering y no identificadores fijos en el código ──
 * Los precios y los paquetes se administran desde el panel de RevenueCat. Si
 * estuvieran escritos aquí, cambiar un precio exigiría compilar, entregar a Play
 * y esperar otra revisión — imposible para probar precios.
 *
 * ── El modo de fallar que hay que reconocer ──
 * Si los productos existen en Play y están dados de alta en RevenueCat pero NO
 * se metieron en una Offering, esto devuelve un arreglo VACÍO sin ningún error.
 * No es una falla de red ni de configuración del SDK: es una lista vacía. La
 * pantalla debe distinguir "no hay nada que vender" de "algo se rompió".
 *
 * @returns {Promise<Array<{id: string, precio: string, titulo: string, paquete: object}>>}
 */
export async function obtenerPaquetes() {
  if (!isBillingAvailable()) return []

  const { current } = await Purchases.getOfferings()
  const paquetes = current?.availablePackages ?? []

  return paquetes.map((p) => ({
    id: p.identifier,
    // priceString ya viene con la moneda local que la tienda le muestra al
    // usuario. Formatearlo aquí produciría un precio distinto al que va a pagar.
    precio: p.product.priceString,
    titulo: p.product.title,
    paquete: p,
  }))
}

/**
 * Lanza la compra de un paquete.
 *
 * OJO: que esto resuelva significa que la TIENDA cobró, no que los créditos ya
 * estén en el libro mayor. Eso llega por el webhook, después. Ver
 * `esperarAcreditacion()` en lib/creditos.js.
 *
 * @param {object} paquete - El `paquete` de obtenerPaquetes()
 * @returns {Promise<{productId: string}>}
 * @throws {ErrorCompra} Siempre de este tipo — nunca el error crudo del SDK
 */
export async function comprarPaquete(paquete) {
  if (!isBillingAvailable()) {
    throw new ErrorCompra('no-disponible', 'El cobro no está disponible en este dispositivo')
  }

  try {
    const { productIdentifier } = await Purchases.purchasePackage({ aPackage: paquete })
    return { productId: productIdentifier }
  } catch (err) {
    throw interpretar(err)
  }
}

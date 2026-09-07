/**
 * Construcción de ligas públicas compartibles.
 *
 * ── Por qué NO se usa window.location.origin ──
 * Dentro del APK, Capacitor sirve la app desde `https://localhost` (ver
 * `androidScheme` en capacitor.config.json). Usar el origen actual haría que el
 * botón de compartir copiara `https://localhost/scan?...`, una liga que no abre
 * en ningún otro dispositivo. Y como el loop de crecimiento entero depende de
 * que alguien más abra esa liga, el producto se rompería en silencio: el dueño
 * cree que compartió su tatuaje y nadie puede verlo.
 *
 * Lo mismo pasaría, más discretamente, con las URLs de vista previa de Vercel:
 * la liga funcionaría hoy y moriría cuando esa vista previa expire.
 *
 * Por eso las ligas compartibles SIEMPRE apuntan al dominio público.
 */

const BASE = (import.meta.env.VITE_PUBLIC_URL || 'https://inkar.app').replace(/\/+$/, '')

/**
 * @param {string} ruta - Ruta de la app, con o sin diagonal inicial
 * @returns {string} URL absoluta al dominio público
 */
export function ligaPublica(ruta) {
  return `${BASE}${ruta.startsWith('/') ? ruta : `/${ruta}`}`
}

/** Liga para escanear un tatuaje concreto. */
export function ligaDeTatuaje(tattooId) {
  return ligaPublica(`/scan?tattoo=${tattooId}`)
}

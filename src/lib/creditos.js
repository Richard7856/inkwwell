import { supabase } from './supabase.js'

/**
 * Saldo de créditos del usuario.
 *
 * ── Por qué una función de la base y no una suma en el cliente ──
 * El saldo sale de sumar el libro mayor, y ese libro solo es legible por su
 * dueño (política `ledger_lee_propio`). Sumarlo aquí obligaría a traerse todos
 * los movimientos al teléfono para reducirlos, cuando la base lo hace en una
 * consulta. `saldo_creditos()` vive en la migración 006.
 *
 * @returns {Promise<number>} Créditos disponibles. 0 si no hay sesión.
 */
export async function obtenerSaldo() {
  if (!supabase) return 0

  const { data, error } = await supabase.rpc('saldo_creditos')
  if (error) {
    // Se propaga con contexto: un saldo mal leído no puede confundirse con
    // "tienes cero", que llevaría a ofrecerle comprar a quien ya pagó
    throw new Error(`No se pudo leer tu saldo de créditos: ${error.message}`)
  }
  return data ?? 0
}

/*
  Espera a que una compra se refleje en el saldo.

  ── POR QUÉ ESTO ES NECESARIO Y NO SE PUEDE EVITAR ──
  Cuando `purchasePackage()` resuelve, la tienda ya cobró — pero los créditos
  NO están todavía en el libro mayor. El camino real es:

      Play cobra → RevenueCat recibe → webhook → insert en credit_ledger

  Ese viaje tarda de cientos de milisegundos a varios segundos.

  ── POR QUÉ EL CLIENTE NO PUEDE SIMPLEMENTE SUMARLOS ──
  A propósito no existe política de INSERT sobre `credit_ledger`: la llave
  anónima viaja pública dentro del bundle, así que cualquiera que pudiera
  escribir ahí se regalaría créditos infinitos. El webhook, que entra con
  permisos de servicio, es la única fuente que acredita. No es una limitación
  a rodear: es la que hace que los créditos valgan algo.

  ── QUÉ PASA SI NO SE ESPERA ──
  El usuario paga, vuelve a la pantalla, ve el mismo saldo de antes y concluye
  que el cobro falló. Pide reembolso por algo que sí funcionó.

  @param {number} saldoPrevio - Saldo leído ANTES de lanzar la compra
  @param {object} [opciones]
  @param {number} [opciones.intentos=20]
  @param {number} [opciones.esperaMs=1500]
  @returns {Promise<{acreditado: boolean, saldo: number}>}
    `acreditado` en false NO significa que el pago falló — significa que todavía
    no llega. Quien llame debe decirlo así.
*/
export async function esperarAcreditacion(saldoPrevio, opciones = {}) {
  const { intentos = 20, esperaMs = 1500 } = opciones

  let saldo = saldoPrevio

  for (let i = 0; i < intentos; i++) {
    await new Promise((r) => setTimeout(r, esperaMs))

    try {
      saldo = await obtenerSaldo()
    } catch {
      // Un fallo de red a media espera no cancela la espera: el webhook sigue
      // su curso del lado del servidor y el siguiente intento puede verlo
      continue
    }

    if (saldo > saldoPrevio) return { acreditado: true, saldo }
  }

  return { acreditado: false, saldo }
}

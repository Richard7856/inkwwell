/**
 * Webhook de RevenueCat: acredita y revoca créditos.
 *
 * ── Por qué el servidor y no el cliente ──
 * Sería más simple que la app, tras una compra exitosa, escribiera los créditos.
 * Pero entonces cualquiera con la llave anónima —que va pública en el bundle—
 * se regalaría créditos infinitos sin pagar. Por eso `credit_ledger` no tiene
 * política de INSERT: solo esta función, con la llave de servicio, escribe ahí.
 *
 * ── Cómo se autentica RevenueCat ──
 * No manda un JWT de usuario, así que `verify_jwt` va apagado y en su lugar se
 * exige un secreto compartido en la cabecera Authorization, configurado en el
 * panel de RevenueCat. Sin ese secreto, cualquiera que descubra la URL podría
 * acreditarse.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

/*
  Cuántos créditos da cada producto.

  Los identificadores TIENEN que coincidir exactamente con los de Play Console.
  Se leen del entorno para poder cambiar precios y paquetes sin volver a
  desplegar; el valor por defecto documenta la forma esperada.
*/
const CREDITOS_POR_PRODUCTO: Record<string, number> = (() => {
  try {
    const crudo = Deno.env.get('CREDITOS_POR_PRODUCTO')
    if (crudo) return JSON.parse(crudo)
  } catch (e) {
    console.error('[webhook] CREDITOS_POR_PRODUCTO no es JSON válido:', e)
  }
  // creditos_primero es el primer crédito a mitad de precio: mismo crédito,
  // distinto SKU porque Play no tiene precio introductorio para productos únicos
  return { creditos_primero: 1, creditos_1: 1, creditos_3: 3, creditos_5: 5 }
})()

/** Eventos que acreditan. Los consumibles llegan como NON_RENEWING_PURCHASE. */
const ACREDITAN = new Set(['NON_RENEWING_PURCHASE', 'INITIAL_PURCHASE', 'RENEWAL'])
/** Eventos que revierten: el dinero se devolvió, los créditos también. */
const REVOCAN = new Set(['REFUND', 'CANCELLATION'])

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' })

  const secreto = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')
  if (!secreto) {
    console.error('[webhook] Falta REVENUECAT_WEBHOOK_SECRET')
    return json(500, { error: 'Webhook sin configurar' })
  }
  if (req.headers.get('Authorization') !== secreto) {
    // No se detalla el motivo: a quien sondea la URL no se le explica qué falló.
    return json(401, { error: 'No autorizado' })
  }

  let evento: Record<string, unknown>
  try {
    const cuerpo = await req.json()
    evento = (cuerpo?.event ?? {}) as Record<string, unknown>
  } catch {
    return json(400, { error: 'Cuerpo ilegible' })
  }

  const tipo = String(evento.type ?? '')
  const usuario = String(evento.app_user_id ?? '')
  const producto = String(evento.product_id ?? '')
  // El id del evento identifica el hecho; el de transacción puede repetirse
  // entre eventos distintos del mismo pago (compra y luego reembolso).
  const referencia = String(evento.id ?? evento.transaction_id ?? '')

  const acredita = ACREDITAN.has(tipo)
  const revoca = REVOCAN.has(tipo)
  if (!acredita && !revoca) {
    // Se responde 200 a propósito: RevenueCat manda muchos tipos de evento y
    // devolver error haría que reintente indefinidamente algo que ignoramos.
    return json(200, { ignorado: tipo })
  }

  /*
    app_user_id debe ser el id de Supabase porque billing.js configura
    RevenueCat con él. Si llega otra cosa —un identificador anónimo de una
    instalación sin sesión— no hay a quién acreditar, y hay que verlo en los
    registros en vez de fallar en silencio.
  */
  if (!UUID.test(usuario)) {
    console.error('[webhook] app_user_id no es un usuario de Supabase:', usuario, tipo)
    return json(200, { ignorado: 'usuario anónimo', app_user_id: usuario })
  }

  const creditos = CREDITOS_POR_PRODUCTO[producto]
  if (!creditos) {
    console.error('[webhook] producto sin créditos asignados:', producto)
    return json(200, { ignorado: 'producto desconocido', producto })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { error } = await admin.from('credit_ledger').insert({
    user_id: usuario,
    delta: acredita ? creditos : -creditos,
    motivo: acredita ? 'compra' : 'reembolso',
    referencia,
    detalle: { tipo, producto, entorno: evento.environment ?? null },
  })

  if (error) {
    /*
      23505 es choque con el índice de idempotencia: este evento ya se procesó.
      RevenueCat reintenta ante cualquier duda, así que es normal y esperado —
      se responde 200 para que deje de reintentar. Devolver error haría que
      insistiera para siempre con algo que ya está hecho.
    */
    if (error.code === '23505') return json(200, { repetido: referencia })
    console.error('[webhook] no se pudo registrar el movimiento:', error.message)
    return json(500, { error: error.message })
  }

  console.log(`[webhook] ${tipo} · ${producto} · ${acredita ? '+' : '-'}${creditos} · ${usuario}`)
  return json(200, { ok: true, creditos: acredita ? creditos : -creditos })
})

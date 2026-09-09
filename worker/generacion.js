/**
 * Orquestación de una generación: del pedido del usuario al video en su tatuaje.
 *
 * ── El orden importa, y por qué ──
 *   1. verificar sesión          → a quién cobrar y de quién es el tatuaje
 *   2. crear la fila             → hay un id desde antes de gastar nada
 *   3. reservar el crédito       → con cerrojo; si no alcanza, se acaba aquí
 *   4. enviar a Higgsfield       → si falla, se REEMBOLSA (fue culpa nuestra o suya)
 *   5. responder al cliente      → con el id, en segundos
 *   6. sondear en segundo plano  → minutos; el cliente lee el estado de la base
 *   7. copiar el video a Storage → los de Higgsfield caducan a los 7 días
 *   8. asignarlo al tatuaje      → y marcar la generación como lista
 *
 * Reservar ANTES de enviar y no después evita gastar dinero del proveedor sin
 * tener el crédito del usuario; reembolsar cuando el envío o la generación
 * fallan evita que un tropiezo nuestro le cueste al usuario. El libro mayor
 * hace ambas operaciones idempotentes: reintentar no cobra ni devuelve dos veces.
 *
 * ── Por qué se responde antes de terminar ──
 * Una generación tarda minutos. Mantener la petición HTTP abierta ese tiempo
 * la expone a cualquier proxy o red móvil que corte a los 30-60 s, y entonces
 * el cliente no sabría si el pedido entró. Con el id en mano, el cliente sondea
 * `generaciones` (política: lee lo suyo) y puede cerrar la app: el video llega
 * igual.
 */
import * as db from './supabase-admin.js'
import * as hf from './higgsfield.js'
import { ErrorGeneracion } from './supabase-admin.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/*
  El fondo verde lo pide el prompt, no un parámetro: ningún modelo expone
  "fondo de croma". Y ninguno respeta el color exacto —se pidió #00FF00 y salió
  [105,195,80]— pero sí producen un fondo plano, que es lo que la capa de video
  necesita: ella MIDE el color real y recorta con ese. Ver videoLayer.js.
*/
function promptDe(historia) {
  return (
    'Plain flat solid bright green screen background, uniform color, no other ' +
    'background elements, no text. Subject centered, natural gentle motion. ' +
    historia.trim()
  )
}

function validar({ tattooId, fotoUrl, historia }) {
  if (!UUID.test(String(tattooId ?? ''))) {
    throw new ErrorGeneracion('tatuaje_invalido', 'tattooId no es un identificador válido', 400)
  }
  if (!/^https:\/\/\S+$/.test(String(fotoUrl ?? ''))) {
    throw new ErrorGeneracion('foto_invalida', 'fotoUrl debe ser una URL https pública', 400)
  }
  const h = String(historia ?? '').trim()
  if (h.length < 3 || h.length > 600) {
    throw new ErrorGeneracion('historia_invalida', 'La historia debe tener entre 3 y 600 caracteres', 400)
  }
  return { tattooId, fotoUrl, historia: h }
}

/**
 * Arranca una generación. Resuelve en cuanto Higgsfield acepta la petición;
 * el resto sigue en segundo plano.
 *
 * @returns {Promise<{ generacionId: string, saldo: number }>}
 */
export async function iniciarGeneracion({ authorization, ...cuerpo }) {
  if (!db.supabaseConfigurado || !hf.higgsfieldConfigurado) {
    throw new ErrorGeneracion(
      'no_configurado',
      'El worker no tiene configuradas las llaves de Supabase o de Higgsfield',
      503,
    )
  }

  const { tattooId, fotoUrl, historia } = validar(cuerpo)
  const userId = await db.verificarUsuario(authorization)
  await db.tatuajeDelUsuario(userId, tattooId)

  const generacionId = await db.crearGeneracion({
    userId, tattooId, modelo: hf.ENDPOINT, fotoUrl, historia,
  })
  const etiqueta = `[generacion ${generacionId}]`

  let saldo
  try {
    saldo = await db.reservarCredito(userId, generacionId)
  } catch (err) {
    await db.actualizarGeneracion(generacionId, { estado: 'fallida', error: err.message })
    throw err
  }

  let requestId
  try {
    ;({ requestId } = await hf.enviar({ prompt: promptDe(historia), imageUrl: fotoUrl }))
  } catch (err) {
    console.error(`${etiqueta} Higgsfield rechazó el envío:`, err.message)
    await db.reembolsar(userId, generacionId)
    await db.actualizarGeneracion(generacionId, { estado: 'fallida', error: err.message })
    throw new ErrorGeneracion('proveedor', `El generador no aceptó la petición: ${err.message}`, 502)
  }

  await db.actualizarGeneracion(generacionId, { request_id: requestId, estado: 'pendiente' })
  console.log(`${etiqueta} enviada · ${hf.ENDPOINT} · request ${requestId}`)

  // Sin await a propósito: ver el encabezado del archivo
  completar({ generacionId, userId, tattooId, requestId }).catch((err) => {
    console.error(`${etiqueta} error inesperado al completar:`, err)
  })

  return { generacionId, saldo }
}

/** Segunda mitad: esperar, copiar, asignar — o reembolsar. */
async function completar({ generacionId, userId, tattooId, requestId }) {
  const etiqueta = `[generacion ${generacionId}]`

  const r = await hf.esperar(requestId, {
    onEstado: (s) => {
      if (s === 'in_progress') db.actualizarGeneracion(generacionId, { estado: 'en_proceso' })
    },
  })

  if (r.status === 'completed' && r.videoUrl) {
    try {
      const buffer = await descargar(r.videoUrl)
      const url = await db.subirVideo(generacionId, buffer)
      await db.asignarVideoAlTatuaje(tattooId, url)
      await db.actualizarGeneracion(generacionId, { estado: 'lista', video_url: url, error: null })
      console.log(`${etiqueta} ✓ lista · ${(buffer.byteLength / 1024).toFixed(0)}KB`)
      return
    } catch (err) {
      // El video existió pero no lo pudimos guardar: es culpa nuestra
      console.error(`${etiqueta} generó pero no se pudo guardar:`, err.message)
      await db.reembolsar(userId, generacionId)
      await db.actualizarGeneracion(generacionId, { estado: 'fallida', error: err.message })
      return
    }
  }

  const estado = r.status === 'nsfw' ? 'rechazada' : 'fallida'
  console.warn(`${etiqueta} ${estado}: ${r.error ?? r.status}`)
  await db.reembolsar(userId, generacionId)
  await db.actualizarGeneracion(generacionId, { estado, error: r.error ?? r.status })
}

async function descargar(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo descargar el video (${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Al arrancar, retoma las generaciones que quedaron a medias.
 *
 * Si Railway reinicia el contenedor con un sondeo en curso, la fila queda en
 * 'pendiente' o 'en_proceso' para siempre y el usuario ni recibe el video ni
 * el crédito. Como Higgsfield conserva la petición, basta con volver a
 * esperarla. Nunca lanza: un fallo aquí no puede impedir que el worker arranque.
 */
export async function reanudarPendientes() {
  if (!db.supabaseConfigurado || !hf.higgsfieldConfigurado) return
  try {
    const filas = await db.generacionesEnCurso()
    if (filas.length) console.log(`[generacion] reanudando ${filas.length} en curso`)
    for (const g of filas) {
      completar({ generacionId: g.id, userId: g.user_id, tattooId: g.tattoo_id, requestId: g.request_id })
        .catch((err) => console.error(`[generacion ${g.id}] error al reanudar:`, err))
    }
  } catch (err) {
    console.error('[generacion] no se pudieron leer las pendientes:', err.message)
  }
}

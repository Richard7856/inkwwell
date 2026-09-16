/**
 * ¿Se puede generar video ahora mismo? Lo que la app necesita saber ANTES de
 * ofrecer "Anima tu recuerdo".
 *
 * ── Por qué no basta con mirar el entorno ──
 * Que las llaves estén puestas no significa que la generación funcione: la
 * cuenta de Higgsfield puede estar sin saldo, o el modelo configurado puede no
 * existir en el plan. Las dos cosas se ven idénticas desde aquí — variables
 * presentes, worker sano— y revientan recién al enviar.
 *
 * ── Por qué no se consulta el saldo ──
 * Porque no se puede. La API valida el cuerpo del pedido ANTES de revisar
 * créditos, así que una cuenta vacía responde igual que una llena a cualquier
 * sondeo que no sea una generación de verdad. Está documentado en
 * `PROXIMA-SESION.md` como trampa: `modelos.js` prometía detectarlo y era falso.
 *
 * ── Entonces, cómo ──
 * Reaccionando, no prediciendo. El único informe fiable sobre la cuenta es un
 * envío real, y `higgsfield.js` ya distingue "es culpa de nuestra cuenta"
 * (`esDeCuenta`) de "esta petición estuvo mal". Se recuerda ese fallo y se deja
 * de ofrecer el producto hasta que haya motivo para creer que se arregló. El
 * primer usuario choca —y recupera su crédito, que el reembolso es automático—;
 * los siguientes ven una pantalla honesta en vez de la misma pared.
 *
 * ── Por qué el fallo caduca en vez de quedarse fijo ──
 * Recargar Higgsfield no reinicia el worker ni avisa a nadie. Sin caducidad, el
 * producto seguiría escondido después de recargar, hasta el siguiente
 * despliegue. Pasado el enfriamiento se vuelve a ofrecer y el siguiente envío
 * real decide: si la cuenta sigue vacía, el contador arranca de nuevo.
 *
 * ── Por qué en memoria y no en la base ──
 * Es una señal operativa de segundos, no un dato del negocio. Reiniciar el
 * worker la borra, y eso es correcto: un despliegue suele ser justamente lo que
 * cambió la configuración, así que conviene volver a probar.
 */

import { supabaseConfigurado } from './supabase-admin.js'
import { higgsfieldConfigurado, ENDPOINT } from './higgsfield.js'

/** Cuánto se deja de ofrecer el producto tras un fallo de cuenta. */
const ENFRIAMIENTO_MS = 15 * 60 * 1000

/**
 * Motivos que entiende la app. Se mandan como código estable y NO como texto:
 * lo que redacta el worker no pasa por el diccionario del cliente, así que una
 * frase en español llegaría sin traducir a un teléfono en inglés.
 */
export const MOTIVOS = {
  OK: 'ok',
  NO_CONFIGURADO: 'no_configurado',
  SIN_SALDO: 'sin_saldo',
  MODELO: 'modelo',
}

/** Último fallo atribuible a nuestra cuenta: `{ motivo, cuando }` o null. */
let ultimoFallo = null

/** Traduce el `detail` de Higgsfield al motivo que viaja a la app. */
function motivoDe(detalle) {
  if (detalle === 'not_enough_credits') return MOTIVOS.SIN_SALDO
  if (detalle === 'model_not_found' || detalle === 'model_disabled') return MOTIVOS.MODELO
  return null
}

/**
 * Registra que un envío falló por nuestra cuenta. Lo llama `generacion.js` con
 * el `detail` crudo de Higgsfield; un motivo que no sea de cuenta se ignora.
 */
export function registrarFalloDeCuenta(detalle) {
  const motivo = motivoDe(detalle)
  if (!motivo) return
  ultimoFallo = { motivo, cuando: Date.now() }
  console.error(
    `[disponibilidad] generación suspendida ${ENFRIAMIENTO_MS / 60000} min · motivo ${motivo}`,
  )
}

/**
 * Registra que Higgsfield aceptó un envío. Es la única prueba de que la cuenta
 * está sana, así que borra el fallo sin esperar a que caduque.
 */
export function registrarEnvioAceptado() {
  if (!ultimoFallo) return
  console.log('[disponibilidad] generación restablecida: Higgsfield aceptó un envío')
  ultimoFallo = null
}

/**
 * Estado del generador para `/health` y para el guardia de `/generar`.
 *
 * @returns {{ disponible: boolean, motivo: string, modelo: string, reintentaEn: number|null }}
 *   `reintentaEn` son los segundos que faltan para volver a ofrecerlo; null si
 *   no hay nada que esperar.
 */
export function estadoGeneracion() {
  if (!supabaseConfigurado || !higgsfieldConfigurado) {
    return { disponible: false, motivo: MOTIVOS.NO_CONFIGURADO, modelo: ENDPOINT, reintentaEn: null }
  }

  if (ultimoFallo) {
    const restante = ENFRIAMIENTO_MS - (Date.now() - ultimoFallo.cuando)
    if (restante > 0) {
      return {
        disponible: false,
        motivo: ultimoFallo.motivo,
        modelo: ENDPOINT,
        reintentaEn: Math.ceil(restante / 1000),
      }
    }
    // Se cumplió el enfriamiento: se vuelve a ofrecer y el próximo envío decide
    ultimoFallo = null
  }

  return { disponible: true, motivo: MOTIVOS.OK, modelo: ENDPOINT, reintentaEn: null }
}

/** Solo para las pruebas: olvida el fallo recordado. */
export function _reiniciar() {
  ultimoFallo = null
}

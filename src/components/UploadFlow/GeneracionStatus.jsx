import { t } from '../../lib/i18n.js'

/**
 * Espera de la generación del video.
 *
 * ── Los estados y por qué se distinguen ──
 * 'subiendo'   — la foto va al Storage y la petición al worker. Segundos.
 * 'pendiente'  — Higgsfield la aceptó y está en fila.
 * 'en_proceso' — generando. Es la parte larga: de uno a varios minutos.
 * 'agotado'    — pasaron 10 min sin terminar. NO es un fallo: el worker sigue
 *                y el video llega solo. Se le dice al usuario que puede irse.
 * 'fallida'    — error nuestro o del proveedor. El crédito ya se devolvió.
 * 'rechazada'  — moderación del proveedor. El crédito también se devolvió.
 *
 * ── Por qué el cronómetro ──
 * Sin referencia de tiempo, a los 40 segundos la gente cree que se colgó.
 * Ver los segundos correr, junto a "suele tardar de 1 a 3 minutos", convierte
 * la espera en algo con forma.
 *
 * @param {'subiendo'|'pendiente'|'en_proceso'|'agotado'|'fallida'|'rechazada'} estado
 * @param {string|null} [error]
 * @param {number} [elapsedSeconds]
 * @param {() => void} [onReintentar] - Solo en fallida/rechazada
 */
export default function GeneracionStatus({ estado, error = null, elapsedSeconds = 0, onReintentar }) {
  const fallo = estado === 'fallida' || estado === 'rechazada'

  const TEXTOS = {
    subiendo: { titulo: t('Enviando tu recuerdo'), detalle: t('Subiendo la foto y tu historia.') },
    pendiente: { titulo: t('En la fila'), detalle: t('Tu video está por empezar a generarse.') },
    en_proceso: { titulo: t('Generando tu video'), detalle: t('Suele tardar de 1 a 3 minutos. No cierres la app.') },
    agotado: {
      titulo: t('Está tardando más de lo normal'),
      detalle: t('No es un error. El video va a llegar solo; puedes cerrar y volver en un rato.'),
    },
    fallida: {
      titulo: t('No se pudo generar el video'),
      detalle: t('Te devolvimos el crédito. Puedes intentarlo de nuevo.'),
    },
    rechazada: {
      titulo: t('El proveedor no aceptó esa foto o esa historia'),
      detalle: t('Te devolvimos el crédito. Prueba con otra foto o cambia las palabras.'),
    },
  }
  const { titulo, detalle } = TEXTOS[estado] ?? TEXTOS.en_proceso

  return (
    <div className="text-center mt-8">
      {!fallo && (
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full
                        animate-spin mx-auto mb-5" />
      )}
      <h2 className="text-xl font-semibold mb-2">{titulo}</h2>
      <p className="text-gray-400 max-w-xs mx-auto">{detalle}</p>

      {!fallo && estado !== 'agotado' && (
        <p className="text-gray-600 text-sm font-mono mt-4 tabular-nums">
          {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
        </p>
      )}

      {fallo && error && (
        <p className="text-xs text-gray-600 font-mono mt-4 max-w-xs mx-auto break-words">{error}</p>
      )}

      {fallo && onReintentar && (
        <button
          onClick={onReintentar}
          className="mt-6 bg-white text-black font-semibold py-3 px-6 rounded-full
                     hover:bg-gray-200 transition-colors"
        >
          {t('Intentar de nuevo')}
        </button>
      )}
    </div>
  )
}

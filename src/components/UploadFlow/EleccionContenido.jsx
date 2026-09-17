import { t } from '../../lib/i18n.js'
import Boton from '../ui/Boton.jsx'
import Tarjeta from '../ui/Tarjeta.jsx'

/**
 * Qué va a aparecer sobre el tatuaje: el recuerdo animado o el catálogo.
 *
 * ── Por qué el recuerdo va primero y grande ──
 * Es el producto. El catálogo es lo que existía antes del giro a video y sirve
 * para probar sin pagar; no compite en jerarquía con lo que se vende.
 *
 * ── Por qué se muestra el saldo aquí ──
 * Es el momento de la decisión. Enterarse de que no hay créditos DESPUÉS de
 * escribir la historia y subir la foto es tirar ese esfuerzo; enterarse antes
 * cuesta una línea.
 *
 * ── Por qué la tarjeta se queda cuando el generador está caído ──
 * Esconderla del todo dejaría el catálogo como si fuera la oferta completa, y
 * el usuario no sabría que se perdió de nada: aprendería que InkAR es "modelos
 * 3D gratis". Se mantiene visible, se le quita el botón y se dice que vuelve
 * pronto. Cuesta una venta hoy y conserva la expectativa, que es lo que
 * queremos que recuerde.
 *
 * ── Por qué no se explica el motivo ──
 * "La cuenta del proveedor no tiene saldo" es un problema nuestro contado como
 * si fuera suyo. Al usuario le sirve saber qué puede hacer ahora —el catálogo—
 * y que esto no es permanente. El motivo real va a los registros del worker.
 *
 * @param {number|null} saldo - null mientras carga
 * @param {boolean} [generacionDisponible=true] - false solo si el worker lo dijo;
 *   ante la duda se ofrece (ver `disponibilidadGeneracion`)
 * @param {() => void} onRecuerdo
 * @param {() => void} onCatalogo
 */
export default function EleccionContenido({
  saldo,
  generacionDisponible = true,
  onRecuerdo,
  onCatalogo,
}) {
  const sinCreditos = saldo === 0

  return (
    <div className="grid gap-4">
      <p className="text-gray-600">{t('¿Qué quieres que aparezca sobre tu tatuaje?')}</p>

      <Tarjeta destacada={generacionDisponible}>
        <p
          className={`text-[10px] uppercase tracking-wider mb-1 ${
            generacionDisponible ? 'text-tinta' : 'text-gray-500'
          }`}
        >
          {generacionDisponible ? t('1 crédito') : t('Vuelve pronto')}
        </p>
        <h3 className={`font-semibold text-lg ${generacionDisponible ? '' : 'text-gray-600'}`}>
          {t('Anima tu recuerdo')}
        </h3>
        <p className="text-sm text-gray-600 mt-1 mb-4">
          {t('Una foto y unas palabras. Tu mascota, esa persona, ese momento — cobra vida sobre tu tatuaje.')}
        </p>

        {!generacionDisponible ? (
          <p className="text-sm text-gray-500">
            {t('No se pueden crear videos en este momento. Estamos en eso — tu tatuaje ya quedó activado y puedes animarlo cuando volvamos.')}
          </p>
        ) : sinCreditos ? (
          <Boton to="/creditos">{t('Necesitas 1 crédito →')}</Boton>
        ) : (
          <Boton onClick={onRecuerdo} disabled={saldo === null}>{t('Empezar')}</Boton>
        )}

        {generacionDisponible && saldo !== null && (
          <p className="text-xs text-gray-500 text-center mt-3">
            {saldo === 1
              ? t('Tienes 1 crédito')
              : t('Tienes {n} créditos', { n: saldo })}
          </p>
        )}
      </Tarjeta>

      <Tarjeta as="button" onClick={onCatalogo} destacada={!generacionDisponible}>
        <h3 className="font-semibold">{t('Elegir del catálogo')}</h3>
        <p className="text-sm text-gray-500 mt-1">
          {t('Modelos 3D listos. Gratis, para probar cómo se ve.')}
        </p>
      </Tarjeta>
    </div>
  )
}

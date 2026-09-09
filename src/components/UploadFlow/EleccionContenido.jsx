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
 * @param {number|null} saldo - null mientras carga
 * @param {() => void} onRecuerdo
 * @param {() => void} onCatalogo
 */
export default function EleccionContenido({ saldo, onRecuerdo, onCatalogo }) {
  const sinCreditos = saldo === 0

  return (
    <div className="grid gap-4">
      <p className="text-gray-400">{t('¿Qué quieres que aparezca sobre tu tatuaje?')}</p>

      <Tarjeta destacada>
        <p className="text-[10px] uppercase tracking-wider text-realidad mb-1">
          {t('1 crédito')}
        </p>
        <h3 className="font-semibold text-lg">{t('Anima tu recuerdo')}</h3>
        <p className="text-sm text-gray-400 mt-1 mb-4">
          {t('Una foto y unas palabras. Tu mascota, esa persona, ese momento — cobra vida sobre tu tatuaje.')}
        </p>

        {sinCreditos ? (
          <Boton to="/creditos">{t('Necesitas 1 crédito →')}</Boton>
        ) : (
          <Boton onClick={onRecuerdo} disabled={saldo === null}>{t('Empezar')}</Boton>
        )}

        {saldo !== null && (
          <p className="text-xs text-gray-500 text-center mt-3">
            {saldo === 1
              ? t('Tienes 1 crédito')
              : t('Tienes {n} créditos', { n: saldo })}
          </p>
        )}
      </Tarjeta>

      <Tarjeta as="button" onClick={onCatalogo}>
        <h3 className="font-semibold">{t('Elegir del catálogo')}</h3>
        <p className="text-sm text-gray-500 mt-1">
          {t('Modelos 3D listos. Gratis, para probar cómo se ve.')}
        </p>
      </Tarjeta>
    </div>
  )
}

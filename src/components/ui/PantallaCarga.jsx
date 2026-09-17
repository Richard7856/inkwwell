import { t } from '../../lib/i18n.js'
import Logo from './Logo.jsx'
import Tinta from './Tinta.jsx'

/**
 * Pantalla de carga de marca: papel, dos trazos de tinta entrando por las
 * esquinas, el logotipo, el lema y una línea que respira.
 *
 * ── De dónde sale ──
 * Es la pieza que Richard eligió como referencia el 16 sep ("que tenga ese
 * estilo toda la app"). Se usa en las esperas que el usuario SIENTE: al abrir
 * la app (ver `index.html`, que dibuja la misma composición antes de que
 * cargue el JavaScript) y mientras se genera un video. Para esperas cortas
 * dentro de una pantalla sigue estando `Spinner`.
 *
 * ── Por qué la línea es el indicador ──
 * La referencia termina en un guion corto bajo el lema. Hacerlo respirar
 * dice "está trabajando" sin meter un elemento ajeno a la composición.
 *
 * ── Por qué `fija` es opcional ──
 * Al abrir la app ocupa toda la pantalla. Durante la generación vive dentro
 * del flujo de activación, bajo los pasos, y ahí taparlos desorienta.
 *
 * @param {boolean} [fija=true] - Ocupa toda la pantalla (position: fixed)
 * @param {import('react').ReactNode} [children] - Mensaje de estado bajo la línea
 */
export default function PantallaCarga({ fija = true, children = null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${fija ? 'fixed inset-0 z-50' : 'relative min-h-[70vh] rounded-lg'}
                  overflow-hidden bg-claridad text-tinta flex flex-col items-center justify-center px-8`}
    >
      {/*
        Los trazos entran por esquinas opuestas, como en la pieza de marca.
        Solo 01 y 02: 03-esquina trae la tinta recortada en sus propios bordes y
        ese corte recto quedaba a la vista. Posiciones diseñadas a 390x844; se
        anclan a su esquina, así que en otras pantallas siguen sangrando fuera.
        Mismas medidas en index.html (.ci-arriba / .ci-abajo).
      */}
      <Tinta
        src="/tinta/01-diagonal.png"
        className="trazo-entra -top-[140px] -left-[120px] w-[480px] h-[320px]"
      />
      <Tinta
        src="/tinta/02-curvo.png"
        className="trazo-entra trazo-entra-tarde -bottom-[86px] -right-[260px] w-[480px] h-[320px] rotate-180"
      />

      <div className="relative flex flex-col items-center text-center">
        <Logo alto={52} />
        <p className="mt-3 text-[10px] tracking-[0.34em] uppercase text-gray-700">
          {t('Historias que siguen vivas')}
        </p>
        <span className="linea-respira mt-5 block h-[1.5px] w-8 bg-tinta" />
        {children && <div className="mt-8 max-w-xs">{children}</div>}
      </div>
    </div>
  )
}

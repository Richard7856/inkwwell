/**
 * Veredicto de calidad de rastreo, mostrado antes de activar.
 *
 * ── Qué problema resuelve ──
 * MindAR no se entrena: si la foto no tiene suficientes puntos de interés
 * únicos, ningún ajuste en tiempo de ejecución lo salva. Un tatuaje que rastrea
 * mal va a fallar siempre. Enterarse DESPUÉS de pagar produce un reembolso;
 * enterarse antes produce, en el peor caso, otra foto.
 *
 * ── Por qué advierte en vez de bloquear ──
 * Los umbrales de `worker/analyzer.js` son heurísticas sin calibrar — así lo
 * dice su propio encabezado. Bloquear con umbrales equivocados rechazaría
 * tatuajes que sí funcionan, y eso es peor que un reembolso: el usuario se va
 * sin producto y sin recurso. Mientras no haya datos para calibrar, la decisión
 * final es del humano y cada "activar de todos modos" se registra: es
 * exactamente el caso donde el analizador y la persona no coincidieron, que es
 * el dato que permite mover los umbrales con evidencia.
 *
 * ── Por qué el nivel decide el tono y no solo el texto ──
 * Con 'malo' el camino cómodo debe ser repetir la foto. Con 'aceptable' debe
 * ser continuar: el tatuaje del fundador mide 16% de seguimiento —'aceptable'
 * por poco— y funciona con buena luz. Poner una pared ahí espantaría a la
 * mayoría de los tatuajes reales, que es justo el público del producto.
 *
 * Los niveles 'bueno' y 'excelente' no llegan aquí: el llamador los salta para
 * no meter una pantalla de felicitación en medio del flujo.
 *
 * @param {object} metrics - Métricas del analizador (worker/analyzer.js)
 * @param {() => void} onRetake - Volver a tomar la foto
 * @param {() => void} onContinue - Seguir al selector de diseño
 */
import { t } from '../../lib/i18n.js'

export default function QualityReport({ metrics, onRetake, onContinue }) {
  const { verdict, tracking, detection, distribution } = metrics
  const esMalo = verdict.level === 'malo'

  const porcentajeSeguimiento = Math.round(tracking.fillRatio * 100)

  return (
    <div className="mt-2">
      <div
        className={`rounded-2xl p-5 border ${
          esMalo
            ? 'bg-red-500/10 border-red-500/25'
            : 'bg-amber-500/10 border-amber-500/25'
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5">{esMalo ? '⚠️' : '👀'}</span>
          <div>
            <h2 className="font-semibold text-lg">
              {esMalo
                ? t('Esta foto va a rastrear mal')
                : t('Esta foto va a funcionar, pero justo')}
            </h2>
            <p className={`text-sm mt-1 ${esMalo ? 'text-red-200/80' : 'text-amber-200/80'}`}>
              {esMalo
                ? t('El contenido va a costar que aparezca, y va a vibrar o despegarse al mover la cámara.')
                : t('Va a funcionar con buena luz y la cámara cerca. Otra foto podría mejorarlo.')}
            </p>
          </div>
        </div>
      </div>

      {/* Las tres medidas, con su número real. Mostrar la cifra y no solo un
          semáforo permite comparar dos fotos entre sí y ver si la segunda
          mejoró — con un adjetivo ("regular") esa comparación es imposible. */}
      <div className="mt-4 grid gap-2">
        <Medida
          etiqueta={t('Seguimiento')}
          ayuda={t('Que el contenido se quede pegado al mover la cámara')}
          valor={`${porcentajeSeguimiento}%`}
          nivel={verdict.breakdown.tracking}
        />
        <Medida
          etiqueta={t('Detección')}
          ayuda={t('Que la cámara reconozca el tatuaje desde varias distancias')}
          valor={t('{n} puntos', { n: detection.totalPoints })}
          nivel={verdict.breakdown.detection}
        />
        <Medida
          etiqueta={t('Reparto')}
          ayuda={t('Que los puntos no estén todos en una esquina')}
          valor={`${distribution.occupiedCells}/9`}
          nivel={verdict.breakdown.distribution}
          grid={distribution.grid}
        />
      </div>

      {verdict.reasons.length > 0 && (
        <ul className="mt-4 space-y-2">
          {verdict.reasons.map((razon, i) => (
            <li key={i} className="text-sm text-gray-400 flex gap-2">
              <span className="text-gray-600 shrink-0">·</span>
              <span>{traducirRazon(razon, metrics)}</span>
            </li>
          ))}
        </ul>
      )}

      {verdict.tips.length > 0 && (
        <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
            {t('Cómo mejorarla')}
          </p>
          <ul className="space-y-2">
            {verdict.tips.map((tip, i) => (
              <li key={i} className="text-sm text-gray-300 flex gap-2">
                <span className="text-gray-600 shrink-0">→</span>
                <span>{traducirConsejo(tip)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        El orden de los botones cambia con el nivel: el que conviene queda
        arriba y sólido, el otro debajo y discreto. Con 'malo' conviene repetir
        la foto; con 'aceptable', continuar. Ambos siguen disponibles siempre —
        la decisión es del usuario, la jerarquía es solo una recomendación.
      */}
      <div className="mt-6 grid gap-3">
        {esMalo ? (
          <>
            <BotonPrincipal onClick={onRetake}>{t('Tomar otra foto')}</BotonPrincipal>
            <BotonSecundario onClick={onContinue}>
              {t('Activar de todos modos')}
            </BotonSecundario>
          </>
        ) : (
          <>
            <BotonPrincipal onClick={onContinue}>{t('Continuar')}</BotonPrincipal>
            <BotonSecundario onClick={onRetake}>{t('Tomar otra foto')}</BotonSecundario>
          </>
        )}
      </div>
    </div>
  )
}

/*
  El worker manda cada motivo y consejo con un `code` estable y su texto en
  español. Aquí se rearma la frase en el idioma del usuario usando las cifras
  que ya vienen en las métricas.

  POR QUÉ NO TRADUCE EL WORKER: tendría que conocer el idioma de cada cliente y
  cargar el diccionario dos veces, una por lado. El código como contrato deja la
  redacción del lado que ya sabe traducir.

  POR QUÉ CAE AL TEXTO DEL WORKER: si el worker gana un motivo nuevo antes de que
  la app lo conozca, mostrar la frase en español es mejor que no decir nada — el
  usuario se entera del problema aunque el idioma no sea el suyo.
*/
function traducirRazon(razon, metrics) {
  const { tracking, detection, distribution, resolution } = metrics

  switch (razon.code) {
    case 'seguimiento-bajo':
      return t(
        'Pocos puntos de seguimiento: {n} de {max} posibles ({pct}%). El contenido va a vibrar o despegarse al mover la cámara.',
        {
          n: tracking.totalPoints,
          max: tracking.maxPossible,
          pct: Math.round(tracking.fillRatio * 100),
        }
      )
    case 'deteccion-baja':
      return t(
        'Pocos puntos de detección ({n}). Va a costar que la cámara reconozca el tatuaje.',
        { n: detection.totalPoints }
      )
    case 'zonas-pocas':
      return t(
        'Puntos concentrados en {n} de 9 zonas. El seguimiento se pierde si esa zona sale del encuadre.',
        { n: distribution.occupiedCells }
      )
    case 'zona-unica':
      return t('El {pct}% de los puntos cae en una sola zona de la imagen.', {
        pct: Math.round(distribution.maxCellShare * 100),
      })
    case 'resolucion-baja':
      return t(
        'Resolución baja: el lado menor mide {n}px y se recomiendan al menos 800px.',
        { n: resolution.minDimension }
      )
    case 'escalas-pocas':
      return t(
        'Solo {n} niveles de escala con puntos útiles. Se va a detectar únicamente a una distancia específica.',
        { n: detection.usableScaleLevels }
      )
    default:
      return razon.text
  }
}

const CONSEJOS = {
  textura: 'Los tatuajes con sombreado, textura o líneas densas se siguen mucho mejor que el trazo fino.',
  contraste: 'Mejora el contraste: luz lateral suave, sin flash directo, sin reflejos en la piel.',
  encuadre: 'Encuadra el tatuaje completo y centrado, sin partes cortadas ni piel vacía de más.',
  resolucion: 'Toma la foto más cerca o con mejor cámara — no la recortes de una imagen más grande.',
}

function traducirConsejo(consejo) {
  const es = CONSEJOS[consejo.code]
  return es ? t(es) : consejo.text
}

const COLOR_NIVEL = {
  malo: 'text-red-400',
  aceptable: 'text-amber-400',
  bueno: 'text-emerald-400',
  excelente: 'text-emerald-400',
}

function Medida({ etiqueta, ayuda, valor, nivel, grid }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
      {grid && <MiniGrid celdas={grid} />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{etiqueta}</p>
        <p className="text-xs text-gray-500 mt-0.5">{ayuda}</p>
      </div>
      <p className={`text-sm font-semibold shrink-0 ${COLOR_NIVEL[nivel] ?? 'text-gray-400'}`}>
        {valor}
      </p>
    </div>
  )
}

/**
 * Las nueve zonas de la foto, sombreadas según cuántos puntos cayeron en cada una.
 *
 * Es la única métrica que se puede enseñar en vez de explicar: el usuario ve
 * que la mitad de arriba está vacía y entiende solo que encuadró mal. Decírselo
 * con palabras ("los puntos están concentrados") no le dice DÓNDE.
 */
function MiniGrid({ celdas }) {
  const max = Math.max(...celdas, 1)
  return (
    <div className="grid grid-cols-3 gap-px w-9 h-9 shrink-0" aria-hidden="true">
      {celdas.map((n, i) => (
        <div
          key={i}
          className="bg-white rounded-[1px]"
          // Opacidad relativa al máximo: lo que importa es el contraste entre
          // zonas, no el conteo absoluto, que cambia con el tamaño de la foto
          style={{ opacity: 0.12 + (n / max) * 0.88 }}
        />
      ))}
    </div>
  )
}

function BotonPrincipal({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white text-black font-semibold py-3 rounded-full
                 hover:bg-gray-200 transition-colors active:scale-95"
    >
      {children}
    </button>
  )
}

function BotonSecundario({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-gray-400 text-sm py-2 hover:text-white transition-colors underline"
    >
      {children}
    </button>
  )
}

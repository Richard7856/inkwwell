import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import LoginGate from '../components/Auth/LoginGate.jsx'
import { isBillingAvailable, obtenerPaquetes, comprarPaquete, ErrorCompra } from '../lib/billing.js'
import { obtenerSaldo, esperarAcreditacion, haComprado } from '../lib/creditos.js'
import { canjearCodigo } from '../lib/promo.js'
import { t } from '../lib/i18n.js'

// SKU del primer crédito a mitad de precio. Solo se ofrece a quien nunca compró.
const SKU_PRIMERO = 'creditos_primero'

/**
 * Compra de créditos.
 *
 * ── Los tres estados que la mayoría de las pantallas de pago confunden ──
 * 1. La tienda cobró y los créditos ya llegaron → listo
 * 2. La tienda cobró y los créditos NO han llegado → el webhook viene en camino
 * 3. La tienda no cobró → cancelado, o falló
 *
 * El (2) es el que más daño hace si se trata como error: el usuario pagó de
 * verdad. Decirle "algo salió mal" ahí produce un reembolso sobre una compra
 * que funcionó. Por eso este componente nunca dice que falló mientras no sepa
 * que la tienda rechazó el cobro.
 *
 * ── Por qué solo en la app y no en el navegador ──
 * El plugin de RevenueCat es un puente a código Android; en el navegador no
 * existe. Y el navegador es donde vive el circuito de crecimiento: alguien abre
 * la liga de un tatuaje sin instalar nada. Esa persona no viene a comprar.
 */
export default function Creditos() {
  const { user, isLoggedIn, loading: cargandoSesion } = useAuth()

  const [saldo, setSaldo] = useState(null)
  const [paquetes, setPaquetes] = useState(null) // null = cargando, [] = nada que vender
  const [comprando, setComprando] = useState(null) // id del paquete en curso
  const [fase, setFase] = useState('listo') // listo | pagando | acreditando | tardando
  const [aviso, setAviso] = useState(null) // { tono: 'error'|'ok'|'info', texto }
  // null = sin resolver todavía. Mientras no se sepa, el SKU de entrada no se
  // muestra: ofrecerlo a quien no le toca cuesta dinero; el retraso no.
  const [primeraCompra, setPrimeraCompra] = useState(null)
  const [codigoPromo, setCodigoPromo] = useState('')
  const [canjeando, setCanjeando] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) return
    let vigente = true

    ;(async () => {
      try {
        const s = await obtenerSaldo()
        if (vigente) setSaldo(s)
      } catch (err) {
        if (vigente) setAviso({ tono: 'error', texto: err.message })
      }

      try {
        const compro = await haComprado()
        if (vigente) setPrimeraCompra(!compro)
      } catch (err) {
        console.error('[creditos] haComprado falló:', err)
      }

      try {
        const p = await obtenerPaquetes()
        if (vigente) setPaquetes(p)
      } catch (err) {
        // No se puede vender, pero el saldo ya cargó: la pantalla sigue siendo
        // útil para consultarlo
        if (vigente) {
          setPaquetes([])
          setAviso({ tono: 'error', texto: t('No se pudo cargar la lista de precios.') })
          console.error('[creditos] getOfferings falló:', err)
        }
      }
    })()

    return () => { vigente = false }
  }, [isLoggedIn, user?.id])

  const comprar = async (item) => {
    setAviso(null)
    setComprando(item.id)
    setFase('pagando')

    // Se captura ANTES de cobrar: es la referencia contra la que se detecta que
    // el webhook ya acreditó. Leerlo después no distingue lo nuevo de lo viejo.
    const saldoPrevio = saldo ?? 0

    try {
      await comprarPaquete(item.paquete)
    } catch (err) {
      setComprando(null)
      setFase('listo')

      if (err instanceof ErrorCompra && !err.esFallo) return // canceló: sin ruido

      setAviso({
        tono: err.tipo === 'pendiente' ? 'info' : 'error',
        texto: mensajeDeError(err),
      })
      return
    }

    // La tienda cobró. A partir de aquí NADA puede decirle al usuario que falló.
    setFase('acreditando')

    const { acreditado, saldo: nuevo } = await esperarAcreditacion(saldoPrevio)
    setSaldo(nuevo)
    setComprando(null)

    // Compró: el precio de entrada deja de aplicar aunque el webhook tarde
    setPrimeraCompra(false)

    if (acreditado) {
      setFase('listo')
      setAviso({ tono: 'ok', texto: t('Listo, tus créditos ya están disponibles.') })
    } else {
      setFase('tardando')
      setAviso({
        tono: 'info',
        texto: t('Tu pago se registró. Los créditos pueden tardar un momento en aparecer.'),
      })
    }
  }

  const canjear = async (e) => {
    e.preventDefault()
    if (!codigoPromo.trim()) return
    setAviso(null)
    setCanjeando(true)
    try {
      const n = await canjearCodigo(codigoPromo)
      setSaldo(await obtenerSaldo())
      setCodigoPromo('')
      setAviso({
        tono: 'ok',
        texto: n === 1
          ? t('Canjeado: 1 crédito agregado.')
          : t('Canjeado: {n} créditos agregados.', { n }),
      })
    } catch (err) {
      setAviso({ tono: 'error', texto: err.message })
    } finally {
      setCanjeando(false)
    }
  }

  const revisarSaldo = async () => {
    try {
      setSaldo(await obtenerSaldo())
      setFase('listo')
    } catch (err) {
      setAviso({ tono: 'error', texto: err.message })
    }
  }

  if (cargandoSesion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen px-6 py-8 pb-safe">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/app" className="text-gray-500 hover:text-white transition-colors">
          <BackArrow />
        </Link>
        <h1 className="text-2xl font-bold">{t('Créditos')}</h1>
      </div>

      {!isLoggedIn ? (
        <LoginGate />
      ) : (
        <>
          <Saldo valor={saldo} />

          {aviso && <Aviso {...aviso} />}

          {fase === 'tardando' && (
            <button
              onClick={revisarSaldo}
              className="w-full mt-3 bg-white/10 border border-white/20 rounded-xl py-3
                         text-sm hover:bg-white/15 transition-colors"
            >
              {t('Volver a revisar')}
            </button>
          )}

          <form onSubmit={canjear} className="mt-8">
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2">
              {t('¿Tienes un código?')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={codigoPromo}
                onChange={(e) => setCodigoPromo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))}
                placeholder={t('Código promocional')}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="flex-1 min-w-0 py-3 px-4 rounded-xl bg-white/5 border border-white/10
                           font-mono tracking-widest text-white placeholder-gray-600
                           focus:outline-none focus:border-white/40"
              />
              <button
                type="submit"
                disabled={canjeando || !codigoPromo}
                className="px-4 rounded-xl bg-white/10 border border-white/20 text-sm
                           hover:bg-white/15 disabled:opacity-40 transition-colors"
              >
                {canjeando ? t('Canjeando...') : t('Canjear')}
              </button>
            </div>
          </form>

          <div className="mt-8">
            {!isBillingAvailable() ? (
              <SinCobro />
            ) : paquetes === null ? (
              <Cargando />
            ) : paquetes.length === 0 ? (
              <SinPaquetes />
            ) : (
              <div className="grid gap-3">
                <p className="text-gray-400 text-sm mb-1">
                  {t('Cada crédito genera un video para tu tatuaje.')}
                </p>
                {paquetes
                  // El precio de entrada solo existe para la primera compra.
                  // Mientras no se sepa (null), no se muestra.
                  .filter((p) => p.productoId !== SKU_PRIMERO || primeraCompra === true)
                  .map((p) => (
                    <BotonPaquete
                      key={p.id}
                      item={p}
                      destacado={p.productoId === SKU_PRIMERO}
                      ocupado={comprando !== null}
                      fase={comprando === p.id ? fase : null}
                      onClick={() => comprar(p)}
                    />
                  ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** Traduce el tipo de error a algo que el usuario pueda accionar */
function mensajeDeError(err) {
  switch (err.tipo) {
    case 'pendiente':
      // Métodos de pago diferidos (efectivo en tienda, algunas tarjetas):
      // Google aprueba después. Tratarlo como fallo sería mentir.
      return t('Tu pago quedó pendiente de aprobación. Los créditos llegarán en cuanto se confirme.')
    case 'no-disponible':
      return t('Las compras no están disponibles en este dispositivo o cuenta.')
    case 'tienda':
      return t('Google Play tuvo un problema al procesar el pago. Inténtalo de nuevo.')
    case 'red':
      return t('Sin conexión. Revisa tu internet e inténtalo de nuevo.')
    default:
      return err.message
  }
}

function Saldo({ valor }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-baseline gap-3">
      <span className="text-4xl font-bold tabular-nums">
        {valor === null ? '—' : valor}
      </span>
      <span className="text-gray-400">
        {valor === 1 ? t('crédito disponible') : t('créditos disponibles')}
      </span>
    </div>
  )
}

/*
  El paquete destacado es el primer crédito a mitad de precio. Se marca como
  excepción y no como precio: si el usuario cree que $12.50 es lo normal, el
  $25 de la siguiente compra se siente como un aumento. Por eso el rótulo dice
  "primera vez" y la lista de al lado muestra el precio real.
*/
function BotonPaquete({ item, destacado = false, ocupado, fase, onClick }) {
  const activo = fase !== null

  return (
    <button
      onClick={onClick}
      disabled={ocupado}
      className={`rounded-2xl p-5 border text-left transition-all
                  active:scale-95 disabled:opacity-50 disabled:active:scale-100
                  flex items-center justify-between gap-4
                  ${destacado
                    ? 'bg-white/10 border-white/40 hover:bg-white/15'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'}`}
    >
      <div className="min-w-0">
        {destacado && (
          <p className="text-[10px] uppercase tracking-wider text-gray-300 mb-1">
            {t('Solo tu primera vez')}
          </p>
        )}
        <h3 className="font-semibold">{item.titulo}</h3>
        {activo && (
          <p className="text-xs text-gray-400 mt-1">
            {fase === 'pagando' ? t('Abriendo Google Play...') : t('Acreditando...')}
          </p>
        )}
      </div>
      <span className="font-mono font-semibold shrink-0">{item.precio}</span>
    </button>
  )
}

function Cargando() {
  return (
    <div className="text-center py-8">
      <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full
                      animate-spin mx-auto mb-3" />
      <p className="text-gray-500 text-sm">{t('Cargando precios...')}</p>
    </div>
  )
}

/*
  Distinguir esto de un error importa: casi siempre significa que los productos
  existen en Play y en RevenueCat pero nadie los metió en una Offering. El SDK
  no lo reporta como falla — devuelve una lista vacía.
*/
function SinPaquetes() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
      <p className="text-gray-300 font-medium">{t('Todavía no hay paquetes a la venta')}</p>
      <p className="text-gray-500 text-sm mt-1">{t('Vuelve en un rato.')}</p>
    </div>
  )
}

/** En el navegador no hay cobro, y quien abre una liga compartida no viene a comprar */
function SinCobro() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
      <p className="text-gray-300 font-medium">{t('Las compras se hacen desde la app')}</p>
      <p className="text-gray-500 text-sm mt-1">
        {t('Descarga InkAR en tu teléfono para comprar créditos.')}
      </p>
    </div>
  )
}

const TONOS = {
  error: 'bg-red-500/10 border-red-500/20 text-red-300',
  ok: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  info: 'bg-amber-500/10 border-amber-500/20 text-amber-200',
}

function Aviso({ tono, texto }) {
  return (
    <div className={`mt-4 border rounded-xl p-4 text-sm ${TONOS[tono] ?? TONOS.info}`}>
      {texto}
    </div>
  )
}

function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

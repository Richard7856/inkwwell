import { useState } from 'react'
import { sendLoginCode, verifyLoginCode } from '../../lib/auth.js'

/**
 * Pide identificarse antes de activar un tatuaje.
 *
 * ── Por qué aquí y no al abrir la app ──
 * Solo se pide sesión a quien ACTIVA. Quien escanea el tatuaje de otra persona
 * no ve esta pantalla nunca: si viera un muro de login, no escanearía, y sin
 * escaneos el producto pierde lo que lo hace viral.
 *
 * ── Por qué código y no enlace ──
 * Un enlace saca al usuario al correo y lo obliga a volver, cosa que dentro del
 * APK requiere configuración nativa de deep links. El código se teclea sin salir.
 *
 * @param {() => void} [onSuccess] - Se llama al abrir sesión correctamente
 * @param {string} [titulo] - Encabezado del primer paso. Se parametriza porque
 *   el borrado de cuenta reusa este mismo formulario y allí "Identifícate para
 *   activar" sería desconcertante.
 * @param {string} [descripcion] - Texto bajo el encabezado del primer paso
 */
export default function LoginGate({
  onSuccess,
  titulo = 'Identifícate para activar',
  descripcion = 'Tu cuenta guarda tus tatuajes y tu link, para que no los pierdas si cambias de celular.',
}) {
  const [paso, setPaso] = useState('email')   // email | codigo
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const pedirCodigo = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await sendLoginCode(email)
      setPaso('codigo')
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const confirmarCodigo = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await verifyLoginCode(email, codigo)
      onSuccess?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-8">
      <h2 className="text-xl font-semibold mb-2 text-center">
        {paso === 'email' ? titulo : 'Revisa tu correo'}
      </h2>
      <p className="text-gray-400 text-sm text-center mb-8">
        {paso === 'email' ? descripcion : `Enviamos un código de 6 dígitos a ${email}`}
      </p>

      {paso === 'email' ? (
        <form onSubmit={pedirCodigo} className="flex flex-col gap-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            className="w-full py-4 px-4 rounded-2xl bg-white/10 border border-white/10
                       text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
          />
          <button
            type="submit"
            disabled={enviando || !email}
            className="w-full py-4 rounded-2xl bg-white text-black font-semibold
                       disabled:opacity-40 transition-opacity"
          >
            {enviando ? 'Enviando...' : 'Enviar código'}
          </button>
        </form>
      ) : (
        <form onSubmit={confirmarCodigo} className="flex flex-col gap-3">
          <input
            type="text"
            // inputMode numérico levanta el teclado de números en el celular,
            // que es mucho más rápido para teclear 6 dígitos
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full py-4 px-4 rounded-2xl bg-white/10 border border-white/10
                       text-white text-center text-2xl tracking-[0.5em] font-mono
                       placeholder-gray-600 focus:outline-none focus:border-white/40"
          />
          <button
            type="submit"
            disabled={enviando || codigo.length < 6}
            className="w-full py-4 rounded-2xl bg-white text-black font-semibold
                       disabled:opacity-40 transition-opacity"
          >
            {enviando ? 'Verificando...' : 'Entrar'}
          </button>
          <button
            type="button"
            onClick={() => { setPaso('email'); setCodigo(''); setError('') }}
            className="text-gray-500 text-sm underline mt-2"
          >
            Usar otro correo
          </button>
        </form>
      )}

      {error && (
        <p className="text-red-400 text-sm mt-4 text-center">{error}</p>
      )}
    </div>
  )
}

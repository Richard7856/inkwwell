import { useState } from 'react'
import {
  sendLoginCode, verifyLoginCode,
  signInWithPassword, signUpWithPassword, MIN_PASSWORD,
} from '../../lib/auth.js'

/**
 * Pide identificarse antes de activar un tatuaje.
 *
 * ── Por qué aquí y no al abrir la app ──
 * Solo se pide sesión a quien ACTIVA. Quien escanea el tatuaje de otra persona
 * no ve esta pantalla nunca: si viera un muro de login, no escanearía, y sin
 * escaneos el producto pierde lo que lo hace viral.
 *
 * ── Dos vías, y por qué ──
 * El CÓDIGO por correo es la vía por defecto: nada que inventar ni recordar, y
 * funciona igual en web y dentro del APK sin configurar deep links.
 * La CONTRASEÑA existe porque el código depende de que un correo llegue, y el
 * servicio integrado de Supabase está topado a unos pocos envíos por hora. Sin
 * ella no habría credenciales fijas que entregarle al revisor de Google Play
 * —que rechaza la app si no logra entrar— ni a los jueces del concurso.
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
  const [metodo, setMetodo] = useState('codigo')   // codigo | password
  const [paso, setPaso] = useState('email')        // email | codigo (solo vía código)
  const [esRegistro, setEsRegistro] = useState(false)
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  /* Envuelve cada envío para no repetir el mismo manejo de error y estado en
     los cuatro caminos posibles. */
  const ejecutar = (accion) => async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await accion()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const pedirCodigo = ejecutar(async () => {
    await sendLoginCode(email)
    setPaso('codigo')
  })

  const confirmarCodigo = ejecutar(async () => {
    await verifyLoginCode(email, codigo)
    onSuccess?.()
  })

  const entrarConPassword = ejecutar(async () => {
    if (esRegistro) await signUpWithPassword(email, password)
    else await signInWithPassword(email, password)
    onSuccess?.()
  })

  const cambiarMetodo = () => {
    setMetodo(metodo === 'codigo' ? 'password' : 'codigo')
    setPaso('email'); setCodigo(''); setPassword(''); setError('')
  }

  const encabezado = paso === 'codigo'
    ? { t: 'Revisa tu correo', d: `Enviamos un código de 6 dígitos a ${email}` }
    : { t: titulo, d: descripcion }

  return (
    <div className="max-w-sm mx-auto mt-8">
      <h2 className="text-xl font-semibold mb-2 text-center">{encabezado.t}</h2>
      <p className="text-gray-400 text-sm text-center mb-8">{encabezado.d}</p>

      {metodo === 'password' ? (
        <form onSubmit={entrarConPassword} className="flex flex-col gap-3">
          <CampoCorreo value={email} onChange={setEmail} />
          <input
            type="password"
            // 'new-password' cuando se registra hace que el gestor de
            // contraseñas ofrezca generar una, en vez de rellenar una vieja
            autoComplete={esRegistro ? 'new-password' : 'current-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={esRegistro ? `Al menos ${MIN_PASSWORD} caracteres` : 'Tu contraseña'}
            className="w-full py-4 px-4 rounded-2xl bg-white/10 border border-white/10
                       text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
          />
          <Boton disabled={enviando || !email || !password}>
            {enviando
              ? (esRegistro ? 'Creando...' : 'Entrando...')
              : (esRegistro ? 'Crear cuenta' : 'Entrar')}
          </Boton>
          <button
            type="button"
            onClick={() => { setEsRegistro(!esRegistro); setError('') }}
            className="text-gray-400 text-sm underline mt-1"
          >
            {esRegistro ? 'Ya tengo cuenta' : 'Crear una cuenta nueva'}
          </button>
        </form>
      ) : paso === 'email' ? (
        <form onSubmit={pedirCodigo} className="flex flex-col gap-3">
          <CampoCorreo value={email} onChange={setEmail} />
          <Boton disabled={enviando || !email}>
            {enviando ? 'Enviando...' : 'Enviar código'}
          </Boton>
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
          <Boton disabled={enviando || codigo.length < 6}>
            {enviando ? 'Verificando...' : 'Entrar'}
          </Boton>
          <button
            type="button"
            onClick={() => { setPaso('email'); setCodigo(''); setError('') }}
            className="text-gray-500 text-sm underline mt-2"
          >
            Usar otro correo
          </button>
        </form>
      )}

      {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}

      {paso === 'email' && (
        <button
          type="button"
          onClick={cambiarMetodo}
          className="w-full text-gray-500 text-sm underline mt-6"
        >
          {metodo === 'codigo' ? 'Prefiero usar contraseña' : 'Prefiero recibir un código'}
        </button>
      )}
    </div>
  )
}

function CampoCorreo({ value, onChange }) {
  return (
    <input
      type="email"
      inputMode="email"
      autoComplete="email"
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="tu@correo.com"
      className="w-full py-4 px-4 rounded-2xl bg-white/10 border border-white/10
                 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
    />
  )
}

function Boton({ disabled, children }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full py-4 rounded-2xl bg-white text-black font-semibold
                 disabled:opacity-40 transition-opacity"
    >
      {children}
    </button>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import LoginGate from '../components/Auth/LoginGate.jsx'
import { eliminarMiCuenta } from '../lib/account.js'
import { t } from '../lib/i18n.js'

/**
 * Borrado de cuenta. Google Play exige DOS caminos y esta pantalla es los dos:
 *
 *  1. Dentro de la app, para quien ya tiene sesión.
 *  2. Una dirección web pública donde cualquiera pueda pedirlo SIN instalar la
 *     app — la que se registra en Play Console. Por eso vive en una ruta propia
 *     y no escondida dentro del perfil: quien ya desinstaló la app debe poder
 *     llegar aquí desde el navegador.
 *
 * Quien no tiene sesión se identifica con el mismo código de 6 dígitos del
 * login: probar que el correo es suyo es justamente lo que impide que alguien
 * borre la cuenta de otro.
 */

/* Escribir una palabra completa evita el borrado por toque accidental — es
   irreversible y no hay papelera de la que rescatarlo.

   Se traduce: pedirle a alguien que teclee "BORRAR" en una pantalla en inglés
   convierte una confirmación en un acertijo. */
const palabraConfirmacion = () => t('BORRAR')

export default function EliminarCuenta() {
  const { user, loading, isLoggedIn } = useAuth()
  const PALABRA = palabraConfirmacion()
  const [confirmacion, setConfirmacion] = useState('')
  const [estado, setEstado] = useState('inicial')   // inicial | borrando | listo
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')

  const borrar = async () => {
    setError('')
    setEstado('borrando')
    try {
      setResultado(await eliminarMiCuenta())
      setEstado('listo')
    } catch (err) {
      setError(err.message)
      setEstado('inicial')
    }
  }

  if (loading) {
    return <Marco><p className="text-gray-500 text-center">{t('Cargando...')}</p></Marco>
  }

  if (estado === 'listo') {
    return (
      <Marco>
        <h1 className="text-2xl font-bold mb-4">{t('Listo')}</h1>
        <p className="text-gray-300 leading-relaxed mb-2">{resultado.mensaje}</p>
        <p className="text-gray-500 text-sm mb-8">
          {t('Se eliminaron {tatuajes} tatuaje(s) y {archivos} archivo(s). Los links que hayas compartido dejaron de funcionar.',
             { tatuajes: resultado.tatuajes, archivos: resultado.archivos })}
        </p>
        <Link to="/" className="inline-block bg-white text-black font-semibold py-3 px-6 rounded-full">
          {t('Volver al inicio')}
        </Link>
      </Marco>
    )
  }

  if (!isLoggedIn) {
    return (
      <Marco>
        <h1 className="text-2xl font-bold mb-3">{t('Eliminar mi cuenta')}</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          {t('Para borrar tu cuenta necesitamos confirmar que el correo es tuyo. Te enviaremos un código de 6 dígitos.')}
        </p>
        <LoginGate
          titulo={t('Confirma tu correo')}
          descripcion={t('Escribe el correo de la cuenta que quieres eliminar.')}
        />
        <QueSeBorra />
      </Marco>
    )
  }

  return (
    <Marco>
      <h1 className="text-2xl font-bold mb-3">{t('Eliminar mi cuenta')}</h1>
      <p className="text-gray-400 text-sm mb-6">
        {t('Sesión activa como')} <span className="text-gray-200">{user?.email}</span>
      </p>

      <QueSeBorra />

      <p className="text-gray-400 text-sm mt-8 mb-3">
        <Frase
          texto={t('Esto no se puede deshacer. Escribe {palabra} para confirmar.',
                   { palabra: '\u0000' })}
          resaltado={PALABRA}
        />
      </p>
      <input
        type="text"
        value={confirmacion}
        onChange={(e) => setConfirmacion(e.target.value.toUpperCase())}
        placeholder={PALABRA}
        className="w-full py-4 px-4 rounded-2xl bg-white/10 border border-white/10
                   text-white text-center tracking-[0.3em] font-mono
                   placeholder-gray-600 focus:outline-none focus:border-red-500/60"
      />
      <button
        onClick={borrar}
        disabled={confirmacion !== PALABRA || estado === 'borrando'}
        className="w-full mt-3 py-4 rounded-2xl bg-red-600 text-white font-semibold
                   disabled:opacity-30 transition-opacity"
      >
        {estado === 'borrando' ? t('Borrando...') : t('Eliminar mi cuenta para siempre')}
      </button>

      {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

      <Link to="/" className="block text-center text-gray-500 text-sm mt-8 underline">
        {t('Mejor no, volver al inicio')}
      </Link>
    </Marco>
  )
}

/**
 * Muestra una frase traducida con una palabra resaltada en medio.
 *
 * Se parte por un marcador en vez de traducir tres fragmentos sueltos porque el
 * orden de las palabras cambia entre idiomas: en inglés la palabra a teclear va
 * después del verbo, y traducir por pedazos produciría frases mal armadas.
 */
function Frase({ texto, resaltado }) {
  const [antes, despues] = texto.split('\u0000')
  return (
    <>
      {antes}<b className="text-white">{resaltado}</b>{despues}
    </>
  )
}

function QueSeBorra() {
  return (
    <div className="bg-white/5 rounded-2xl p-5 border border-white/10 mt-6">
      <p className="text-gray-300 text-sm font-medium mb-2">{t('Qué se elimina')}</p>
      <ul className="text-gray-400 text-sm leading-relaxed list-disc pl-5 space-y-1">
        <li>{t('Las fotos de tus tatuajes')}</li>
        <li>{t('Los descriptores visuales generados a partir de ellas')}</li>
        <li>{t('Tu perfil y tu link compartible, que dejará de abrir')}</li>
        <li>{t('Tu correo y tu cuenta de acceso')}</li>
      </ul>
      <p className="text-gray-500 text-xs mt-3 leading-relaxed">
        {t('El borrado es inmediato y definitivo: no hay copia de respaldo de la que podamos recuperarlo después.')}
      </p>
    </div>
  )
}

function Marco({ children }) {
  return (
    <div className="min-h-screen px-6 py-10 overflow-y-auto">
      <div className="max-w-sm mx-auto">{children}</div>
    </div>
  )
}

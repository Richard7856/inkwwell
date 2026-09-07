import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getIdioma, setIdioma, t } from '../lib/i18n.js'
import { inscribirEnLista } from '../lib/waitlist.js'

/**
 * Landing pública de inkar.app.
 *
 * ── Por qué la landing y la app comparten la ruta "/" ──
 * Dentro del APK, Capacitor arranca en "/". Si esa ruta fuera la landing, quien
 * ya instaló la app abriría cada vez una página de marketing pidiéndole el
 * correo que ya dio. Y si la landing viviera en otra ruta, quien llega desde una
 * búsqueda o un cartel de estudio caería en la app sin contexto.
 * Por eso App.jsx decide: en navegador, landing; dentro de la app, el inicio.
 *
 * ── Objetivo único ──
 * Recoger correos mientras la app pasa revisión. Todo lo demás en esta página
 * está subordinado a eso: hay un solo formulario y aparece antes de tener que
 * desplazarse.
 */

const ES = {
  promesa: 'Tu tatuaje cobra vida en realidad aumentada',
  sub: 'No es un filtro ni una prueba de tatuajes. Tu tatuaje real queda vinculado a una experiencia en 3D que cualquiera puede ver apuntando su cámara.',
  cta: 'Quiero avisarme cuando salga',
  yaTengo: '¿Ya tienes la app? Activa tu tatuaje',
  soy: '¿Quién eres?',
  persona: 'Tengo tatuajes',
  artista: 'Soy tatuador o tengo estudio',
  ciudad: 'Ciudad (opcional)',
  enviando: 'Guardando...',
  gracias: 'Listo, quedas dentro',
  graciasDetalle: 'Te escribimos a {email} en cuanto abramos. No mandamos nada más.',
  yaEstabas: 'Ese correo ya estaba en la lista. No hace falta hacer nada más.',
  comoTitulo: 'Cómo funciona',
  pasos: [
    ['Registras tu tatuaje', 'Una foto, una vez. En segundos queda activado.'],
    ['Eliges qué aparece', 'Un modelo 3D animado de nuestro catálogo, o el tuyo hecho a la medida.'],
    ['Cualquiera lo ve', 'Apunta su cámara a tu piel y aparece. Sin instalar nada, desde el navegador.'],
  ],
  artistasTitulo: 'Para estudios de tatuaje',
  artistasTexto: 'Tus clientes ya pagan por un tatuaje. Ofrecerles que además cobre vida no te cuesta trabajo extra y te distingue de cualquier estudio de tu ciudad. Estamos armando el programa con un grupo pequeño de estudios: apúntate y hablamos contigo directo.',
  legalNota: 'Solo usamos tu correo para avisarte del lanzamiento.',
}

const EN = {
  promesa: 'Your tattoo comes alive in augmented reality',
  sub: 'Not a filter, not a tattoo try-on. Your real tattoo gets linked to a 3D experience anyone can see by pointing their camera at it.',
  cta: 'Tell me when it launches',
  yaTengo: 'Already have the app? Activate your tattoo',
  soy: 'Who are you?',
  persona: 'I have tattoos',
  artista: 'I’m a tattoo artist or run a studio',
  ciudad: 'City (optional)',
  enviando: 'Saving...',
  gracias: 'You’re in',
  graciasDetalle: 'We’ll write to {email} the moment we open. Nothing else.',
  yaEstabas: 'That email was already on the list. Nothing else to do.',
  comoTitulo: 'How it works',
  pasos: [
    ['Register your tattoo', 'One photo, once. Activated in seconds.'],
    ['Choose what appears', 'An animated 3D model from our catalog, or your own made to order.'],
    ['Anyone can see it', 'They point a camera at your skin and it appears. No install, straight from the browser.'],
  ],
  artistasTitulo: 'For tattoo studios',
  artistasTexto: 'Your clients already pay for a tattoo. Offering them one that also comes alive costs you no extra work and sets you apart from every studio in your city. We’re building the program with a small group of studios: sign up and we’ll talk directly.',
  legalNota: 'We only use your email to tell you about the launch.',
}

export default function Landing() {
  const idioma = getIdioma()
  const c = idioma === 'es' ? ES : EN

  const [email, setEmail] = useState('')
  const [perfil, setPerfil] = useState('persona')
  const [ciudad, setCiudad] = useState('')
  const [estado, setEstado] = useState('inicial')   // inicial | enviando | listo
  const [yaEstaba, setYaEstaba] = useState(false)
  const [error, setError] = useState('')

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setEstado('enviando')
    try {
      const { yaEstaba: repetido } = await inscribirEnLista({ email, perfil, ciudad })
      setYaEstaba(repetido)
      setEstado('listo')
    } catch (err) {
      setError(err.message)
      setEstado('inicial')
    }
  }

  return (
    <div className="min-h-screen overflow-y-auto">
      <div className="max-w-lg mx-auto px-6 py-14">

        {/* ── Marca y promesa ── */}
        <Marca />
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mt-6 leading-tight">
          {c.promesa}
        </h1>
        <p className="text-gray-400 text-center mt-4 leading-relaxed">{c.sub}</p>

        {/* ── Formulario: antes de tener que desplazarse ── */}
        <div className="mt-10">
          {estado === 'listo' ? (
            <div className="bg-violet-600/10 border border-violet-500/30 rounded-2xl p-6 text-center">
              <p className="text-xl font-semibold mb-2">{c.gracias}</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                {yaEstaba
                  ? c.yaEstabas
                  : c.graciasDetalle.replace('{email}', email.trim().toLowerCase())}
              </p>
            </div>
          ) : (
            <form onSubmit={enviar} className="flex flex-col gap-3">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('tu@correo.com')}
                className="w-full py-4 px-4 rounded-2xl bg-white/10 border border-white/10
                           text-white placeholder-gray-500 focus:outline-none focus:border-violet-400"
              />

              <p className="text-gray-500 text-xs mt-1">{c.soy}</p>
              <div className="grid grid-cols-1 gap-2">
                <Opcion activo={perfil === 'persona'} onClick={() => setPerfil('persona')}>
                  {c.persona}
                </Opcion>
                <Opcion activo={perfil === 'artista'} onClick={() => setPerfil('artista')}>
                  {c.artista}
                </Opcion>
              </div>

              {/* La ciudad solo se pide a estudios: para una persona es fricción
                  sin propósito, pero decide en qué plaza arrancar el canal. */}
              {perfil === 'artista' && (
                <input
                  type="text"
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  placeholder={c.ciudad}
                  className="w-full py-4 px-4 rounded-2xl bg-white/10 border border-white/10
                             text-white placeholder-gray-500 focus:outline-none focus:border-violet-400"
                />
              )}

              <button
                type="submit"
                disabled={estado === 'enviando' || !email}
                className="w-full py-4 rounded-2xl bg-violet-600 text-white font-semibold
                           disabled:opacity-40 transition-opacity hover:bg-violet-500"
              >
                {estado === 'enviando' ? c.enviando : c.cta}
              </button>
              <p className="text-gray-600 text-xs text-center">{c.legalNota}</p>
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            </form>
          )}
        </div>

        {/* ── Cómo funciona ── */}
        <section className="mt-16">
          <h2 className="text-lg font-semibold mb-5">{c.comoTitulo}</h2>
          <ol className="flex flex-col gap-5">
            {c.pasos.map(([titulo, detalle], i) => (
              <li key={titulo} className="flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-white/10 border border-white/10
                                 flex items-center justify-center text-sm font-semibold">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{titulo}</p>
                  <p className="text-gray-400 text-sm mt-0.5 leading-relaxed">{detalle}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Estudios: el canal de distribución ── */}
        <section className="mt-14 bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-3">{c.artistasTitulo}</h2>
          <p className="text-gray-400 text-sm leading-relaxed">{c.artistasTexto}</p>
        </section>

        {/* ── Pie ── */}
        <div className="mt-14 pt-6 border-t border-white/10 flex flex-col items-center gap-3">
          <Link to="/activate" className="text-gray-400 text-sm underline hover:text-white transition-colors">
            {c.yaTengo}
          </Link>
          <div className="flex gap-4 text-[11px] text-gray-600">
            <Link to="/privacidad" className="underline hover:text-gray-400 transition-colors">
              {t('Privacidad')}
            </Link>
            <button
              type="button"
              onClick={() => setIdioma(idioma === 'es' ? 'en' : 'es')}
              className="underline hover:text-gray-400 transition-colors"
            >
              {idioma === 'es' ? 'English' : 'Español'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Opcion({ activo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full py-3 px-4 rounded-xl border text-left text-sm transition-colors ${
        activo
          ? 'bg-violet-600/20 border-violet-500/60 text-white'
          : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
      }`}
    >
      {children}
    </button>
  )
}

/** La marca del icono, en grande. Misma geometría que brand/icono.svg. */
function Marca() {
  return (
    <svg viewBox="0 0 108 108" className="w-20 h-20 mx-auto" aria-label="InkAR">
      <rect width="108" height="108" rx="26" fill="#6D28D9" />
      <path d="M54 33 C54 33 69 51 69 61 A15 15 0 1 1 39 61 C39 51 54 33 54 33 Z" fill="#fff" />
      <g fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="square">
        <path d="M32 44 V32 H44" /><path d="M76 64 V76 H64" />
      </g>
    </svg>
  )
}

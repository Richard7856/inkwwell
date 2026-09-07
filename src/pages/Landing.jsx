import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getIdioma, setIdioma, t } from '../lib/i18n.js'
import { inscribirEnLista } from '../lib/waitlist.js'
import { useTema } from '../lib/tema.js'

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
  descriptor: 'Historias que siguen vivas',
  promesa: 'Tus tatuajes también tienen historias que contar',
  ritmo: 'Escanea. Descubre. Revive.',
  sub: 'No es un filtro ni una prueba de tatuajes. Tu tatuaje real queda vinculado a una experiencia en 3D que cualquiera puede ver apuntando su cámara. Más que tinta: otra realidad.',
  cta: 'Quiero avisarme cuando salga',
  demoTitulo: 'Pruébalo ahora, sin tatuaje',
  demoTexto: 'No hace falta que tengas un tatuaje activado ni que instales nada. Te damos una imagen, le apuntas la cámara y ves exactamente lo que verá cualquiera que apunte al tuyo.',
  demoCta: 'Probar el demo →',
  distintoTitulo: 'Por qué no es un filtro',
  distinto: [
    ['El activador es tu piel, no tu cara', 'Los filtros siguen tu cara y desaparecen cuando cambias de app. Aquí el activador es el tatuaje: vive contigo, y funciona aunque quien mire sea otra persona con otro teléfono.'],
    ['Cualquiera lo ve, sin instalar nada', 'Quien apunte su cámara a tu tatuaje abre una liga y ve tu contenido. Sin cuenta, sin descargar, sin pedirte permiso.'],
    ['Es tuyo y es permanente', 'Registras el tatuaje una vez y queda activado. Puedes cambiar después qué aparece encima, sin volver a registrarlo.'],
  ],
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
  descriptor: 'Stories that stay alive',
  promesa: 'Your tattoos have stories to tell, too',
  ritmo: 'Scan. Discover. Relive.',
  sub: 'Not a filter, not a tattoo try-on. Your real tattoo gets linked to a 3D experience anyone can see by pointing their camera at it. More than ink: another reality.',
  cta: 'Tell me when it launches',
  demoTitulo: 'Try it now, no tattoo needed',
  demoTexto: 'You don’t need an activated tattoo or an install. We give you an image, you point your camera at it, and you see exactly what anyone pointing at yours would see.',
  demoCta: 'Try the demo →',
  distintoTitulo: 'Why this isn’t a filter',
  distinto: [
    ['The trigger is your skin, not your face', 'Filters track your face and vanish when you switch apps. Here the trigger is the tattoo: it lives with you, and it works even when the person looking is someone else on another phone.'],
    ['Anyone can see it, with nothing installed', 'Whoever points a camera at your tattoo opens a link and sees your content. No account, no download, no asking you for anything.'],
    ['It’s yours and it’s permanent', 'You register the tattoo once and it stays activated. You can change what appears on top later, without registering it again.'],
  ],
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
  useTema('claro')
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
    <div className="min-h-screen overflow-y-auto relative">
      {/*
        Textura de tinta al fondo. Es la propia K a gran escala y sangrada por
        el borde: usar el asset real de la marca en vez de un pincel inventado
        mantiene la coherencia del trazo, y los trazos sueltos del tablero no
        llegaron. `select-none` y `aria-hidden` porque es decoración pura.
      */}
      <img
        src="/marca-k.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute -top-24 -right-40 w-[520px]
                   opacity-[0.06] rotate-12 invert"
      />
      <div className="max-w-lg mx-auto px-6 py-14 relative">

        {/* ── Marca y promesa ── */}
        <Marca descriptor={c.descriptor} />
        <h1 className="text-3xl sm:text-4xl font-semibold text-center mt-10 leading-tight">
          {c.promesa}
        </h1>
        {/* El ritmo de tres palabras es el eje de la voz de marca; se le da aire
            propio en vez de esconderlo dentro de un párrafo. */}
        <p className="marca text-realidad text-center text-sm mt-5">{c.ritmo}</p>
        <p className="text-neutral-600 text-center mt-5 leading-relaxed">{c.sub}</p>

        {/*
          El demo va ANTES del formulario.

          Quien no conoce el producto no entrega su correo por una descripción;
          lo entrega después de ver que funciona. Pedirlo primero convierte la
          página en un peaje.
        */}
        <Link
          to="/demo"
          className="block mt-8 bg-white border border-black/10 rounded-2xl p-5 shadow-sm
                     hover:border-tinta transition-colors"
        >
          <p className="font-semibold">{c.demoTitulo}</p>
          <p className="text-neutral-600 text-sm mt-1 leading-relaxed">{c.demoTexto}</p>
          <p className="text-realidad text-sm font-medium mt-3">{c.demoCta}</p>
        </Link>

        {/* ── Formulario ── */}
        <div className="mt-10">
          {estado === 'listo' ? (
            <div className="bg-realidad/[0.07] border border-realidad/40 rounded-2xl p-6 text-center">
              <p className="text-xl font-semibold mb-2">{c.gracias}</p>
              <p className="text-neutral-600 text-sm leading-relaxed">
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
                className="w-full py-4 px-4 rounded-2xl bg-white border border-black/15
                           text-black placeholder-neutral-400 focus:outline-none focus:border-realidad"
              />

              <p className="text-neutral-500 text-xs mt-1">{c.soy}</p>
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
                  className="w-full py-4 px-4 rounded-2xl bg-white border border-black/15
                             text-black placeholder-neutral-400 focus:outline-none focus:border-realidad"
                />
              )}

              <button
                type="submit"
                disabled={estado === 'enviando' || !email}
                className="w-full py-4 rounded-2xl bg-tinta text-white font-semibold
                           disabled:opacity-30 transition-opacity hover:opacity-85"
              >
                {estado === 'enviando' ? c.enviando : c.cta}
              </button>
              <p className="text-neutral-500 text-xs text-center">{c.legalNota}</p>
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
                <span className="shrink-0 w-8 h-8 rounded-full bg-tinta text-white
                                 flex items-center justify-center text-sm font-semibold">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{titulo}</p>
                  <p className="text-neutral-600 text-sm mt-0.5 leading-relaxed">{detalle}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Qué lo hace distinto: el malentendido más común es "es un filtro" ── */}
        <section className="mt-14">
          <h2 className="text-lg font-semibold mb-5">{c.distintoTitulo}</h2>
          <div className="flex flex-col gap-5">
            {c.distinto.map(([titulo, detalle]) => (
              <div key={titulo}>
                <p className="font-medium">{titulo}</p>
                <p className="text-neutral-600 text-sm mt-1 leading-relaxed">{detalle}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Estudios: el canal de distribución ── */}
        <section className="mt-14 bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">{c.artistasTitulo}</h2>
          <p className="text-neutral-600 text-sm leading-relaxed">{c.artistasTexto}</p>
        </section>

        {/* ── Pie ── */}
        <div className="mt-14 pt-6 border-t border-black/10 flex flex-col items-center gap-3">
          <Link to="/activate" className="text-neutral-600 text-sm underline hover:text-black transition-colors">
            {c.yaTengo}
          </Link>
          <div className="flex gap-4 text-[11px] text-neutral-500">
            <Link to="/privacidad" className="underline hover:text-black transition-colors">
              {t('Privacidad')}
            </Link>
            <button
              type="button"
              onClick={() => setIdioma(idioma === 'es' ? 'en' : 'es')}
              className="underline hover:text-black transition-colors"
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
          ? 'bg-tinta border-tinta text-white'
          : 'bg-white border-black/15 text-neutral-600 hover:border-black/40'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Marca completa: símbolo, logotipo y descriptor — la variante "vertical" del
 * tablero.
 *
 * La K va como imagen y no como SVG en línea porque son ~180 trazos: en línea
 * engordarían el HTML de todas las páginas que la muestren, mientras que como
 * archivo se guarda en caché una vez y se reusa. Se sirve en blanco sobre
 * transparente, generada desde brand/K.svg por scripts/generar-marca.py.
 */
function Marca({ descriptor }) {
  return (
    <div className="text-center">
      <img
        src="/marca-k.png"
        alt=""
        aria-hidden="true"
        className="w-24 h-24 mx-auto invert"
        width={512}
        height={512}
      />
      <p className="marca text-3xl sm:text-4xl mt-2">InkAR</p>
      <div className="w-10 h-px bg-realidad mx-auto my-4" />
      <p className="marca text-tecnologia text-[11px]">{descriptor}</p>
    </div>
  )
}

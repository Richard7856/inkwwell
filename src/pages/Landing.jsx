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

/*
  Video de la sección "la idea, en movimiento".

  Por defecto usa el archivo del repositorio; la variable de entorno permite
  apuntar a otro sin tocar código, que es como entrará la grabación real cuando
  exista (alojada aparte, para no meterle peso al bundle ni al APK).

  El póster no es decorativo: sin él el reproductor muestra un rectángulo negro
  hasta que alguien lo toca, y en una landing eso se lee como un elemento roto.
*/
const VIDEO = import.meta.env.VITE_VIDEO_DEMO || '/video/concepto.mp4'
const POSTER = import.meta.env.VITE_VIDEO_POSTER || '/video/concepto-poster.jpg'

const ES = {
  descriptor: 'Historias que siguen vivas',
  promesa: 'Tu tatuaje deja de ser una imagen quieta',
  ritmo: 'Escanea. Descubre. Revive.',

  queEsTitulo: '¿Qué es InkAR?',
  queEs: [
    'Una app que reconoce tu tatuaje con la cámara y le sobrepone contenido en 3D, anclado a tu piel y siguiendo tu movimiento.',
    'No lo modifica ni lo tapa. El dibujo que ya llevas es lo que activa el contenido: funciona como un código QR, pero sin código a la vista.',
  ],

  vidaTitulo: 'La tinta cobra vida',
  vida: [
    'Un tatuaje es una imagen que no se mueve. Ese es su límite, no su defecto.',
    'Si llevas un dragón, aquí abre las alas. Si llevas una cruz, se enciende. Si llevas al perro que se murió, vuelve a correr.',
    'Da igual si tu tatuaje guarda una historia o simplemente te gustó cómo se veía. Lo que hacemos es quitarle la quietud.',
  ],

  haciaTitulo: 'A dónde vamos',
  hacia: 'Hoy eliges de un catálogo. Lo que estamos construyendo es que subas la foto de tu perro, o describas el dragón que traes en el brazo, y la app genere esa animación. La tuya, no una parecida.',

  comoTitulo: 'Cómo funciona',
  pasos: [
    ['Registras tu tatuaje', 'Le tomas una foto desde la app. En segundos queda activado y no hay que repetirlo nunca.'],
    ['Eliges qué aparece encima', 'Contenido 3D animado. Puedes cambiarlo después sin volver a registrar el tatuaje.'],
    ['Cualquiera lo ve', 'Apunta su cámara a tu piel y aparece, siguiendo tu movimiento. Sin instalar nada, desde el navegador.'],
  ],

  videoTitulo: 'La idea, en movimiento',
  videoTexto: 'Representación del concepto, generada con IA. No es una grabación de la app.',

  distintoTitulo: 'Por qué no es un filtro',
  distinto: [
    ['No vive dentro de una app', 'Quien quiera verlo abre una liga en su navegador y ya. No instala nada, no crea cuenta, no te pide permiso. Un filtro solo existe mientras estás dentro de la app que lo hizo.'],
    ['Está atado al dibujo, no a tu teléfono', 'El contenido vive en el tatuaje. Lo ve quien te lo escanee en la calle, con su celular, sin que tú toques nada — y ve exactamente lo mismo que verías tú.'],
    ['Se registra una vez y se cambia cuando quieras', 'El tatuaje ya lo traes. Lo que agregamos es la capa que vive encima, y esa la puedes cambiar las veces que se te antoje sin volver a registrar nada.'],
  ],

  cta: 'Avísame cuando abra',
  soy: '¿Quién eres?',
  persona: 'Tengo tatuajes',
  artista: 'Soy tatuador o tengo estudio',
  beneficioTitulo: 'Qué recibes por apuntarte',
  beneficios: {
    persona: [
      'Entras antes que el público general.',
      'Créditos de lanzamiento sin costo para animar tu primer tatuaje.',
      'Nos dices qué te gustaría ver encima del tuyo y lo tomamos en cuenta para el catálogo.',
    ],
    artista: [
      'Entras al programa de estudios, que arranca con un grupo pequeño.',
      'Material para tu local: la pieza impresa que tus clientes escanean ahí mismo.',
      'Tu estudio aparece cuando alguien de tu ciudad busque dónde activar su tatuaje.',
      'Sin costo y sin exclusividad.',
    ],
  },
  ciudad: 'Ciudad (opcional)',
  enviando: 'Guardando...',
  gracias: 'Listo, quedas dentro',
  graciasDetalle: 'Te escribimos a {email} en cuanto abramos. No mandamos nada más.',
  yaEstabas: 'Ese correo ya estaba en la lista. No hace falta hacer nada más.',
  artistasTitulo: 'Para estudios de tatuaje',
  artistasTexto: 'Tus clientes ya pagan por un tatuaje. Ofrecerles que además cobre vida no te cuesta trabajo extra y te distingue de cualquier estudio de tu ciudad. Estamos armando el programa con un grupo pequeño de estudios: apúntate y hablamos contigo directo.',
  legalNota: 'Solo usamos tu correo para avisarte del lanzamiento.',
}

const EN = {
  descriptor: 'Stories that stay alive',
  promesa: 'Your tattoo stops being a still image',
  ritmo: 'Scan. Discover. Relive.',

  queEsTitulo: 'What is InkAR?',
  queEs: [
    'An app that recognizes your tattoo through the camera and layers 3D content over it, anchored to your skin and following your movement.',
    'It doesn’t alter it or cover it. The drawing you already carry is what triggers the content: it works like a QR code, without a code in sight.',
  ],

  vidaTitulo: 'The ink comes alive',
  vida: [
    'A tattoo is an image that doesn’t move. That’s its limit, not its flaw.',
    'If you carry a dragon, here it spreads its wings. If you carry a cross, it lights up. If you carry the dog that died, it runs again.',
    'It doesn’t matter whether your tattoo holds a story or you just liked how it looked. What we do is take the stillness out of it.',
  ],

  haciaTitulo: 'Where this is going',
  hacia: 'Today you pick from a catalog. What we’re building is this: you upload a photo of your dog, or describe the dragon on your arm, and the app generates that animation. Yours, not one that resembles it.',

  comoTitulo: 'How it works',
  pasos: [
    ['Register your tattoo', 'Photograph it from the app. It’s activated in seconds and you never do it again.'],
    ['Choose what appears', 'Animated 3D content. You can change it later without registering the tattoo again.'],
    ['Anyone can see it', 'They point a camera at your skin and it appears, following your movement. No install, straight from the browser.'],
  ],

  videoTitulo: 'The idea, in motion',
  videoTexto: 'Concept illustration, AI-generated. Not a recording of the app.',

  distintoTitulo: 'Why this isn’t a filter',
  distinto: [
    ['It doesn’t live inside an app', 'Whoever wants to see it opens a link in their browser and that’s it. No install, no account, nothing asked of you. A filter only exists while you’re inside the app that made it.'],
    ['It’s tied to the drawing, not to your phone', 'The content lives in the tattoo. Anyone who scans it on the street sees it, on their own phone, without you touching anything — and they see exactly what you would see.'],
    ['Registered once, changed whenever', 'You already have the tattoo. What we add is the layer living on top, and that one you can change as many times as you like without registering anything again.'],
  ],

  cta: 'Tell me when it opens',
  soy: 'Who are you?',
  persona: 'I have tattoos',
  artista: 'I’m a tattoo artist or run a studio',
  beneficioTitulo: 'What you get for signing up',
  beneficios: {
    persona: [
      'You get in before the general public.',
      'Free launch credits to animate your first tattoo.',
      'You tell us what you’d like to see over yours, and we factor it into the catalog.',
    ],
    artista: [
      'You join the studio program, starting with a small group.',
      'Material for your shop: the printed piece your clients scan right there.',
      'Your studio shows up when someone in your city looks for where to activate a tattoo.',
      'No cost, no exclusivity.',
    ],
  },
  ciudad: 'City (optional)',
  enviando: 'Saving...',
  gracias: 'You’re in',
  graciasDetalle: 'We’ll write to {email} the moment we open. Nothing else.',
  yaEstabas: 'That email was already on the list. Nothing else to do.',
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
    <div className="min-h-screen overflow-y-auto overflow-x-hidden relative">
      {/* Trazo que entra por la esquina superior, detrás del logotipo */}
      <Tinta src="/tinta/01-diagonal.png"
             className="-top-20 -right-56 w-[620px] h-[420px] opacity-[0.13] rotate-[8deg]" />
      <div className="max-w-lg mx-auto px-6 py-14 relative">

        {/* ── Marca y promesa ── */}
        <Marca descriptor={c.descriptor} />
        <h1 className="text-3xl sm:text-4xl font-semibold text-center mt-10 leading-tight">
          {c.promesa}
        </h1>
        {/* El ritmo de tres palabras es el eje de la voz de marca; se le da aire
            propio en vez de esconderlo dentro de un párrafo. */}
        <p className="marca text-realidad text-center text-sm mt-5">{c.ritmo}</p>
        {/* ── Qué es: la pregunta que la versión anterior nunca contestaba ── */}
        <Seccion titulo={c.queEsTitulo} className="mt-12">
          {c.queEs.map((t) => <Parrafo key={t}>{t}</Parrafo>)}
        </Seccion>

        {/*
          El video va antes del formulario: quien no conoce el producto no
          entrega su correo por una descripción, lo entrega después de ver que
          funciona.

          Se dibuja solo si hay video configurado. Un reproductor vacío o roto en
          la primera pantalla hace más daño que no tener video: sugiere que el
          producto tampoco funciona.
        */}
        {VIDEO && (
          <section className="mt-12">
            <h2 className="text-lg font-semibold mb-3">{c.videoTitulo}</h2>
            <video
              src={VIDEO}
              poster={POSTER || undefined}
              controls
              playsInline
              preload="metadata"
              className="w-full rounded-2xl border border-black/10 bg-black"
            />
            <p className="text-neutral-500 text-xs mt-2">{c.videoTexto}</p>
          </section>
        )}

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

              {/*
                Los beneficios cambian con la selección.

                Lo que le sirve a un tatuado (entrar antes, créditos) y lo que le
                sirve a un estudio (programa, material, aparecer en su ciudad) no
                se parecen. Mostrar una lista genérica obliga a cada uno a
                ignorar la mitad, y la mitad ignorada es la que más pesa.
              */}
              <div className="bg-black/[0.03] border border-black/10 rounded-xl p-4">
                <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">
                  {c.beneficioTitulo}
                </p>
                <ul className="text-neutral-700 text-sm leading-relaxed space-y-1.5">
                  {c.beneficios[perfil].map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="text-realidad shrink-0">—</span>{b}
                    </li>
                  ))}
                </ul>
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

        {/* ── La razón de la marca: por qué "segunda vida" ── */}
        <div className="relative">
          <Tinta src="/tinta/02-curvo.png"
                 className="-left-64 top-4 w-[560px] h-[380px] opacity-[0.10] -rotate-6" />
        </div>
        <Seccion titulo={c.vidaTitulo} className="mt-16 relative">
          {c.vida.map((t) => <Parrafo key={t}>{t}</Parrafo>)}
        </Seccion>

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

        {/* ── La ambición: hoy catálogo, mañana tu recuerdo ── */}
        <Seccion titulo={c.haciaTitulo} className="mt-14">
          <Parrafo>{c.hacia}</Parrafo>
        </Seccion>

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
        <div className="relative">
          <Tinta src="/tinta/03-esquina.png"
                 className="-right-52 -top-10 w-[520px] h-[350px] opacity-[0.11] rotate-[14deg]" />
        </div>
        <section className="mt-14 bg-white border border-black/10 rounded-2xl p-6 shadow-sm relative">
          <h2 className="text-lg font-semibold mb-3">{c.artistasTitulo}</h2>
          <p className="text-neutral-600 text-sm leading-relaxed">{c.artistasTexto}</p>
        </section>

        {/* ── Pie ── */}
        <div className="mt-14 pt-6 border-t border-black/10 flex flex-col items-center gap-3">
          {/*
            Aquí iba "¿Ya tienes la app? Activa tu tatuaje". Se retira: la app
            no se ha liberado, así que le hablaba a un público que no existe y
            mandaba a una pantalla que quien llega no puede usar.
          */}
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

/**
 * Trazo de tinta decorativo.
 *
 * Se dibuja como MÁSCARA CSS y no como <img>: los archivos guardan solo el
 * canal alfa —la tinta es negra en todos lados, el color no aporta nada— así
 * que pesan una cuarta parte, y el color sale de `background-color`. El mismo
 * archivo sirve sobre fondo claro y sobre oscuro sin duplicar assets.
 *
 * Van a baja opacidad porque viven DETRÁS del texto: a plena intensidad
 * compiten con lo que hay que leer, y la página deja de leerse.
 */
function Tinta({ src, className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none absolute bg-tinta ${className}`}
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
      }}
    />
  )
}

function Seccion({ titulo, className = '', children }) {
  return (
    <section className={className}>
      <h2 className="text-lg font-semibold mb-3">{titulo}</h2>
      {children}
    </section>
  )
}

function Parrafo({ children }) {
  return <p className="text-neutral-600 text-sm leading-relaxed mt-3">{children}</p>
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
      {/*
        Logotipo original aprobado (brand/logo.png). Trae el triángulo dentro de
        la A y el ajuste fino entre las letras y la K — detalles que una
        recomposición con texto más el símbolo por separado no reproduce.

        Las dimensiones declaradas reservan el espacio antes de que cargue, para
        que el contenido de abajo no salte.
      */}
      <img
        src="/logo-inkar.png"
        alt="InkAR"
        className="w-full max-w-[320px] mx-auto"
        width={1400}
        height={467}
      />
      <div className="w-10 h-px bg-realidad mx-auto my-5" />
      <p className="marca text-tecnologia text-[11px]">{descriptor}</p>
    </div>
  )
}

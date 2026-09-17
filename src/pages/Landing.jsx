import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getIdioma, setIdioma, t } from '../lib/i18n.js'
import { inscribirEnLista } from '../lib/waitlist.js'
import { registrarEstudio, sugerirCodigo } from '../lib/estudios.js'
import { ligaPublica } from '../lib/urls.js'
import Tinta from '../components/ui/Tinta.jsx'
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

  Sin video configurado, la sección NO se dibuja. Es deliberado: es mejor no
  tener video que tener uno que promete de más.

  Se llegó a publicar un concepto generado con IA y se retiró: un dragón
  fotorrealista con luz volumétrica no se parece a lo que renderiza este motor
  —modelos con esqueleto en Three.js, estética de asset de videojuego— y
  enseñarlo pone al producto en deuda desde el primer día, aunque el rótulo
  aclare que es una ilustración. El archivo quedó en brand/video/ por si sirve
  de referencia.

  Aquí entrará la grabación real: se apunta `VITE_VIDEO_DEMO` a su URL, de
  preferencia alojada fuera del repositorio para no sumarle peso al APK.

  El póster no es decorativo: sin él el reproductor muestra un rectángulo negro
  hasta que alguien lo toca, y en una landing eso se lee como un elemento roto.
*/
const VIDEO = import.meta.env.VITE_VIDEO_DEMO || '/media/demo.mp4'
const POSTER = import.meta.env.VITE_VIDEO_POSTER || '/media/demo.jpg'

/*
  ── Qué es el video que se muestre aquí, y por qué hay que declararlo ──

  `true`  → es una GRABACIÓN de la app funcionando sobre piel real.
  `false` → es una representación (capa de contenido suelta, concepto, render).

  No es un detalle de copy: decide qué rótulo se imprime debajo. Ya pasó una vez
  —se publicó un dragón fotorrealista generado con IA y hubo que retirarlo—
  porque enseñar algo que el motor no produce pone al producto en deuda desde el
  primer día. Y al revés también importa: rotular "representación" una grabación
  real tira a la basura lo único que de verdad convence.

  Los archivos `zero-nace.mp4` y `zero-concha.mp4` del repo son la CAPA DE
  CONTENIDO —lo que se proyecta encima del tatuaje—, no el producto funcionando.
  Si alguno de esos se usa aquí, esto va en `false`.
*/
const VIDEO_ES_GRABACION = true

/*
  ── Las fechas del lanzamiento, en un solo lugar ──

  Van aquí arriba y no repartidas por la copy porque esta fecha YA se movió dos
  veces (17 → 19 → 21) y se puede volver a mover: la revisión de Play tarda
  cerca de un día y no se puede apurar.

  ── Cuidado con el día de la semana ──
  Estuvo publicado "viernes 19" y "jueves 18", y los dos estaban mal: el 19 de
  septiembre de 2026 es SÁBADO y el 18 es VIERNES. Nadie lo notó porque el día
  se escribe a mano en la copy mientras la fecha real vive en las constantes de
  abajo. Al cambiarlas, verifica el día contra un calendario — un producto que
  se equivoca en qué día es no inspira confianza para cuidar un recuerdo.

  Cambiarlas es barato y hay que saberlo: la landing se sirve desde Vercel, así
  que corregir una fecha es un despliegue de segundos. NO exige compilar el APK
  ni pasar por otra revisión — eso solo aplica a lo que va dentro de la app.

  Zona horaria explícita (UTC-6, centro de México). Sin ella, `new Date()` de un
  texto sin huso se interpreta distinto según el navegador y la cuenta regresiva
  saldría corrida un día para alguien en otro país.
*/
const CIERRE_OFERTA = new Date('2026-09-20T23:59:59-06:00')
const APERTURA = new Date('2026-09-21T00:00:00-06:00')

/*
  Tres estados, y el orden importa: primero se pregunta si ya abrimos.

  Se calcula al dibujar y no con un temporizador: la página se abre, se lee y se
  cierra en minutos. Un contador que se actualice solo no cambia ninguna
  decisión y sí agrega una suscripción que mantener.
*/
function momento(ahora = Date.now()) {
  if (ahora >= APERTURA.getTime()) return 'abierto'
  if (ahora > CIERRE_OFERTA.getTime()) return 'oferta-cerrada'
  return 'oferta-vigente'
}

/*
  Con las fechas de hoy, 'oferta-cerrada' dura un segundo: la oferta cierra al
  terminar el 18 y abrimos al empezar el 19. No sobra — es exactamente la red
  para el caso que puede pasar. Si Play tarda y hay que mover APERTURA al 22, la
  página deja de prometer una oferta vencida sin dejar de recoger correos, y sin
  tocar nada más que la constante de arriba.
*/

const ES = {
  descriptor: 'Historias que siguen vivas',
  promesa: 'Tu tatuaje deja de ser una imagen quieta',
  ritmo: 'Escanea. Descubre. Revive.',

  queEsTitulo: '¿Qué es InkAR?',
  queEs: [
    'Una app que reconoce tu tatuaje con la cámara y le pone encima un video tuyo, anclado a tu piel y siguiendo tu movimiento.',
    'No lo modifica ni lo tapa. El dibujo que ya llevas es lo que activa el contenido: funciona como un código QR, pero sin código a la vista.',
  ],

  vidaTitulo: 'La tinta cobra vida',
  vida: [
    'Un tatuaje es una imagen que no se mueve. Ese es su límite, no su defecto.',
    'Si llevas un dragón, aquí abre las alas. Si llevas una cruz, se enciende. Si llevas al perro que se murió, vuelve a correr.',
    'Da igual si tu tatuaje guarda una historia o simplemente te gustó cómo se veía. Lo que hacemos es quitarle la quietud.',
  ],

  haciaTitulo: 'El video es tuyo, no de un catálogo',
  hacia: 'Subes la foto de tu perro y cuentas qué quieres que pase. La app genera ese video y lo ancla a tu tatuaje: el tuyo, no uno parecido. Si solo quieres ver cómo se siente, hay modelos 3D gratis para probar sin pagar nada.',

  comoTitulo: 'Cómo funciona',
  pasos: [
    ['Registras tu tatuaje', 'Le tomas una foto desde la app. En segundos queda activado y no hay que repetirlo nunca.'],
    ['Subes tu recuerdo', 'Una foto y unas palabras: tu perro, esa persona, ese momento. La app genera el video. Puedes cambiarlo después sin volver a registrar el tatuaje.'],
    ['Cualquiera lo ve', 'Apunta su cámara a tu piel y aparece, siguiendo tu movimiento. Sin instalar nada, desde el navegador.'],
  ],

  videoTitulo: 'Así se ve sobre la piel',
  videoTexto: 'Representación del concepto. No es una grabación de la app.',
  videoTextoReal: 'Grabado con un teléfono, sobre un tatuaje real.',

  distintoTitulo: 'Por qué no es un filtro',
  distinto: [
    ['No vive dentro de una app', 'Quien quiera verlo abre una liga en su navegador y ya. No instala nada, no crea cuenta, no te pide permiso. Un filtro solo existe mientras estás dentro de la app que lo hizo.'],
    ['Está atado al dibujo, no a tu teléfono', 'El contenido vive en el tatuaje. Lo ve quien te lo escanee en la calle, con su celular, sin que tú toques nada — y ve exactamente lo mismo que verías tú.'],
    ['Se registra una vez y se cambia cuando quieras', 'El tatuaje ya lo traes. Lo que agregamos es la capa que vive encima, y esa la puedes cambiar las veces que se te antoje sin volver a registrar nada.'],
  ],

  // Fecha en el héroe: hoy no aparece por ningún lado, y una landing que pide
  // el correo sin decir para cuándo pide un cheque en blanco.
  abreEl: 'Abrimos el lunes 21 de septiembre',
  yaAbrimos: 'Ya estamos abiertos',
  ofertaVigente: 'La lista cierra el domingo 20 de septiembre.',
  ofertaCerrada: 'La lista ya cerró, pero te avisamos en cuanto abramos.',

  cta: 'Avísame cuando abra',
  soy: '¿Quién eres?',
  persona: 'Tengo tatuajes',
  artista: 'Soy tatuador o tengo estudio',
  // Deja claro por qué el botón cambia: no es una lista, es el alta de verdad
  artistaNota: 'Los estudios no se apuntan a la lista: se registran y salen con su código listo.',
  beneficioTitulo: { persona: 'Qué recibes por apuntarte', artista: 'Qué recibes al registrar tu estudio' },
  beneficios: {
    persona: [
      '50% de descuento en tu primer video.',
      'Te escribimos el día que abrimos, antes de que lo anunciemos en público.',
      'Nos dices qué quieres animar y lo tomamos en cuenta.',
    ],
    artista: [
      'Entras al programa de estudios, que arranca con un grupo pequeño.',
      'Material para tu local: la pieza impresa que tus clientes escanean ahí mismo.',
      'Tu estudio aparece cuando alguien de tu ciudad busque dónde activar su tatuaje.',
      'Sin costo y sin exclusividad.',
    ],
  },
  irAEstudios: 'Registrar mi estudio ↓',
  enviando: 'Guardando...',
  gracias: 'Listo, quedas dentro',
  graciasDetalle: 'Te escribimos a {email} en cuanto abramos. No mandamos nada más.',
  yaEstabas: 'Ese correo ya estaba en la lista. No hace falta hacer nada más.',
  artistasTitulo: 'Para estudios de tatuaje',
  artistasTexto: 'Tus clientes ya pagan por un tatuaje. Ofrecerles que además cobre vida no te cuesta trabajo extra y te distingue de cualquier estudio de tu ciudad. Estamos armando el programa con un grupo pequeño de estudios: apúntate y hablamos contigo directo.',
  estudioNombre: 'Nombre del estudio',
  estudioCorreo: 'Correo de contacto',
  estudioCodigo: 'Tu código',
  estudioCodigoAyuda: 'Es el que le dirás a tus clientes. Corto y fácil de dictar.',
  estudioCiudad: 'Ciudad',
  estudioBoton: 'Registrar mi estudio',
  estudioEnviando: 'Registrando...',
  estudioListoTitulo: 'Tu estudio está registrado',
  estudioListoTexto: 'Este es tu código. Dáselo a cada cliente que tatúes: cuando lo pongan en la app, sus compras quedan acreditadas a ti.',
  estudioFundador: 'Entraste como estudio fundador: 30% de comisión en vez de 20%.',
  estudioLiga: 'O comparte esta liga, que ya trae tu código:',
  legalNota: 'Solo usamos tu correo para avisarte del lanzamiento.',

  // Segunda invitación, al final: quien leyó hasta aquí ya entendió el producto
  // y no tenía dónde apuntarse sin volver a subir.
  segundaTitulo: 'Entonces, ¿te apuntamos?',
  segundaTexto: 'Ya sabes qué es. Déjanos tu correo y te escribimos el día que abrimos.',
  segundaEstudios: '¿Tienes estudio? No te apuntes aquí — regístralo abajo y sales con tu código.',
}

const EN = {
  descriptor: 'Stories that stay alive',
  promesa: 'Your tattoo stops being a still image',
  ritmo: 'Scan. Discover. Relive.',

  queEsTitulo: 'What is InkAR?',
  queEs: [
    'An app that recognizes your tattoo through the camera and lays a video of yours over it, anchored to your skin and following your movement.',
    'It doesn’t alter it or cover it. The drawing you already carry is what triggers the content: it works like a QR code, without a code in sight.',
  ],

  vidaTitulo: 'The ink comes alive',
  vida: [
    'A tattoo is an image that doesn’t move. That’s its limit, not its flaw.',
    'If you carry a dragon, here it spreads its wings. If you carry a cross, it lights up. If you carry the dog that died, it runs again.',
    'It doesn’t matter whether your tattoo holds a story or you just liked how it looked. What we do is take the stillness out of it.',
  ],

  haciaTitulo: 'The video is yours, not a catalog’s',
  hacia: 'You upload a photo of your dog and say what should happen. The app generates that video and anchors it to your tattoo: yours, not one that resembles it. If you just want to see how it feels, there are free 3D models to try without paying anything.',

  comoTitulo: 'How it works',
  pasos: [
    ['Register your tattoo', 'Photograph it from the app. It’s activated in seconds and you never do it again.'],
    ['Upload your memory', 'One photo and a few words: your dog, that person, that moment. The app generates the video. You can change it later without registering the tattoo again.'],
    ['Anyone can see it', 'They point a camera at your skin and it appears, following your movement. No install, straight from the browser.'],
  ],

  videoTitulo: 'This is how it looks on skin',
  videoTexto: 'Concept illustration. Not a recording of the app.',
  videoTextoReal: 'Shot on a phone, over a real tattoo.',

  distintoTitulo: 'Why this isn’t a filter',
  distinto: [
    ['It doesn’t live inside an app', 'Whoever wants to see it opens a link in their browser and that’s it. No install, no account, nothing asked of you. A filter only exists while you’re inside the app that made it.'],
    ['It’s tied to the drawing, not to your phone', 'The content lives in the tattoo. Anyone who scans it on the street sees it, on their own phone, without you touching anything — and they see exactly what you would see.'],
    ['Registered once, changed whenever', 'You already have the tattoo. What we add is the layer living on top, and that one you can change as many times as you like without registering anything again.'],
  ],

  abreEl: 'We open Monday, September 21',
  yaAbrimos: 'We’re open',
  ofertaVigente: 'The list closes Sunday, September 20.',
  ofertaCerrada: 'The list has closed, but we’ll still tell you when we open.',

  cta: 'Tell me when it opens',
  soy: 'Who are you?',
  persona: 'I have tattoos',
  artista: 'I’m a tattoo artist or run a studio',
  artistaNota: 'Studios don’t join the list: they register and walk away with their code.',
  beneficioTitulo: { persona: 'What you get for joining', artista: 'What you get for registering your studio' },
  beneficios: {
    persona: [
      '50% off your first video.',
      'We write to you the day we open, before we announce it publicly.',
      'You tell us what you’d like to animate and we take it into account.',
    ],
    artista: [
      'You join the studio program, starting with a small group.',
      'Material for your shop: the printed piece your clients scan right there.',
      'Your studio shows up when someone in your city looks for where to activate a tattoo.',
      'No cost, no exclusivity.',
    ],
  },
  irAEstudios: 'Register my studio ↓',
  enviando: 'Saving...',
  gracias: 'You’re in',
  graciasDetalle: 'We’ll write to {email} the moment we open. Nothing else.',
  yaEstabas: 'That email was already on the list. Nothing else to do.',
  artistasTitulo: 'For tattoo studios',
  artistasTexto: 'Your clients already pay for a tattoo. Offering them one that also comes alive costs you no extra work and sets you apart from every studio in your city. We’re building the program with a small group of studios: sign up and we’ll talk directly.',
  estudioNombre: 'Studio name',
  estudioCorreo: 'Contact email',
  estudioCodigo: 'Your code',
  estudioCodigoAyuda: 'The one you’ll tell your clients. Short and easy to say out loud.',
  estudioCiudad: 'City',
  estudioBoton: 'Register my studio',
  estudioEnviando: 'Registering…',
  estudioListoTitulo: 'Your studio is registered',
  estudioListoTexto: 'This is your code. Give it to every client you tattoo: when they enter it in the app, their purchases are credited to you.',
  estudioFundador: 'You’re in as a founding studio: 30% commission instead of 20%.',
  estudioLiga: 'Or share this link, which already carries your code:',
  legalNota: 'We only use your email to tell you about the launch.',

  segundaTitulo: 'So — shall we put you on the list?',
  segundaTexto: 'You know what it is now. Leave us your email and we’ll write the day we open.',
  segundaEstudios: 'Run a studio? Don’t join here — register below and walk away with your code.',
}

export default function Landing() {
  useTema('claro')
  const idioma = getIdioma()
  const c = idioma === 'es' ? ES : EN

  const [email, setEmail] = useState('')
  const [perfil, setPerfil] = useState('persona')
  const [estado, setEstado] = useState('inicial')   // inicial | enviando | listo
  const [yaEstaba, setYaEstaba] = useState(false)
  const [error, setError] = useState('')
  const [videoRoto, setVideoRoto] = useState(false) // el archivo del demo no cargó
  const [conControles, setConControles] = useState(false) // solo si el arranque solo falla
  const videoRef = useRef(null)

  /*
    El video arranca cuando entra en pantalla, no al cargar la página.

    ── Por qué no `autoPlay` a secas ──
    Lo que vende este video son los primeros segundos: el tatuaje quieto y la
    tinta derritiéndose. Si arranca con la carga de la página, para cuando el
    visitante baja hasta él ya va en el perro sentado y se perdió justo la parte
    que prueba el producto. Empezar al entrar en cuadro garantiza que todos ven
    el nacimiento.

    ── Por qué en silencio y en bucle ──
    Sin sonido puede arrancar solo: todos los navegadores bloquean el audio
    automático, y con `muted` no hay nada que bloquear. Y el archivo no trae
    pista de sonido, así que no se pierde nada. En bucle porque dura 9 segundos
    y repetirse es más barato que pedir un clic.

    ── Por qué se quitan los controles, y cuándo vuelven ──
    Una barra de reproducción encima de la piel ensucia justo lo que se quiere
    enseñar, y con 9 segundos en bucle no hay nada que adelantar. Pero si el
    arranque automático falla —ahorro de datos, una política más estricta— el
    visitante se quedaría viendo una imagen fija sin manera de reproducirla. Por
    eso `play()` se vigila: si la promesa se rechaza, vuelven los controles.
  */
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) { v.pause(); return }
        v.play().catch(() => setConControles(true))
      },
      { threshold: 0.5 },
    )
    observador.observe(v)
    return () => observador.disconnect()
  }, [videoRoto])

  // Se calcula una vez por render, no con temporizador: ver `momento()`
  const cuando = momento()

  /*
    Ya no se etiqueta el origen: hubo dos formularios durante unas horas y la
    etiqueta servía para saber cuál convertía. Con uno solo la pregunta no
    existe, y `inscribirEnLista` ya pone `source: 'landing'` por omisión.
  */
  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setEstado('enviando')
    try {
      const { yaEstaba: repetido } = await inscribirEnLista({ email, perfil })
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

        {/*
          La fecha, debajo de la promesa y antes de cualquier otra cosa.

          Hasta ahora no aparecía por ningún lado: se le pedía el correo a la
          gente sin decirle para cuándo, que es pedir un cheque en blanco. Y la
          fecha es justamente lo que vuelve urgente apuntarse.

          La oferta va en la misma píldora y no en un banner aparte: son la misma
          frase —abrimos el 19, la lista cierra el 18— y separarlas haría que se
          leyeran como dos avisos que compiten.

          ── Por qué NO dice "apúntate y llévate el 50%" ──
          El descuento es real: `creditos_primero` cuesta la mitad. Pero se le
          ofrece a CUALQUIERA que nunca haya comprado, no solo a la lista (ver
          `ha_comprado()` en la migración 008). Redactarlo como consecuencia de
          apuntarse —"apúntate y llévate"— prometería una exclusividad que el
          producto no aplica, y el primero que compre sin estar en la lista lo
          descubre. Se enuncian los dos hechos por separado: la lista cierra el
          18, y el primer video lleva 50%. Ambos ciertos, sin inventar la
          relación entre ellos.
        */}
        <div className="mt-6 flex justify-center">
          <div className="inline-flex flex-col items-center gap-1 rounded-2xl
                          bg-realidad/[0.08] border border-realidad/30 px-5 py-3 text-center">
            <p className="text-sm font-semibold text-black">
              {cuando === 'abierto' ? c.yaAbrimos : c.abreEl}
            </p>
            {cuando !== 'abierto' && (
              <p className="text-neutral-600 text-xs leading-relaxed max-w-[22rem]">
                {cuando === 'oferta-vigente' ? c.ofertaVigente : c.ofertaCerrada}
              </p>
            )}
          </div>
        </div>
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
        {VIDEO && !videoRoto && (
          <section className="mt-12">
            <h2 className="text-lg font-semibold mb-3">{c.videoTitulo}</h2>
            {/*
              Se intenta dibujar y se retira si NO carga, en vez de exigir una
              variable de entorno que diga si existe.

              Por qué se cambió: antes el video dependía de `VITE_VIDEO_DEMO`, o
              sea que subir el archivo no bastaba — había que ir a Vercel,
              configurar la variable y redesplegar. Tres pasos y tres lugares
              donde equivocarse, en una ventana de dos días. Ahora se deja el
              archivo en `public/media/demo.mp4` y aparece.

              La regla que motivaba lo anterior se conserva: un reproductor roto
              en la primera pantalla hace más daño que no tener video, porque
              sugiere que el producto tampoco funciona. `onError` cubre justo
              eso — si el archivo no está, la sección desaparece entera.
            */}
            <video
              ref={videoRef}
              src={VIDEO}
              poster={POSTER || undefined}
              muted
              loop
              playsInline
              preload="auto"
              controls={conControles}
              onError={() => setVideoRoto(true)}
              className="w-full rounded-2xl border border-black/10 bg-black"
            />
            <p className="text-neutral-500 text-xs mt-2">
              {VIDEO_ES_GRABACION ? c.videoTextoReal : c.videoTexto}
            </p>
          </section>
        )}

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

        {/*
          ── El único formulario, y va al final ──

          Antes había dos: uno arriba, antes de que nadie entendiera qué es
          esto, y otro aquí. Richard pidió dejar uno solo y quitar el de
          arriba, que es la decisión correcta por dónde cae: quien llega aquí
          ya vio el video, entendió el mecanismo y leyó por qué no es un
          filtro. El correo se pide con el derecho ganado, no de entrada.

          El costo asumido: quien se convence en los primeros diez segundos
          tiene que bajar para apuntarse. Se compensa con la píldora del héroe,
          que da la fecha desde arriba, y con una página que no es larga.

          Este bloque absorbe TODO lo que hacía el de arriba —la pregunta de
          quién eres, los beneficios por perfil y la salida a estudios—. Sin
          eso, un tatuador se quedaría sin su camino: el selector es lo que
          decide si el botón manda a la lista o a su alta real.
        */}
        <section className="mt-16 bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
          {estado === 'listo' ? (
            <div className="text-center">
              <p className="text-xl font-semibold mb-2">{c.gracias}</p>
              <p className="text-neutral-600 text-sm leading-relaxed">
                {yaEstaba
                  ? c.yaEstabas
                  : c.graciasDetalle.replace('{email}', email.trim().toLowerCase())}
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold">{c.segundaTitulo}</h2>
              <p className="text-neutral-600 text-sm leading-relaxed mt-2 mb-4">{c.segundaTexto}</p>

              <form onSubmit={enviar} className="flex flex-col gap-3">
                {/* El correo se pide DESPUÉS de saber quién es: a un estudio se le
                    pide abajo, junto con su nombre y su código, y pedírselo dos
                    veces es la clase de detalle que hace dudar de un producto. */}
                {perfil === 'persona' && (
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
                )}

                <p className="text-neutral-500 text-xs mt-1">{c.soy}</p>
                <div className="grid grid-cols-1 gap-2">
                  <Opcion activo={perfil === 'persona'} onClick={() => setPerfil('persona')}>
                    {c.persona}
                  </Opcion>
                  <Opcion activo={perfil === 'artista'} onClick={() => setPerfil('artista')}>
                    {c.artista}
                  </Opcion>
                </div>

                {perfil === 'artista' && (
                  <p className="text-neutral-500 text-xs -mt-1">{c.artistaNota}</p>
                )}

                {/*
                  Los beneficios cambian con la selección.

                  Lo que le sirve a un tatuado y lo que le sirve a un estudio no
                  se parecen. Mostrar una lista genérica obliga a cada uno a
                  ignorar la mitad, y la mitad ignorada es la que más pesa.

                  Aquí vive la ÚNICA mención del 50%: la píldora del héroe da la
                  fecha y el cierre, y el descuento se dice una sola vez, justo
                  donde se decide dar el correo.
                */}
                <div className="bg-black/[0.03] border border-black/10 rounded-xl p-4">
                  <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">
                    {c.beneficioTitulo[perfil]}
                  </p>
                  <ul className="text-neutral-700 text-sm leading-relaxed space-y-1.5">
                    {c.beneficios[perfil].map((b) => (
                      <li key={b} className="flex gap-2">
                        <span className="text-realidad shrink-0">—</span>{b}
                      </li>
                    ))}
                  </ul>
                </div>

                {/*
                  Un estudio NO se apunta a la lista: se registra abajo y sale
                  con su código funcionando en ese momento. Se conserva la
                  elección porque los beneficios de arriba son lo que lo
                  convence; lo que cambia es a dónde lo lleva el botón.
                */}
                {perfil === 'artista' ? (
                  <a
                    href="#estudios"
                    className="w-full py-4 rounded-2xl bg-tinta text-white font-semibold
                               text-center transition-opacity hover:opacity-85"
                  >
                    {c.irAEstudios}
                  </a>
                ) : (
                  <>
                    <button
                      type="submit"
                      disabled={estado === 'enviando' || !email}
                      className="w-full py-4 rounded-2xl bg-tinta text-white font-semibold
                                 disabled:opacity-30 transition-opacity hover:opacity-85"
                    >
                      {estado === 'enviando' ? c.enviando : c.cta}
                    </button>
                    <p className="text-neutral-500 text-xs text-center">{c.legalNota}</p>
                  </>
                )}
                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              </form>
            </>
          )}
        </section>

        {/* ── Estudios: el canal de distribución ── */}
        <div className="relative">
          <Tinta src="/tinta/03-esquina.png"
                 className="-right-52 -top-10 w-[520px] h-[350px] opacity-[0.11] rotate-[14deg]" />
        </div>
        <section id="estudios"
                 className="mt-14 bg-white border border-black/10 rounded-2xl p-6 shadow-sm relative scroll-mt-6">
          <h2 className="text-lg font-semibold mb-3">{c.artistasTitulo}</h2>
          <p className="text-neutral-600 text-sm leading-relaxed">{c.artistasTexto}</p>
          <FormularioEstudio c={c} />
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
 * Alta de estudio, con el código que el estudio elige.
 *
 * El código se sugiere a partir del nombre mientras el estudio no lo toque:
 * "Tinta Negra" → TINTANEGRA. Un código con su nombre se dicta de viva voz
 * mucho mejor que uno aleatorio, y de eso depende que se use.
 *
 * Al terminar se muestra el código en grande y una liga que ya lo trae: son
 * las dos formas en que el estudio lo va a pasar — de palabra en el estudio,
 * o por mensaje.
 */
function FormularioEstudio({ c }) {
  const [nombre, setNombre] = useState('')
  const [contacto, setContacto] = useState('')
  const [codigo, setCodigo] = useState('')
  const [codigoEditado, setCodigoEditado] = useState(false)
  const [ciudad, setCiudad] = useState('')
  const [estado, setEstado] = useState('inicial')   // inicial | enviando | listo
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')

  const cambiarNombre = (v) => {
    setNombre(v)
    if (!codigoEditado) setCodigo(sugerirCodigo(v))
  }
  const cambiarCodigo = (v) => {
    setCodigoEditado(true)
    setCodigo(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))
  }

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setEstado('enviando')
    try {
      setResultado(await registrarEstudio({ nombre, contacto, codigo, ciudad }))
      setEstado('listo')
    } catch (err) {
      setError(err.message)
      setEstado('inicial')
    }
  }

  const campo = `w-full py-3 px-4 rounded-2xl bg-white border border-black/15
                 text-black placeholder-neutral-400 focus:outline-none focus:border-realidad`

  if (estado === 'listo') {
    const liga = ligaPublica(`/?estudio=${resultado.codigo}`)
    return (
      <div className="mt-5 bg-realidad/[0.07] border border-realidad/40 rounded-2xl p-5">
        <p className="font-semibold">{c.estudioListoTitulo}</p>
        <p className="text-neutral-600 text-sm leading-relaxed mt-1">{c.estudioListoTexto}</p>
        <p className="font-mono text-3xl tracking-[0.2em] text-center my-5 select-all">
          {resultado.codigo}
        </p>
        {resultado.fundador && (
          <p className="text-sm text-realidad font-medium">{c.estudioFundador}</p>
        )}
        <p className="text-neutral-500 text-xs mt-4">{c.estudioLiga}</p>
        <p className="font-mono text-xs break-all mt-1 select-all">{liga}</p>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3 mt-5">
      <input type="text" required value={nombre}
             onChange={(e) => cambiarNombre(e.target.value)}
             placeholder={c.estudioNombre} className={campo} />
      <input type="email" inputMode="email" autoComplete="email" required value={contacto}
             onChange={(e) => setContacto(e.target.value)}
             placeholder={c.estudioCorreo} className={campo} />
      <div>
        <input type="text" required value={codigo}
               onChange={(e) => cambiarCodigo(e.target.value)}
               placeholder={c.estudioCodigo}
               autoCapitalize="characters" autoCorrect="off" spellCheck={false}
               className={`${campo} font-mono tracking-widest`} />
        <p className="text-neutral-500 text-xs mt-1.5 px-1">{c.estudioCodigoAyuda}</p>
      </div>
      <input type="text" value={ciudad}
             onChange={(e) => setCiudad(e.target.value)}
             placeholder={c.estudioCiudad} className={campo} />
      <button
        type="submit"
        disabled={estado === 'enviando' || !nombre || !contacto || codigo.length < 4}
        className="w-full py-4 rounded-2xl bg-tinta text-white font-semibold
                   disabled:opacity-30 transition-opacity hover:opacity-85"
      >
        {estado === 'enviando' ? c.estudioEnviando : c.estudioBoton}
      </button>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
    </form>
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

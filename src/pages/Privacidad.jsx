import { Link } from 'react-router-dom'
import { getIdioma, t } from '../lib/i18n.js'

/**
 * Política de privacidad. Google Play exige una dirección web pública y
 * accesible sin instalar la app antes de aprobar la ficha.
 *
 * Vive como página de la app, y no como documento suelto, para que se despliegue
 * con cada build y no se quede desincronizada del producto que describe.
 *
 * ── Por qué el documento completo por idioma y no frases sueltas ──
 * El resto de la app se traduce frase por frase, pero un texto legal traducido
 * por pedazos produce frases mal armadas: el orden de las cláusulas y la forma
 * de nombrar obligaciones cambian entre idiomas. Aquí cada versión se redacta
 * entera y se elige una.
 *
 * REGLA AL EDITARLA: cada afirmación debe ser verificable en el código, y hay
 * que cambiar AMBOS idiomas. Lo que hoy se afirma se comprobó así:
 *  - Los frames de la cámara al escanear no salen del dispositivo: no hay una
 *    sola llamada de red con imagen en src/components/ARViewer/.
 *  - Railway no guarda la foto: worker/index.js usa multer.memoryStorage().
 *  - Las fotos y los .mind son públicos: buckets públicos en src/lib/storage.js.
 */

const VIGENCIA = { es: '7 de septiembre de 2026', en: 'September 7, 2026' }
const CONTACTO = 'contacto@inkar.app'

const ES = {
  titulo: 'Política de privacidad',
  pie: (v) => `InkAR · Vigente desde el ${v}`,
  secciones: [
    {
      titulo: 'Quién es responsable',
      parrafos: [
        'Richard Figueroa, persona física con domicilio en México, es el responsable del tratamiento de los datos que se describen aquí. Para cualquier asunto relacionado con tu información, incluido el ejercicio de tus derechos, escribe a {correo}.',
      ],
    },
    {
      titulo: 'Qué datos recogemos y para qué',
      lista: [
        ['Tu correo electrónico', 'Es lo único que pedimos para crear la cuenta. Se usa para enviarte el código de acceso o validar tu contraseña, y para reconocerte cuando vuelvas. No enviamos publicidad.'],
        ['La foto del tatuaje que subes', 'Se guarda para mostrar tu tatuaje en tu perfil y para generar el descriptor visual que permite reconocerlo con la cámara.'],
        ['El descriptor visual del tatuaje', 'Un archivo técnico que resume los puntos característicos de la imagen. Es lo que permite que la cámara reconozca tu tatuaje. No contiene datos biométricos ni identifica a una persona: describe un dibujo, no un cuerpo.'],
        ['El modelo 3D que eliges', 'Para saber qué contenido mostrar sobre tu tatuaje.'],
        ['Tu identificador compartible', 'Un código corto y aleatorio que forma tu link público.'],
      ],
    },
    {
      titulo: 'Qué NO recogemos',
      parrafos: [
        '**Las imágenes de la cámara al escanear nunca salen de tu dispositivo.** El reconocimiento del tatuaje ocurre por completo dentro de tu teléfono. No se suben, no se graban y no llegan a ningún servidor nuestro ni de terceros. Escanear el tatuaje de otra persona no requiere cuenta y no deja registro de quién escaneó.',
        'Tampoco recogemos tu ubicación, tu lista de contactos, tu identificador publicitario ni tu actividad en otras aplicaciones. No usamos rastreadores de terceros y no vendemos ni cedemos datos a nadie con fines comerciales.',
      ],
    },
    {
      titulo: 'Qué es público a propósito',
      parrafos: [
        'Para que InkAR funcione, cualquier persona que apunte su cámara a tu tatuaje debe poder ver tu contenido sin tener cuenta. Por eso **la foto de tu tatuaje, su descriptor visual y el modelo 3D que elegiste quedan accesibles públicamente** mediante una dirección de internet, y quien tenga tu link puede verlos.',
        'Tu correo electrónico nunca es público. No publicamos tu nombre ni ningún dato de contacto junto a tus tatuajes.',
        'Súbelo teniendo esto en cuenta: no subas fotos donde aparezca tu rostro, documentos o información que no quieras que otros vean.',
      ],
    },
    {
      titulo: 'Con quién se comparten',
      intro: 'Solo con los proveedores necesarios para que la app funcione. Ninguno los usa para fines propios:',
      lista: [
        ['Supabase', 'Guarda la cuenta, los datos y los archivos. Servidores en Estados Unidos.'],
        ['Railway', 'Genera el descriptor visual a partir de tu foto. La foto se procesa en memoria y no se almacena allí en ningún momento.'],
        ['Vercel', 'Publica la aplicación web.'],
        ['Google Play y RevenueCat', 'Procesan las compras dentro de la app. No recibimos ni almacenamos los datos de tu tarjeta: los maneja Google directamente.'],
      ],
    },
    {
      titulo: 'Cuánto tiempo conservamos tus datos',
      parrafos: ['Mientras tu cuenta exista. Cuando la eliminas, tus datos se borran de inmediato y de forma definitiva, sin copia de respaldo de la que puedan recuperarse.'],
    },
    {
      titulo: 'Tus derechos',
      parrafos: [
        'Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, puedes acceder a tus datos, rectificarlos si son incorrectos, cancelarlos u oponerte a su tratamiento. Escribe a {correo} desde el correo de tu cuenta y responderemos en un plazo máximo de 20 días hábiles.',
        'Para borrar tu cuenta no necesitas escribirnos ni esperar: puedes hacerlo tú en cualquier momento, incluso sin tener la app instalada.',
      ],
      accion: 'Eliminar mi cuenta',
    },
    {
      titulo: 'Edad mínima',
      parrafos: ['InkAR está dirigida a personas mayores de 18 años. No recogemos a sabiendas datos de menores de edad; si detectamos una cuenta de un menor, la eliminamos.'],
    },
    {
      titulo: 'Cambios a esta política',
      parrafos: ['Si cambiamos algo relevante, actualizaremos esta página y su fecha de vigencia. Si el cambio afecta cómo usamos tus datos, te avisaremos por correo antes de que entre en vigor.'],
    },
  ],
  volver: 'Volver al inicio',
}

const EN = {
  titulo: 'Privacy Policy',
  pie: (v) => `InkAR · Effective ${v}`,
  secciones: [
    {
      titulo: 'Who is responsible',
      parrafos: [
        'Richard Figueroa, an individual residing in Mexico, is the data controller for the information described here. For anything related to your data, including exercising your rights, write to {correo}.',
      ],
    },
    {
      titulo: 'What we collect and why',
      lista: [
        ['Your email address', 'The only thing we ask for to create your account. We use it to send your access code or validate your password, and to recognize you when you return. We do not send marketing.'],
        ['The tattoo photo you upload', 'Stored to show your tattoo on your profile and to generate the visual descriptor that lets a camera recognize it.'],
        ['The tattoo’s visual descriptor', 'A technical file summarizing the distinctive points of the image. It is what lets a camera recognize your tattoo. It contains no biometric data and identifies no person: it describes a drawing, not a body.'],
        ['The 3D model you choose', 'So we know what content to show over your tattoo.'],
        ['Your shareable identifier', 'A short random code that forms your public link.'],
      ],
    },
    {
      titulo: 'What we do NOT collect',
      parrafos: [
        '**Camera images never leave your device while scanning.** Tattoo recognition happens entirely inside your phone. Frames are not uploaded, not recorded, and never reach our servers or anyone else’s. Scanning someone else’s tattoo requires no account and leaves no record of who scanned it.',
        'We also do not collect your location, your contacts, your advertising identifier, or your activity in other apps. We use no third-party trackers and we do not sell or hand over data to anyone for commercial purposes.',
      ],
    },
    {
      titulo: 'What is public on purpose',
      parrafos: [
        'For InkAR to work, anyone pointing a camera at your tattoo must be able to see your content without having an account. That is why **your tattoo photo, its visual descriptor, and the 3D model you chose are publicly accessible** through an internet address, and anyone with your link can see them.',
        'Your email address is never public. We do not publish your name or any contact details alongside your tattoos.',
        'Upload with that in mind: do not upload photos showing your face, documents, or anything you would not want others to see.',
      ],
    },
    {
      titulo: 'Who we share it with',
      intro: 'Only the providers needed to run the app. None of them use it for their own purposes:',
      lista: [
        ['Supabase', 'Stores the account, the data, and the files. Servers in the United States.'],
        ['Railway', 'Generates the visual descriptor from your photo. The photo is processed in memory and is never stored there.'],
        ['Vercel', 'Hosts the web application.'],
        ['Google Play and RevenueCat', 'Process in-app purchases. We never receive or store your card details: Google handles them directly.'],
      ],
    },
    {
      titulo: 'How long we keep your data',
      parrafos: ['As long as your account exists. When you delete it, your data is erased immediately and permanently, with no backup it could be restored from.'],
    },
    {
      titulo: 'Your rights',
      parrafos: [
        'Under Mexico’s Federal Law on Protection of Personal Data Held by Private Parties, you may access your data, correct it if inaccurate, delete it, or object to its processing. Write to {correo} from your account’s email address and we will respond within 20 business days.',
        'To delete your account you do not need to write to us or wait: you can do it yourself at any time, even without the app installed.',
      ],
      accion: 'Delete my account',
    },
    {
      titulo: 'Minimum age',
      parrafos: ['InkAR is intended for people 18 and over. We do not knowingly collect data from minors; if we find a minor’s account, we delete it.'],
    },
    {
      titulo: 'Changes to this policy',
      parrafos: ['If we change anything material, we will update this page and its effective date. If the change affects how we use your data, we will email you before it takes effect.'],
    },
  ],
  volver: 'Back to home',
}

export default function Privacidad() {
  const idioma = getIdioma()
  const doc = idioma === 'es' ? ES : EN

  return (
    <div className="min-h-screen px-6 py-10 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">{doc.titulo}</h1>
        <p className="text-gray-500 text-sm mb-10">{doc.pie(VIGENCIA[idioma])}</p>

        {doc.secciones.map((s) => (
          <section key={s.titulo} className="mb-9">
            <h2 className="text-lg font-semibold mb-3">{s.titulo}</h2>
            <div className="text-gray-400 text-sm leading-relaxed">
              {s.intro && <p className="mb-3">{s.intro}</p>}
              {s.parrafos?.map((p, i) => (
                <p key={i} className={i > 0 ? 'mt-3' : undefined}><Texto valor={p} /></p>
              ))}
              {s.lista && (
                <ul className="space-y-3">
                  {s.lista.map(([titulo, detalle]) => (
                    <li key={titulo}>
                      <span className="text-gray-200">{titulo}.</span> {detalle}
                    </li>
                  ))}
                </ul>
              )}
              {s.accion && (
                <Link
                  to="/eliminar-cuenta"
                  className="inline-block mt-4 bg-white text-black font-semibold py-3 px-6 rounded-full"
                >
                  {s.accion}
                </Link>
              )}
            </div>
          </section>
        ))}

        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col gap-3">
          <Link to="/eliminar-cuenta" className="text-gray-400 text-sm underline">
            {t('Eliminar mi cuenta')}
          </Link>
          <Link to="/" className="text-gray-500 text-sm underline">
            {doc.volver}
          </Link>
        </div>
      </div>
    </div>
  )
}

/**
 * Renderiza un párrafo con **negritas** y el marcador {correo} como enlace.
 *
 * Se usa un marcador en vez de partir el texto en fragmentos porque el correo y
 * las frases enfatizadas caen en posiciones distintas en cada idioma.
 */
function Texto({ valor }) {
  const partes = valor.split(/(\*\*[^*]+\*\*|\{correo\})/g)
  return partes.map((parte, i) => {
    if (parte === '{correo}') {
      return <a key={i} href={`mailto:${CONTACTO}`} className="text-white underline">{CONTACTO}</a>
    }
    if (parte.startsWith('**') && parte.endsWith('**')) {
      return <b key={i} className="text-white">{parte.slice(2, -2)}</b>
    }
    return parte
  })
}

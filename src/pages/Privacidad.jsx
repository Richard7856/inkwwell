import { Link } from 'react-router-dom'

/**
 * Política de privacidad de InkAR. Google Play exige una dirección web pública y
 * accesible sin instalar la app antes de aprobar la ficha.
 *
 * Vive como página de la app, y no como documento suelto, para que se despliegue
 * con cada build y no se quede desincronizada del producto que describe.
 *
 * REGLA AL EDITARLA: cada afirmación debe ser verificable en el código. Lo que
 * hoy se afirma se comprobó así:
 *  - Los frames de la cámara al escanear no salen del dispositivo: no hay una
 *    sola llamada de red con imagen en src/components/ARViewer/.
 *  - Railway no guarda la foto: worker/index.js usa multer.memoryStorage().
 *  - Las fotos y los .mind son públicos: buckets públicos en src/lib/storage.js.
 */

const VIGENCIA = '7 de septiembre de 2026'
const CONTACTO = 'contacto@inkar.app'

export default function Privacidad() {
  return (
    <div className="min-h-screen px-6 py-10 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Política de privacidad</h1>
        <p className="text-gray-500 text-sm mb-10">
          InkAR · Vigente desde el {VIGENCIA}
        </p>

        <Seccion titulo="Quién es responsable">
          <p>
            Richard Figueroa, persona física con domicilio en México, es el responsable
            del tratamiento de los datos que se describen aquí. Para cualquier asunto
            relacionado con tu información, incluido el ejercicio de tus derechos,
            escribe a <Correo />.
          </p>
        </Seccion>

        <Seccion titulo="Qué datos recogemos y para qué">
          <Lista items={[
            ['Tu correo electrónico', 'Es lo único que pedimos para crear la cuenta. Se usa para enviarte el código de acceso de 6 dígitos y para reconocerte cuando vuelvas. No enviamos publicidad.'],
            ['La foto del tatuaje que subes', 'Se guarda para mostrar tu tatuaje en tu perfil y para generar el descriptor visual que permite reconocerlo con la cámara.'],
            ['El descriptor visual del tatuaje', 'Un archivo técnico que resume los puntos característicos de la imagen. Es lo que permite que la cámara reconozca tu tatuaje. No contiene datos biométricos ni identifica a una persona: describe un dibujo, no un cuerpo.'],
            ['El modelo 3D que eliges', 'Para saber qué contenido mostrar sobre tu tatuaje.'],
            ['Tu identificador compartible', 'Un código corto y aleatorio que forma tu link público.'],
          ]} />
        </Seccion>

        <Seccion titulo="Qué NO recogemos">
          <p className="mb-3">
            <b className="text-white">Las imágenes de la cámara al escanear nunca salen de tu
            dispositivo.</b> El reconocimiento del tatuaje ocurre por completo dentro de tu
            teléfono. No se suben, no se graban y no llegan a ningún servidor nuestro ni
            de terceros. Escanear el tatuaje de otra persona no requiere cuenta y no deja
            registro de quién escaneó.
          </p>
          <p>
            Tampoco recogemos tu ubicación, tu lista de contactos, tu identificador
            publicitario ni tu actividad en otras aplicaciones. No usamos rastreadores
            de terceros y no vendemos ni cedemos datos a nadie con fines comerciales.
          </p>
        </Seccion>

        <Seccion titulo="Qué es público a propósito">
          <p>
            Para que InkAR funcione, cualquier persona que apunte su cámara a tu tatuaje
            debe poder ver tu contenido sin tener cuenta. Por eso{' '}
            <b className="text-white">la foto de tu tatuaje, su descriptor visual y el modelo
            3D que elegiste quedan accesibles públicamente</b> mediante una dirección de
            internet, y quien tenga tu link puede verlos.
          </p>
          <p className="mt-3">
            Tu correo electrónico nunca es público. No publicamos tu nombre ni ningún dato
            de contacto junto a tus tatuajes.
          </p>
          <p className="mt-3">
            Súbelo teniendo esto en cuenta: no subas fotos donde aparezca tu rostro,
            documentos o información que no quieras que otros vean.
          </p>
        </Seccion>

        <Seccion titulo="Con quién se comparten">
          <p className="mb-3">
            Solo con los proveedores necesarios para que la app funcione. Ninguno los usa
            para fines propios:
          </p>
          <Lista items={[
            ['Supabase', 'Guarda la cuenta, los datos y los archivos. Servidores en Estados Unidos.'],
            ['Railway', 'Genera el descriptor visual a partir de tu foto. La foto se procesa en memoria y no se almacena allí en ningún momento.'],
            ['Vercel', 'Publica la aplicación web.'],
            ['Google Play y RevenueCat', 'Procesan las compras dentro de la app. No recibimos ni almacenamos los datos de tu tarjeta: los maneja Google directamente.'],
          ]} />
        </Seccion>

        <Seccion titulo="Cuánto tiempo conservamos tus datos">
          <p>
            Mientras tu cuenta exista. Cuando la eliminas, tus datos se borran de inmediato
            y de forma definitiva, sin copia de respaldo de la que puedan recuperarse.
          </p>
        </Seccion>

        <Seccion titulo="Tus derechos">
          <p className="mb-3">
            Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los
            Particulares, puedes acceder a tus datos, rectificarlos si son incorrectos,
            cancelarlos u oponerte a su tratamiento. Escribe a <Correo /> desde el correo
            de tu cuenta y responderemos en un plazo máximo de 20 días hábiles.
          </p>
          <p>
            Para borrar tu cuenta no necesitas escribirnos ni esperar: puedes hacerlo tú
            en cualquier momento, incluso sin tener la app instalada.
          </p>
          <Link
            to="/eliminar-cuenta"
            className="inline-block mt-4 bg-white text-black font-semibold py-3 px-6 rounded-full"
          >
            Eliminar mi cuenta
          </Link>
        </Seccion>

        <Seccion titulo="Edad mínima">
          <p>
            InkAR está dirigida a personas mayores de 18 años. No recogemos a sabiendas
            datos de menores de edad; si detectamos una cuenta de un menor, la eliminamos.
          </p>
        </Seccion>

        <Seccion titulo="Cambios a esta política">
          <p>
            Si cambiamos algo relevante, actualizaremos esta página y su fecha de vigencia.
            Si el cambio afecta cómo usamos tus datos, te avisaremos por correo antes de
            que entre en vigor.
          </p>
        </Seccion>

        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col gap-3">
          <Link to="/eliminar-cuenta" className="text-gray-400 text-sm underline">
            Eliminar mi cuenta
          </Link>
          <Link to="/" className="text-gray-500 text-sm underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}

function Seccion({ titulo, children }) {
  return (
    <section className="mb-9">
      <h2 className="text-lg font-semibold mb-3">{titulo}</h2>
      <div className="text-gray-400 text-sm leading-relaxed">{children}</div>
    </section>
  )
}

function Lista({ items }) {
  return (
    <ul className="space-y-3">
      {items.map(([titulo, detalle]) => (
        <li key={titulo}>
          <span className="text-gray-200">{titulo}.</span> {detalle}
        </li>
      ))}
    </ul>
  )
}

function Correo() {
  return (
    <a href={`mailto:${CONTACTO}`} className="text-white underline">
      {CONTACTO}
    </a>
  )
}

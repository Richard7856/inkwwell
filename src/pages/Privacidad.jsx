import { Link } from 'react-router-dom'

/*
  Aviso de privacidad — requisito de la LFPDPPP desde el momento en que la
  landing recolecta correos, no desde que se cobra.

  ⚠️ DOS COSAS QUE HAY QUE AJUSTAR ANTES DE PUBLICAR:
     1. RESPONSABLE — poner el nombre o razón social real con la que se factura.
     2. CONTACTO — hoy apunta a un correo personal. Cambiarlo por uno del
        dominio en cuanto exista, para no exponerlo en una página pública.

  Y que un abogado o el contador lo revise. Esto cubre lo básico de una lista
  de correos; en cuanto haya cobros, cuentas y contenido subido por usuarios
  (fotos y voz de personas fallecidas, nada menos), necesita crecer.
*/
const RESPONSABLE = 'Inkwell'
const CONTACTO = 'rifigue97@gmail.com'

export default function Privacidad() {
  return (
    <div className="min-h-screen bg-ink text-bone px-6 py-14">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-ash text-sm hover:text-bone transition-colors">
          ← Volver
        </Link>

        <h1 className="text-3xl font-extrabold tracking-tight mt-6 mb-2">
          Aviso de privacidad
        </h1>
        <p className="text-ash text-sm mb-10">Última actualización: agosto de 2026</p>

        <div className="flex flex-col gap-8 leading-relaxed">
          <Bloque titulo="Quién es responsable de tus datos">
            <p>
              {RESPONSABLE} es responsable del tratamiento de los datos personales que
              nos compartes a través de este sitio. Para cualquier tema relacionado con
              tu información puedes escribirnos a{' '}
              <a href={`mailto:${CONTACTO}`} className="text-ember underline underline-offset-2">
                {CONTACTO}
              </a>.
            </p>
          </Bloque>

          <Bloque titulo="Qué datos recolectamos">
            <p>Únicamente lo que tú nos escribes en el formulario de la lista de espera:</p>
            <ul className="list-disc pl-5 mt-3 flex flex-col gap-1.5 text-ash">
              <li>Tu correo electrónico.</li>
              <li>La descripción del tatuaje que quieres activar, si decides compartirla.</li>
              <li>El rango de precio que seleccionas, si decides responderlo.</li>
            </ul>
            <p className="mt-3">
              No pedimos tu nombre, teléfono, dirección ni datos de pago. No recolectamos
              datos personales sensibles.
            </p>
          </Bloque>

          <Bloque titulo="Para qué los usamos">
            <ul className="list-disc pl-5 flex flex-col gap-1.5 text-ash">
              <li>Avisarte cuando abramos lugares para activar tatuajes.</li>
              <li>Contarte cómo avanza el proyecto.</li>
              <li>Entender qué le interesa a la gente para decidir qué construir.</li>
            </ul>
            <p className="mt-3">
              No vendemos, rentamos ni compartimos tu correo con terceros para fines
              publicitarios.
            </p>
          </Bloque>

          <Bloque titulo="Con quién se comparten">
            <p>
              Tus datos se almacenan en Supabase, nuestro proveedor de infraestructura,
              que los procesa por nuestra cuenta y bajo nuestras instrucciones. No hay
              otras transferencias.
            </p>
          </Bloque>

          <Bloque titulo="Tus derechos ARCO">
            <p>
              Puedes solicitar en cualquier momento el acceso, rectificación, cancelación
              u oposición al tratamiento de tus datos, así como revocar tu consentimiento,
              escribiendo a{' '}
              <a href={`mailto:${CONTACTO}`} className="text-ember underline underline-offset-2">
                {CONTACTO}
              </a>. Responderemos a tu solicitud en un plazo máximo de 20 días hábiles.
            </p>
            <p className="mt-3">
              Cada correo que te enviemos incluye además un enlace para darte de baja con
              un clic.
            </p>
          </Bloque>

          <Bloque titulo="Cuánto tiempo los conservamos">
            <p>
              Hasta que nos pidas darte de baja, o hasta que el proyecto deje de existir.
              En cualquiera de los dos casos, tu correo se elimina.
            </p>
          </Bloque>

          <Bloque titulo="Cambios a este aviso">
            <p>
              Si cambiamos este aviso, publicaremos la nueva versión en esta misma página
              y actualizaremos la fecha de arriba.
            </p>
          </Bloque>
        </div>

        <Link
          to="/"
          className="inline-block mt-12 text-ash text-sm hover:text-bone transition-colors"
        >
          ← Volver al inicio
        </Link>
      </div>
    </div>
  )
}

function Bloque({ titulo, children }) {
  return (
    <section>
      <h2 className="font-semibold text-lg mb-2">{titulo}</h2>
      {children}
    </section>
  )
}

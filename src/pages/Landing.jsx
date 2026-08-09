import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { joinWaitlist, PRICE_RANGES } from '../lib/waitlist.js'

/**
 * Landing de validación.
 *
 * Su único trabajo es responder dos preguntas, en este orden:
 *   1. ¿A alguien le interesa?          → registros
 *   2. ¿Alguien pagaría, y cuánto?      → la pregunta de precio del formulario
 *
 * Por qué la historia de Zero va antes que cualquier explicación del producto:
 * lo que mueve a la gente no es la realidad aumentada, es el perro. La demo
 * existe porque alguien perdió al suyo y quiso volver a verlo. Explicar la
 * tecnología primero convierte eso en una función más de una app.
 */
export default function Landing() {
  const formRef = useRef(null)

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Mover el foco al primer campo — sin esto quien navega con teclado
    // se queda donde estaba aunque la página se haya desplazado.
    formRef.current?.querySelector('input')?.focus({ preventScroll: true })
  }

  return (
    <div className="min-h-screen bg-ink text-bone">

      {/* ─────────────── HERO ─────────────── */}
      <header className="px-6 pt-10 pb-16 max-w-5xl mx-auto">
        <p className="text-sm tracking-[0.2em] uppercase text-ember mb-10">Inkwell</p>

        <div className="flex flex-col md:flex-row md:items-center gap-10 md:gap-14">

          {/* El video primero en móvil: es la prueba, no la decoración */}
          <div className="shrink-0 mx-auto md:mx-0">
            <div className="rounded-2xl overflow-hidden border border-ink-line bg-ink-soft
                            shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]">
              {/*
                WebM primero y MP4 después: el navegador toma la primera fuente que
                soporta. Chrome usa VP9 (más eficiente) y Safari cae al H.264, que es
                el único que reproduce. Con MP4 solo también funcionaría en dispositivos
                reales — el WebM es margen de seguridad, no requisito.

                muted + playsInline no son opcionales: sin los dos, iOS y Android
                bloquean el autoplay y el hero se queda en el poster.
              */}
              <video
                poster="/media/zero-poster.jpg"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="block w-[260px] sm:w-[288px] h-auto"
                aria-label="Un tatuaje de la huella de un perro en una muñeca; al apuntarle la cámara aparece el perro en 3D"
              >
                <source src="/media/zero-demo.webm" type="video/webm" />
                <source src="/media/zero-demo.mp4" type="video/mp4" />
              </video>
            </div>
            <p className="text-ash text-xs text-center mt-3">Grabación real, sin editar</p>
          </div>

          <div>
            <h1 className="text-[2.6rem] sm:text-5xl font-extrabold leading-[1.05] tracking-tight text-balance">
              Dale una segunda vida
              <br />
              a tu tatuaje
            </h1>
            <p className="text-ash text-lg mt-5 max-w-md leading-relaxed">
              Apunta la cámara a tu tatuaje y velo cobrar vida. Tu perro.
              Tu abuela. La frase que te sostiene.
            </p>

            <button
              onClick={scrollToForm}
              className="mt-8 bg-bone text-ink font-semibold py-3.5 px-8 rounded-full
                         hover:bg-white transition-colors
                         focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ember"
            >
              Quiero el mío
            </button>
            <p className="text-ash text-sm mt-3">Gratis apuntarte. Sin tarjeta.</p>
          </div>
        </div>
      </header>

      {/* ─────────────── LA HISTORIA ─────────────── */}
      <section className="px-6 py-16 border-t border-ink-line">
        <div className="max-w-xl mx-auto prose-serif">
          <p className="text-xs tracking-[0.2em] uppercase text-ember mb-6 font-sans">
            Por qué existe esto
          </p>
          <div className="text-xl leading-[1.7] space-y-5 text-bone/90">
            <p>Zero era mi perro. Me lo mataron.</p>
            <p>
              Me tatué su huella y su nombre en la muñeca, y un día se me ocurrió
              hacer un filtro para volver a verlo encima del tatuaje.
            </p>
            <p>Funcionó.</p>
            <p>
              Se lo enseñé a mis amigos y todos me preguntaron lo mismo:
              <em> ¿y el mío?</em>
            </p>
          </div>
          <p className="text-ash mt-8 font-sans text-sm">— Richard, fundador</p>
        </div>
      </section>

      {/* ─────────────── CÓMO FUNCIONA ─────────────── */}
      <section className="px-6 py-16 border-t border-ink-line">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight mb-10">Cómo funciona</h2>
          <ol className="grid sm:grid-cols-3 gap-8">
            {[
              { n: '1', t: 'Tomas una foto', d: 'De tu tatuaje, con buena luz. Nada más.' },
              { n: '2', t: 'Eliges qué aparece', d: 'Un modelo del catálogo, o tu propia foto, voz o letra.' },
              { n: '3', t: 'Lo compartes', d: 'Cualquiera que le apunte la cámara lo ve. No necesita instalar nada.' },
            ].map((s) => (
              <li key={s.n}>
                <span className="font-mono text-ember text-sm">0{s.n}</span>
                <h3 className="font-semibold text-lg mt-2 mb-1.5">{s.t}</h3>
                <p className="text-ash text-[15px] leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─────────────── QUÉ PUEDES ACTIVAR ─────────────── */}
      <section className="px-6 py-16 border-t border-ink-line">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight mb-3">Qué puedes activar</h2>
          <p className="text-ash mb-10 max-w-lg">
            Estamos empezando. Los primeros de la lista eligen qué construimos antes.
          </p>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                t: 'Memoria',
                d: 'Tu foto, tu voz, la letra de alguien. Tú traes el recuerdo, nosotros lo ponemos sobre tu piel.',
                destacado: true,
              },
              {
                t: 'Catálogo',
                d: 'Modelos 3D animados: lobos, dragones, mariposas, calaveras.',
              },
              {
                t: 'Diseños base',
                d: 'Los tatuajes más comunes, gratis, para que veas cómo se siente.',
              },
            ].map((c) => (
              <div
                key={c.t}
                className={`rounded-xl p-5 border ${
                  c.destacado
                    ? 'border-ember/40 bg-ember/[0.06]'
                    : 'border-ink-line bg-ink-soft'
                }`}
              >
                <h3 className={`font-semibold mb-2 ${c.destacado ? 'text-ember' : ''}`}>{c.t}</h3>
                <p className="text-ash text-sm leading-relaxed">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── FORMULARIO ─────────────── */}
      <section className="px-6 py-16 border-t border-ink-line" ref={formRef}>
        <WaitlistForm />
      </section>

      <footer className="px-6 py-10 border-t border-ink-line">
        <div className="max-w-xl mx-auto flex flex-wrap gap-x-6 gap-y-2 text-ash text-sm">
          <span>Inkwell · Hecho en México</span>
          <Link to="/privacidad" className="hover:text-bone transition-colors underline underline-offset-2">
            Aviso de privacidad
          </Link>
        </div>
      </footer>
    </div>
  )
}

/** Formulario de lista de espera. Tres campos: solo el correo es obligatorio. */
function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [tattoo, setTattoo] = useState('')
  const [priceRange, setPriceRange] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | done | already | error
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')

    try {
      const { alreadyIn } = await joinWaitlist({
        email,
        tattoo,
        priceRange,
        source: new URLSearchParams(window.location.search).get('utm_source') || 'directo',
      })
      setStatus(alreadyIn ? 'already' : 'done')
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  if (status === 'done' || status === 'already') {
    return (
      <div className="max-w-xl mx-auto text-center">
        <div className="w-14 h-14 rounded-full border border-ember/50 bg-ember/10
                        flex items-center justify-center mx-auto mb-5 text-ember text-2xl">
          ✓
        </div>
        <h2 className="text-2xl font-bold tracking-tight mb-3">
          {status === 'already' ? 'Ya estabas en la lista' : 'Listo, estás dentro'}
        </h2>
        <p className="text-ash leading-relaxed max-w-sm mx-auto">
          Te vamos a escribir en cuanto abramos los primeros lugares. Mientras tanto
          te contamos cómo va — sin spam, y te puedes salir cuando quieras.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold tracking-tight mb-3">Entra a la lista</h2>
      <p className="text-ash mb-8">
        Vamos a activar los primeros tatuajes en las próximas semanas. Sin costo por apuntarte.
      </p>

      <div className="flex flex-col gap-5">
        <Field label="Tu correo" htmlFor="email">
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            className="w-full bg-ink-soft border border-ink-line rounded-xl px-4 py-3
                       text-bone placeholder:text-ash/50
                       focus:border-ember/60 focus:outline-none transition-colors"
          />
        </Field>

        <Field label="¿Qué tatuaje quieres activar?" htmlFor="tattoo" opcional>
          <input
            id="tattoo"
            type="text"
            value={tattoo}
            onChange={(e) => setTattoo(e.target.value)}
            placeholder="La huella de mi perro, el nombre de mi abuela..."
            className="w-full bg-ink-soft border border-ink-line rounded-xl px-4 py-3
                       text-bone placeholder:text-ash/50
                       focus:border-ember/60 focus:outline-none transition-colors"
          />
        </Field>

        <fieldset>
          <legend className="text-sm font-medium mb-1">
            Si tu tatuaje pudiera hacer esto, ¿cuánto pagarías una sola vez?
          </legend>
          <p className="text-ash text-xs mb-3">
            Contesta con sinceridad — nos sirve más un no que un sí de compromiso.
          </p>
          <div className="flex flex-wrap gap-2">
            {PRICE_RANGES.map((r) => (
              <label
                key={r.value}
                className={`cursor-pointer text-sm px-4 py-2 rounded-full border transition-colors
                  ${priceRange === r.value
                    ? 'border-ember bg-ember/15 text-ember'
                    : 'border-ink-line bg-ink-soft text-ash hover:border-ash/50'
                  }`}
              >
                <input
                  type="radio"
                  name="priceRange"
                  value={r.value}
                  checked={priceRange === r.value}
                  onChange={(e) => setPriceRange(e.target.value)}
                  className="sr-only"
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={status === 'sending'}
          className="bg-bone text-ink font-semibold py-3.5 rounded-full mt-2
                     hover:bg-white transition-colors disabled:opacity-50
                     focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ember"
        >
          {status === 'sending' ? 'Apuntando...' : 'Apuntarme'}
        </button>

        {status === 'error' && (
          <p className="text-red-400 text-sm" role="alert">{errorMsg}</p>
        )}

        <p className="text-ash text-xs leading-relaxed">
          Usamos tu correo solo para avisarte de Inkwell. Puedes darte de baja cuando
          quieras. Lee el{' '}
          <Link to="/privacidad" className="underline underline-offset-2 hover:text-bone">
            aviso de privacidad
          </Link>.
        </p>
      </div>
    </form>
  )
}

function Field({ label, htmlFor, opcional, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium mb-1.5">
        {label}
        {opcional && <span className="text-ash font-normal"> · opcional</span>}
      </label>
      {children}
    </div>
  )
}

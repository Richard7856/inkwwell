import { Link } from 'react-router-dom'
import { getIdioma } from '../lib/i18n.js'
import { useTema } from '../lib/tema.js'

/**
 * Demo público: probar el AR sin tener un tatuaje.
 *
 * ── Por qué existe ──
 * Nadie que llega a la landing tiene un tatuaje activado, y los jueces del
 * concurso tampoco tienen tatuajes. Sin esto, conocer el producto depende de
 * que alguien te lo cuente o de un video — y un video no demuestra que funcione.
 *
 * ── Por qué un marcador impreso o en otra pantalla ──
 * Casi todo el mundo llega desde el teléfono, y un teléfono no puede apuntarse
 * a sí mismo. La salida es separar la imagen del visor: la imagen vive en papel
 * o en otra pantalla, y el teléfono la mira.
 *
 * El marcador se generó a propósito y se midió con el analizador del worker
 * (veredicto BUENO, 33% de seguimiento). No es un dibujo cualquiera: los
 * patrones planos o simétricos no se rastrean.
 */

const ES = {
  titulo: 'Pruébalo sin tatuaje',
  intro: 'No necesitas tener un tatuaje activado para ver cómo funciona. Solo necesitas esta imagen delante de la cámara.',
  pasos: [
    'Abre esta imagen en otra pantalla —una computadora, la tablet, el teléfono de un amigo— o imprímela.',
    'Toca "Abrir la cámara" aquí abajo y da permiso.',
    'Apunta a la imagen. El fénix aparece encima y sigue tus movimientos.',
  ],
  abrir: 'Abrir la cámara',
  descargar: 'Descargar la imagen',
  nota: 'Funciona igual con un tatuaje real: esta imagen solo hace de sustituto para que puedas probarlo hoy.',
  volver: 'Volver',
}

const EN = {
  titulo: 'Try it without a tattoo',
  intro: 'You don’t need an activated tattoo to see how this works. You just need this image in front of your camera.',
  pasos: [
    'Open this image on another screen — a computer, a tablet, a friend’s phone — or print it.',
    'Tap “Open the camera” below and grant permission.',
    'Point at the image. The phoenix appears on top and follows your movement.',
  ],
  abrir: 'Open the camera',
  descargar: 'Download the image',
  nota: 'It works the same with a real tattoo: this image is just a stand-in so you can try it today.',
  volver: 'Back',
}

export default function Demo() {
  useTema('claro')
  const c = getIdioma() === 'es' ? ES : EN

  return (
    <div className="min-h-screen overflow-y-auto">
      <div className="max-w-lg mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-3">{c.titulo}</h1>
        <p className="text-neutral-600 text-sm leading-relaxed mb-8">{c.intro}</p>

        {/* El marcador, en blanco para que se lea igual impreso que en pantalla */}
        <div className="bg-white border border-black/10 rounded-2xl p-4 mb-8 shadow-sm">
          <img
            src="/targets/marcador-demo.png"
            alt={c.titulo}
            className="w-full max-w-xs mx-auto block"
          />
        </div>

        <ol className="flex flex-col gap-4 mb-8">
          {c.pasos.map((paso, i) => (
            <li key={paso} className="flex gap-3 text-sm text-neutral-700 leading-relaxed">
              <span className="shrink-0 w-6 h-6 rounded-full bg-tinta text-white
                               flex items-center justify-center text-xs font-semibold">
                {i + 1}
              </span>
              {paso}
            </li>
          ))}
        </ol>

        <Link
          to="/scan?demo=marcador"
          className="block w-full py-4 rounded-2xl bg-tinta text-white font-semibold
                     text-center hover:opacity-85 transition-opacity"
        >
          {c.abrir}
        </Link>

        {/*
          La descarga es un enlace directo al archivo, no un blob generado en
          JavaScript: dentro del APK una descarga sintética no llega a ningún
          lado, mientras que un enlace a un archivo real lo abre el sistema.
        */}
        <a
          href="/targets/marcador-demo.png"
          download="inkar-marcador.png"
          className="block text-center text-neutral-600 text-sm underline mt-4 hover:text-black transition-colors"
        >
          {c.descargar}
        </a>

        <p className="text-neutral-500 text-xs leading-relaxed mt-8">{c.nota}</p>

        <Link to="/" className="block text-center text-neutral-500 text-sm underline mt-8">
          {c.volver}
        </Link>
      </div>
    </div>
  )
}

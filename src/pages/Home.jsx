import { Link } from 'react-router-dom'
import { t, getIdioma, setIdioma } from '../lib/i18n.js'

/**
 * Landing page — primer contacto del usuario.
 *
 * ¿Por qué "Activar" es el CTA primario?
 * El flujo de escaneo requiere un ?tattoo=uuid específico — no tiene sentido
 * abrir /scan sin ese parámetro (no hay target que detectar).
 * Los usuarios que quieren escanear llegan vía link compartido, no desde Home.
 * Los usuarios que llegan a Home sin link quieren activar su propio tatuaje.
 */
export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight mb-2">
        InkAR
      </h1>
      <p className="text-gray-400 text-lg mb-10 max-w-xs">
        {t('Tu tatuaje cobra vida en realidad aumentada')}
      </p>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        {/* CTA primario — activa tu propio tatuaje */}
        <Link
          to="/activate"
          className="bg-white text-black font-semibold py-3 px-6 rounded-full text-center
                     hover:bg-gray-200 transition-colors"
        >
          {t('Activar mi tatuaje')}
        </Link>

        {/* CTA secundario — para quien ya tiene un link */}
        <p className="text-gray-500 text-sm">
          {t('¿Te compartieron un link de tatuaje?')}{' '}
          <span className="text-gray-300">{t('Ábrelo directo desde tu celular.')}</span>
        </p>
      </div>

      <p className="text-gray-600 text-xs mt-12 max-w-xs leading-relaxed">
        {t('Activa tu tatuaje una vez. Cualquier persona que apunte su cámara verá tu mundo 3D.')}
      </p>

      {/*
        TEMPORAL: acceso a la validación de multi-tatuaje.

        Carga un .mind con los dos tatuajes de prueba ya fusionados, para
        comprobar que MindAR los distingue antes de construir perfiles y links.
        Se retira cuando exista el perfil de usuario real.
      */}
      <Link
        to="/scan?demo=multi"
        className="mt-8 text-xs text-gray-500 underline hover:text-gray-300 transition-colors"
      >
        {t('Probar multi-tatuaje (demo)')}
      </Link>

      {/* Identificador de build — permite confirmar de un vistazo qué versión
          corre el dispositivo. El APK se instala a mano y es fácil quedarse con
          uno viejo sin notarlo. Se inyecta en vite.config.js */}
      <p className="text-gray-800 text-[10px] mt-6 font-mono">{__BUILD_ID__}</p>

      {/* Play exige que ambos caminos sean alcanzables DENTRO de la app, no solo
          por su dirección web. Aquí abajo porque son trámite, no producto. */}
      <div className="flex gap-4 mt-6 text-[11px] text-gray-600">
        <Link to="/privacidad" className="underline hover:text-gray-400 transition-colors">
          {t('Privacidad')}
        </Link>
        <Link to="/eliminar-cuenta" className="underline hover:text-gray-400 transition-colors">
          {t('Eliminar mi cuenta')}
        </Link>
        {/*
          Cambio de idioma manual.

          Se detecta solo del navegador, pero el juez del concurso o un revisor
          puede tener el teléfono en un idioma y querer ver el otro. Sin este
          interruptor no habría forma de comprobarlo sin cambiar el idioma del
          sistema entero.
        */}
        <button
          type="button"
          onClick={() => setIdioma(getIdioma() === 'es' ? 'en' : 'es')}
          className="underline hover:text-gray-400 transition-colors"
        >
          {getIdioma() === 'es' ? 'English' : 'Español'}
        </button>
      </div>
    </div>
  )
}

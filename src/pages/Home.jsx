/* global __BUILD_ID__ */ // lo inyecta vite.config.js en tiempo de build
import { Link } from 'react-router-dom'
import { t, getIdioma, setIdioma } from '../lib/i18n.js'
import Logo from '../components/ui/Logo.jsx'
import Tinta from '../components/ui/Tinta.jsx'
import Boton from '../components/ui/Boton.jsx'

/**
 * Inicio de la app — primer contacto dentro del APK.
 *
 * ── Por qué "Activar" es el CTA primario ──
 * Quien llega aquí sin una liga quiere activar su propio tatuaje. Quien tiene
 * una liga la abre directo y nunca pasa por esta pantalla.
 *
 * ── Por qué "Pruébalo sin tatuaje" está aquí y no solo en la landing ──
 * Los jueces del concurso instalan la app y no tienen tatuajes. Si la única
 * entrada al demo vive en la web, dentro de la app no encuentran qué escanear
 * y califican lo que se imaginan. Esta es la pantalla que ven al abrir.
 *
 * ── Por qué el logotipo y no el nombre en texto ──
 * La app publicada mostraba "InkAR" en un h1 genérico. El logotipo es la única
 * pieza de marca que el usuario reconoce de la tienda y del estudio; sin él,
 * la app podría ser cualquiera.
 */
export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-6 text-center">
      {/* El mismo trazo de la landing, en tinta blanca sobre el fondo oscuro */}
      <Tinta
        src="/tinta/01-diagonal.png"
        color="bg-white"
        className="-top-24 -right-48 w-[560px] h-[380px] opacity-[0.07] rotate-[8deg]"
      />

      <div className="relative flex flex-col items-center w-full max-w-xs">
        <Logo alto={44} className="mb-5" />
        <p className="text-gray-400 text-lg mb-10 leading-snug">
          {t('Tu tatuaje cobra vida en realidad aumentada')}
        </p>

        <div className="flex flex-col gap-3 w-full">
          <Boton to="/activate">{t('Activar mi tatuaje')}</Boton>
          <Boton to="/demo" variante="secundario">{t('Pruébalo sin tatuaje')}</Boton>
          <Boton to="/creditos" variante="enlace" className="mt-1">{t('Mis créditos')}</Boton>
        </div>

        <p className="text-gray-500 text-sm mt-8">
          {t('¿Te compartieron un link de tatuaje?')}{' '}
          <span className="text-gray-300">{t('Ábrelo directo desde tu celular.')}</span>
        </p>
      </div>

      <p className="text-gray-600 text-xs mt-12 max-w-xs leading-relaxed">
        {t('Activa tu tatuaje una vez. Cualquier persona que apunte su cámara verá tu recuerdo cobrar vida.')}
      </p>

      {/* Identificador de build — permite confirmar de un vistazo qué versión
          corre el dispositivo. El APK se instala a mano y es fácil quedarse con
          uno viejo sin notarlo. Se inyecta en vite.config.js */}
      <p className="text-gray-800 text-[10px] mt-6 font-mono">{__BUILD_ID__}</p>

      {/* Play exige que ambos caminos sean alcanzables DENTRO de la app, no solo
          por su dirección web. Aquí abajo porque son trámite, no producto. */}
      <div className="flex gap-4 mt-4 text-[11px] text-gray-600">
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

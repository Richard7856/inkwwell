import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import LoginGate from '../components/Auth/LoginGate.jsx'
import Encabezado from '../components/ui/Encabezado.jsx'
import Spinner from '../components/ui/Spinner.jsx'
import Tarjeta from '../components/ui/Tarjeta.jsx'
import Boton from '../components/ui/Boton.jsx'
import { ensureProfile, getMyTattoos } from '../lib/profile.js'
import { ligaDeTatuaje } from '../lib/urls.js'
import { t } from '../lib/i18n.js'

/**
 * Mis tatuajes.
 *
 * ── Por qué existe ──
 * Era un placeholder de veinte líneas que solo decía "inicia sesión". Con la
 * generación de video funcionando eso se volvió un hueco real: alguien compra
 * un crédito, genera su recuerdo, cierra la app — y no tenía ninguna forma de
 * volver a encontrar su tatuaje ni su liga. La liga solo aparecía una vez, en
 * la pantalla de "listo", y si la perdías ahí la perdías para siempre.
 *
 * ── Por qué muestra el estado del contenido ──
 * Un tatuaje puede estar activado y no tener nada encima todavía: el video se
 * genera en segundo plano y puede tardar minutos, o haber fallado. Decir
 * "esperando tu video" es la diferencia entre paciencia y un reclamo.
 */
export default function Profile() {
  const { user, isLoggedIn, loading: cargandoSesion } = useAuth()
  const [tatuajes, setTatuajes] = useState(null) // null = cargando
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState(null) // id del que se acaba de copiar

  useEffect(() => {
    if (!isLoggedIn || !user) return
    let vigente = true

    ensureProfile(user)
      .then((perfil) => getMyTattoos(perfil.id))
      .then((filas) => { if (vigente) setTatuajes(filas) })
      .catch((err) => { if (vigente) { setError(err.message); setTatuajes([]) } })

    return () => { vigente = false }
  }, [isLoggedIn, user?.id])

  const copiar = async (id) => {
    try {
      await navigator.clipboard?.writeText(ligaDeTatuaje(id))
      setCopiado(id)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      // Sin portapapeles (contexto no seguro, permisos): la liga sigue visible
      // en pantalla para copiarla a mano, así que no se muestra un error
    }
  }

  if (cargandoSesion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen px-6 py-8 pb-safe">
      <Encabezado titulo={t('Mis tatuajes')} />

      {!isLoggedIn ? (
        <LoginGate
          titulo={t('Identifícate para ver tus tatuajes')}
          descripcion={t('Tu cuenta guarda tus tatuajes y tu link, para que no los pierdas si cambias de celular.')}
        />
      ) : tatuajes === null ? (
        <div className="text-center mt-12">
          <Spinner className="mx-auto mb-3" />
          <p className="text-gray-500 text-sm">{t('Cargando tus tatuajes...')}</p>
        </div>
      ) : tatuajes.length === 0 ? (
        <div className="text-center mt-12">
          <p className="text-gray-300 font-medium mb-2">{t('Todavía no activas ningún tatuaje')}</p>
          <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto leading-relaxed">
            {t('Activa uno y cualquier persona que apunte su cámara podrá ver tu recuerdo.')}
          </p>
          <Boton to="/activate" className="max-w-xs mx-auto">{t('Activar mi tatuaje')}</Boton>
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            {tatuajes.map((tat) => (
              <FilaTatuaje
                key={tat.id}
                tatuaje={tat}
                copiado={copiado === tat.id}
                onCopiar={() => copiar(tat.id)}
              />
            ))}
          </div>
          <Boton to="/activate" variante="secundario" className="mt-6">
            {t('Activar otro tatuaje')}
          </Boton>
        </>
      )}

      {error && (
        <p className="text-red-400 text-sm mt-4 text-center">{error}</p>
      )}
    </div>
  )
}

/*
  Un tatuaje activado puede estar en tres situaciones, y conviene distinguirlas
  porque llevan a acciones distintas: con video listo se prueba; con modelo del
  catálogo también; sin nada, el video viene en camino o falló y lo que toca es
  esperar o reintentar.
*/
function estadoDe(tatuaje) {
  if (tatuaje.video_url) return { texto: t('Tu recuerdo, listo'), color: 'text-realidad', probar: true }
  if (tatuaje.glb_url) return { texto: t('Modelo del catálogo'), color: 'text-gray-400', probar: true }
  return { texto: t('Esperando tu video'), color: 'text-amber-400', probar: false }
}

function FilaTatuaje({ tatuaje, copiado, onCopiar }) {
  const estado = estadoDe(tatuaje)

  return (
    <Tarjeta>
      <div className="flex items-center gap-3">
        <img
          src={tatuaje.image_url}
          alt={t('Tu tatuaje')}
          className="w-16 h-16 rounded-xl object-cover shrink-0 border border-white/10"
        />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${estado.color}`}>{estado.texto}</p>
          <p className="text-xs text-gray-600 font-mono truncate mt-0.5">
            {ligaDeTatuaje(tatuaje.id)}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        {estado.probar && (
          <Boton to={`/scan?tattoo=${tatuaje.id}`} className="flex-1 py-2.5 text-sm">
            {t('Probar')}
          </Boton>
        )}
        <Boton
          variante="secundario"
          onClick={onCopiar}
          className={`py-2.5 text-sm ${estado.probar ? 'flex-1' : ''}`}
        >
          {copiado ? t('¡Copiada!') : t('Copiar liga')}
        </Boton>
      </div>
    </Tarjeta>
  )
}

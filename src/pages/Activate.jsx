import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PhotoUpload from '../components/UploadFlow/PhotoUpload.jsx'
import DesignPicker from '../components/UploadFlow/DesignPicker.jsx'
import CompileStatus from '../components/UploadFlow/CompileStatus.jsx'
import QualityReport from '../components/UploadFlow/QualityReport.jsx'
import { uploadTattooImage, uploadMindFile } from '../lib/storage.js'
import { createTattoo } from '../lib/supabase.js'
import { compileMindFile } from '../lib/compiler.js'
import { useAuth } from '../hooks/useAuth.js'
import { ensureProfile } from '../lib/profile.js'
import { aplicarCodigoPendiente, recordarCodigoPendiente, leerCodigoPendiente } from '../lib/estudios.js'
import { ligaDeTatuaje } from '../lib/urls.js'
import LoginGate from '../components/Auth/LoginGate.jsx'
import { t } from '../lib/i18n.js'

/**
 * Flujo de activación — Flujo A.
 * Pasos: foto → subir → compilar y MEDIR → (veredicto) → elegir diseño → guardar.
 *
 * ── Por qué se compila ANTES de elegir el diseño ──
 * Compilar es el único momento en que se puede medir si el tatuaje va a
 * rastrear: las métricas salen de los descriptores que produce esa misma
 * compilación. En el orden anterior —elegir y luego compilar— el veredicto
 * llegaba después del compromiso del usuario. Cuando el diseño sea de pago eso
 * significa cobrar antes de saber si el tatuaje funciona, que es la receta del
 * reembolso.
 *
 * No agrega espera: son los mismos ~11 segundos, corridos un paso antes. El
 * .mind se guarda en estado y se sube al final, así que no se compila dos veces.
 *
 * El costo aceptado es que quien abandone en el selector deja una compilación
 * sin usar. Frente a un reembolso, no se compara.
 *
 * ── Por qué guardamos imageFile en estado además de imageUrl ──
 * La foto se sube a Supabase al terminar el paso 1, pero el worker de
 * compilación necesita el File original (binario) — no la URL pública. Mantener
 * ambas referencias evita re-descargar la imagen desde Supabase para compilar.
 *
 * ── Por qué el error de guardado vuelve a 'design' y no a 'upload' ──
 * La foto y el .mind ya existen — no tiene sentido rehacer nada de eso. El
 * usuario reintenta con el mismo diseño o con otro.
 */
export default function Activate() {
  const { user, isLoggedIn, loading: cargandoSesion } = useAuth()
  // upload | uploading | compiling | quality | design | saving | done
  const [step, setStep] = useState('upload')
  const [imageUrl, setImageUrl] = useState(null)
  const [imageFile, setImageFile] = useState(null) // referencia al File original para el worker
  const [mindBuffer, setMindBuffer] = useState(null) // .mind ya compilado, pendiente de subir
  const [metrics, setMetrics] = useState(null) // veredicto del analizador; null = no se midió
  const [overridden, setOverridden] = useState(false) // activó pese a la advertencia
  const [selectedDesign, setSelectedDesign] = useState(null)
  const [tattooId, setTattooId] = useState(null) // UUID del tatuaje en Supabase
  const [error, setError] = useState('')
  // Progreso real de compilación (0-100) reportado por el worker vía SSE
  const [compileProgress, setCompileProgress] = useState(0)
  const [compileStage, setCompileStage] = useState('compiling')
  const [elapsed, setElapsed] = useState(0)
  // Capa de tinta extraída de la foto — solo para mostrar durante la compilación
  const [inkLayer, setInkLayer] = useState(null)
  // Nombre del estudio al que se acreditó, para confirmarlo en pantalla
  const [estudioAcreditado, setEstudioAcreditado] = useState(null)

  /*
    Al entrar se asegura el perfil y se aplica el código de estudio pendiente.

    Va aquí y no dentro de handleDesignSelected porque la atribución debe
    quedar desde que el usuario entra, no cuando termine de activar: si abandona
    a medio flujo, el estudio que lo trajo ya está registrado. Y `atribuir_estudio`
    actualiza la fila de `users`, que solo existe después de ensureProfile.
  */
  useEffect(() => {
    if (!isLoggedIn || !user) return
    let vigente = true
    ensureProfile(user)
      .then(() => aplicarCodigoPendiente())
      .then((nombre) => { if (vigente && nombre) setEstudioAcreditado(nombre) })
      .catch((err) => console.error('[activate] perfil/estudio:', err))
    return () => { vigente = false }
  }, [isLoggedIn, user?.id])

  /*
    Cronómetro de la etapa de compilación.

    Se muestra junto al porcentaje porque el avance de MindAR no es lineal en el
    tiempo: la primera mitad (features de detección) es bastante más lenta que la
    segunda. Ver solo el porcentaje daría la impresión de que se atoró.
  */
  useEffect(() => {
    if (step !== 'compiling') {
      setElapsed(0)
      return
    }

    const startedAt = Date.now()
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [step])

  const handlePhotoSelected = async (file, extractedInk = null) => {
    setStep('uploading')
    setError('')

    // Guardar referencia al File — lo necesitamos después para el worker de compilación
    setImageFile(file)
    setInkLayer(extractedInk)

    try {
      const { url } = await uploadTattooImage(file)
      setImageUrl(url)
      await compilarYMedir(file)
    } catch (err) {
      setError(err.message)
      setStep('upload')
    }
  }

  /*
    Compila el .mind y evalúa el veredicto del analizador.

    Los niveles 'bueno' y 'excelente' saltan directo al selector: interponer una
    pantalla de felicitación entre la foto y el diseño solo agrega un toque más
    a un flujo que ya dura medio minuto.

    Sin métricas (worker viejo, o respaldo por /compile) también pasa de largo.
    No medir no es lo mismo que medir mal: advertir de una calidad que nadie
    comprobó sería inventar un problema.
  */
  const compilarYMedir = async (file) => {
    setStep('compiling')
    setError('')
    setCompileProgress(0)
    setCompileStage('compiling')

    try {
      const resultado = await compileMindFile(file, setCompileProgress)
      setMindBuffer(resultado.mindBuffer)
      setMetrics(resultado.metrics)
      setOverridden(false)

      const nivel = resultado.metrics?.verdict?.level
      setStep(nivel === 'malo' || nivel === 'aceptable' ? 'quality' : 'design')
    } catch (err) {
      setError(err.message)
      // Volver a la foto: si la compilación falló, el problema está en la imagen
      setStep('upload')
    }
  }

  /*
    Repetir la foto tras el veredicto.

    La foto anterior queda huérfana en Storage. Se acepta a sabiendas: limpiarla
    exigiría rastrear qué subidas quedaron sin registro, y una foto suelta cuesta
    kilobytes. Si el volumen lo justifica, se barre después por fecha contra la
    tabla `tattoos`.
  */
  const handleRetake = () => {
    setMindBuffer(null)
    setMetrics(null)
    setOverridden(false)
    setImageUrl(null)
    setInkLayer(null)
    setError('')
    setStep('upload')
  }

  /*
    Continuar pese al veredicto.

    Solo cuenta como "forzado" cuando el nivel era 'malo': ahí el usuario
    contradijo una advertencia explícita, y ese desacuerdo es el dato que
    permite calibrar los umbrales. En 'aceptable' continuar ES el camino
    recomendado, así que marcarlo ensuciaría la señal.
  */
  const handleContinueFromQuality = () => {
    setOverridden(metrics?.verdict?.level === 'malo')
    setStep('design')
  }

  const handleDesignSelected = async (design) => {
    setSelectedDesign(design)
    setStep('saving')
    setError('')

    try {
      // El .mind ya está compilado desde el paso de la foto — aquí solo se persiste
      setCompileStage('uploading')
      const { url: mindUrl } = await uploadMindFile(mindBuffer)

      setCompileStage('saving')
      /*
        Se asegura el perfil antes de guardar: las políticas de la base exigen
        que user_id coincida con la sesión, y el perfil es lo que sostiene el
        link compartible del usuario.
      */
      const perfil = await ensureProfile(user)

      const id = await createTattoo({
        imageUrl,
        mindUrl,
        glbUrl: design.glbUrl,
        userId: perfil.id,
        metrics,
        overridden,
      })

      setTattooId(id)
      setStep('done')
    } catch (err) {
      setError(err.message)
      // Volver a 'design' — la foto y el .mind ya existen, no hace falta rehacerlos
      setStep('design')
    }
  }

  /*
    Solo se pide sesión a quien ACTIVA. Quien escanea nunca pasa por aquí.

    Mientras se recupera la sesión del almacenamiento se muestra un intermedio:
    sin él, en cada arranque aparecería el login por un instante aunque el
    usuario ya estuviera dentro.
  */
  if (cargandoSesion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen px-6 py-8 pb-safe">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="text-gray-500 hover:text-white transition-colors">
            <BackArrow />
          </Link>
          <h1 className="text-2xl font-bold">{t('Activa tu tatuaje')}</h1>
        </div>
        <LoginGate />
        <CampoEstudio />
      </div>
    )
  }

  return (
    <div className="min-h-screen px-6 py-8 pb-safe">
      {/* Header con botón de regreso */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-gray-500 hover:text-white transition-colors">
          <BackArrow />
        </Link>
        <h1 className="text-2xl font-bold">{t('Activa tu tatuaje')}</h1>
      </div>

      {/* Indicador de pasos */}
      <StepIndicator current={step} />

      {estudioAcreditado && (
        <p className="text-xs text-gray-500 text-center -mt-4 mb-6">
          {t('Acreditaste a {estudio}', { estudio: estudioAcreditado })}
        </p>
      )}

      {step === 'upload' && (
        <PhotoUpload onPhotoSelected={handlePhotoSelected} />
      )}

      {step === 'uploading' && (
        <div className="text-center mt-12">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full
                          animate-spin mx-auto mb-4" />
          <p className="text-gray-400">{t('Subiendo foto...')}</p>
        </div>
      )}

      {step === 'quality' && (
        <div>
          <Miniatura
            imageUrl={imageUrl}
            titulo={t('Tu tatuaje, medido')}
            detalle={t('Así se va a comportar con la cámara')}
          />
          <QualityReport
            metrics={metrics}
            onRetake={handleRetake}
            onContinue={handleContinueFromQuality}
          />
        </div>
      )}

      {step === 'design' && (
        <div>
          <Miniatura
            imageUrl={imageUrl}
            titulo={t('Tatuaje listo')}
            detalle={t('Ahora elige tu diseño 3D')}
          />
          <DesignPicker onDesignSelected={handleDesignSelected} />
        </div>
      )}

      {(step === 'compiling' || step === 'saving') && (
        <CompileStatus
          stage={compileStage}
          progress={compileProgress}
          elapsedSeconds={elapsed}
          inkLayer={inkLayer}
        />
      )}

      {step === 'done' && (
        <div className="text-center mt-12">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center
                          mx-auto mb-4 border border-white/20">
            <span className="text-2xl">✓</span>
          </div>
          <h2 className="text-xl font-semibold mb-2">{t('Tu tatuaje está activado')}</h2>
          <p className="text-gray-400 mb-8 max-w-xs mx-auto">
            Cualquier persona puede apuntar su cámara a tu tatuaje y ver tu experiencia 3D.
          </p>

          {/* Link específico con el UUID del tatuaje — targetLoader lo resuelve en Supabase */}
          <Link
            to={`/scan?tattoo=${tattooId}`}
            className="inline-block bg-white text-black font-semibold py-3 px-6 rounded-full
                       hover:bg-gray-200 transition-colors mb-6"
          >
            {t('Probar ahora →')}
          </Link>

          {/* Mostrar el link para que el usuario lo guarde / comparta */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-w-xs mx-auto">
            <p className="text-gray-500 text-xs mb-2">{t('Tu link de escaneo:')}</p>
            <p className="text-gray-300 text-xs font-mono break-all">
              {ligaDeTatuaje(tattooId)}
            </p>
            <button
              onClick={() => navigator.clipboard?.writeText(ligaDeTatuaje(tattooId))}
              className="mt-3 text-xs text-gray-400 hover:text-white transition-colors underline"
            >
              {t('Copiar link')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}

/** Indicador visual de progreso — muestra en qué paso está el usuario */
function StepIndicator({ current }) {
  const steps = [
    { key: 'upload', label: t('Foto') },
    { key: 'design', label: t('Diseño') },
    { key: 'saving', label: t('Activar') },
  ]

  /*
    Mapear estados intermedios al índice del paso visual correspondiente.

    'compiling' y 'quality' se muestran como el paso de la FOTO, no como uno
    nuevo: para el usuario siguen siendo parte de "dame una foto que sirva", y
    el veredicto puede devolverlo justo ahí. Un cuarto círculo sugeriría un
    avance que un 'tomar otra foto' deshace.
  */
  const stepMap = {
    upload: 0, uploading: 0, compiling: 0, quality: 0,
    design: 1, saving: 2, done: 3,
  }
  const currentIdx = stepMap[current] ?? 0

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
            transition-colors duration-300
            ${i < currentIdx
              ? 'bg-white text-black'
              : i === currentIdx
                ? 'bg-white/20 text-white border border-white/40'
                : 'bg-white/5 text-gray-600'
            }
          `}>
            {i < currentIdx ? '\u2713' : i + 1}
          </div>
          <span className={`text-xs ${i <= currentIdx ? 'text-gray-300' : 'text-gray-600'}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${i < currentIdx ? 'bg-white/40' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Miniatura de la foto subida — confirmación visual de sobre qué se está
 * decidiendo. Aparece igual en el veredicto y en el selector para que el
 * usuario no pierda de vista cuál foto es, sobre todo si repitió alguna.
 */
function Miniatura({ imageUrl, titulo, detalle }) {
  if (!imageUrl) return null
  return (
    <div className="mb-6 flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10">
      <img src={imageUrl} alt={t('Tu tatuaje')} className="w-14 h-14 rounded-lg object-cover" />
      <div className="text-left">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-xs text-gray-500">{detalle}</p>
      </div>
    </div>
  )
}

/**
 * "¿Quién te tatuó?" — el código del estudio, opcional, antes de identificarse.
 *
 * Se guarda localmente y se aplica en cuanto haya sesión, porque aquí todavía
 * no la hay. Es opcional a propósito: un dedazo no puede bloquear el registro,
 * y quien llegó sin estudio no debe sentir que le falta algo.
 *
 * Se pide como acreditar al artista, no como cupón: en el tatuaje la gente
 * etiqueta a quien la tatuó sin que nadie se lo pida. Es identidad, no rebaja.
 */
function CampoEstudio() {
  const [codigo, setCodigo] = useState(() => leerCodigoPendiente() ?? '')

  const cambiar = (v) => {
    const limpio = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
    setCodigo(limpio)
    if (limpio) recordarCodigoPendiente(limpio)
  }

  return (
    <div className="max-w-sm mx-auto mt-8 text-center">
      <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2">
        {t('¿Quién te tatuó?')}
      </label>
      <input
        type="text"
        value={codigo}
        onChange={(e) => cambiar(e.target.value)}
        placeholder={t('Código del estudio (opcional)')}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="w-full py-3 px-4 rounded-2xl bg-white/5 border border-white/10 text-center
                   font-mono tracking-widest text-white placeholder-gray-600
                   focus:outline-none focus:border-white/40"
      />
      <p className="text-xs text-gray-600 mt-2">{t('Así tu artista recibe crédito por tu tatuaje.')}</p>
    </div>
  )
}

function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

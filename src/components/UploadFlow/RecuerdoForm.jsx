import { useRef, useState } from 'react'
import { t } from '../../lib/i18n.js'

const MAX_HISTORIA = 600

/**
 * La foto del recuerdo y la historia que lo anima.
 *
 * ── Esta foto NO es la del tatuaje ──
 * Es la de la mascota, la persona o el momento. Se pide aparte a propósito: el
 * video es del RECUERDO, no del dibujo. Por eso no pasa por el analizador de
 * calidad ni por la reducción de resolución: no se rastrea, solo se anima.
 *
 * ── Por qué la historia y no solo la foto ──
 * La foto dice quién; la historia dice qué pasa. "Mi perro" da un perro
 * parpadeando. "Siempre que compraba pan le llevaba una concha y se sentaba a
 * comer con nosotros" da el video que la persona lleva años queriendo ver.
 *
 * @param {(datos: {file: File, historia: string}) => void} onEnviar
 * @param {boolean} [enviando]
 */
export default function RecuerdoForm({ onEnviar, enviando = false }) {
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [historia, setHistoria] = useState('')

  const elegir = (f) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const listo = file && historia.trim().length >= 3 && !enviando

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (listo) onEnviar({ file, historia: historia.trim() }) }}
      className="grid gap-5"
    >
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">{t('La foto del recuerdo')}</p>
        {preview ? (
          <div className="relative">
            <img src={preview} alt="" className="w-full max-h-72 object-cover rounded-2xl border border-white/10" />
            <button
              type="button"
              onClick={() => { setFile(null); setPreview(null) }}
              className="absolute top-2 right-2 text-xs bg-black/60 text-white px-3 py-1 rounded-full"
            >
              {t('Cambiar')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="bg-white/5 border border-white/10 rounded-2xl py-6 text-sm
                         hover:bg-white/10 transition-colors"
            >
              {t('Tomar foto')}
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="bg-white/5 border border-white/10 rounded-2xl py-6 text-sm
                         hover:bg-white/10 transition-colors"
            >
              {t('Elegir de la galería')}
            </button>
          </div>
        )}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
               onChange={(e) => elegir(e.target.files?.[0])} />
        <input ref={galleryRef} type="file" accept="image/*" hidden
               onChange={(e) => elegir(e.target.files?.[0])} />
        <p className="text-xs text-gray-600 mt-2">
          {t('Una foto clara, de frente, donde se vea bien. No hace falta que sea del tatuaje.')}
        </p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">{t('Qué quieres que pase')}</p>
        <textarea
          value={historia}
          onChange={(e) => setHistoria(e.target.value.slice(0, MAX_HISTORIA))}
          rows={4}
          placeholder={t('Siempre que compraba pan le llevaba una concha y se sentaba a comer con nosotros.')}
          className="w-full py-3 px-4 rounded-2xl bg-white/5 border border-white/10 text-white
                     placeholder-gray-600 focus:outline-none focus:border-white/40 resize-none"
        />
        <p className="text-xs text-gray-600 mt-1 text-right tabular-nums">
          {historia.length}/{MAX_HISTORIA}
        </p>
      </div>

      <button
        type="submit"
        disabled={!listo}
        className="w-full bg-white text-black font-semibold py-3 rounded-full
                   hover:bg-gray-200 transition-colors active:scale-95 disabled:opacity-40"
      >
        {enviando ? t('Enviando...') : t('Generar mi video · 1 crédito')}
      </button>
    </form>
  )
}

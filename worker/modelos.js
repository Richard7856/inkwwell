#!/usr/bin/env node
/**
 * Qué modelos de video puede usar REALMENTE esta cuenta de Higgsfield.
 *
 * ── Por qué hace falta un script para esto ──
 * El catálogo documentado no es el que tu plan habilita. El 9 de septiembre de
 * 2026, con el spec en la mano, se configuró Seedance como modelo por defecto
 * y Veo 3.1 como respaldo: los DOS estaban documentados y NINGUNO funcionaba en
 * la cuenta (404 `model_not_found` y 503 `model_disabled`). Se descubrió al
 * intentar generar. Este script lo dice en veinte segundos.
 *
 * ── Por qué no cuesta nada ──
 * La API resuelve el modelo ANTES de validar el cuerpo. Con un cuerpo vacío:
 *   404 model_not_found → tu plan no lo incluye
 *   503 model_disabled  → existe pero está apagado
 *   400 / 422           → DISPONIBLE (lo único que falló fue el cuerpo)
 * Nunca llega a arrancar una generación, así que no se cobra.
 *
 * ── Lo que este barrido NO dice: si hay saldo ──
 * La validación del cuerpo ocurre ANTES que la revisión de créditos, así que
 * una cuenta sin saldo también responde 400 aquí. Comprobado el 9 sep 2026: el
 * barrido marcó MiniMax como disponible y el envío real devolvió
 * `403 not_enough_credits`. Una versión anterior de este archivo prometía
 * detectar "sin saldo" y era falso.
 *
 * ── Costo real por video, también gratis ──
 * `POST /estimate<ruta>` con un cuerpo válido devuelve créditos y USD sin
 * generar nada. No aparece en el openapi.json; está en la página de billing.
 * Este script lo consulta para cada modelo disponible.
 *
 * Uso:
 *   cd worker && node --env-file=.env modelos.js
 */

const BASE = 'https://api.higgsfield.ai'
const ID = process.env.HIGGSFIELD_KEY_ID
const SECRET = process.env.HIGGSFIELD_KEY_SECRET

if (!ID || !SECRET) {
  console.error('Faltan HIGGSFIELD_KEY_ID y HIGGSFIELD_KEY_SECRET.')
  console.error('Uso: node --env-file=.env modelos.js')
  process.exit(1)
}

// Solo imagen-a-video: es lo que usa el flujo del recuerdo (foto + historia).
const RUTAS = [
  '/minimax/hailuo-02/standard/image-to-video',
  '/minimax/hailuo-02/pro/image-to-video',
  '/minimax/hailuo-2.3-fast/standard/image-to-video',
  '/minimax/hailuo-2.3/standard/image-to-video',
  '/minimax/hailuo-2.3/pro/image-to-video',
  '/kling-video/v2.5-turbo/standard/image-to-video',
  '/kling-video/v2.5-turbo/pro/image-to-video',
  '/kling-video/v2.1/standard/image-to-video',
  '/kling-video/v2.1/pro/image-to-video',
  '/kling-video/v2.1/master/image-to-video',
  '/bytedance/seedance/v1/lite/image-to-video',
  '/bytedance/seedance/v1/pro/fast/image-to-video',
  '/veo3.1/image-to-video',
  '/veo3.1/fast/image-to-video',
  '/wan-25-preview/image-to-video',
  '/sora-2/image-to-video',
]

const VEREDICTO = {
  404: ['no disponible', false],
  503: ['deshabilitado', false],
  401: ['LLAVES INVÁLIDAS', false],
  400: ['DISPONIBLE', true],
  422: ['DISPONIBLE', true],
}

// Una foto pública cualquiera: /estimate valida la URL pero no la descarga
// para cobrar, así que no importa qué muestre
const FOTO = 'https://inkar.app/logo-inkar.png'

/*
  Cuerpo mínimo válido por familia, solo para poder estimar. Replica los tipos
  de PERFILES en higgsfield.js; si una familia cambia allá, cambia aquí.
*/
function cuerpoEstimacion(ruta) {
  const base = { prompt: 'estimate', image_url: FOTO }
  if (ruta.startsWith('/minimax/')) return { ...base, duration: 6, resolution: '768P', prompt_optimizer: false }
  if (ruta.startsWith('/kling-video/')) return { ...base, duration: 5, cfg_scale: 0.5, negative_prompt: '' }
  if (ruta.startsWith('/veo3.1')) return { ...base, duration: '6', resolution: '720', aspect_ratio: '9:16', generate_audio: false }
  if (ruta.startsWith('/bytedance/')) return { ...base, duration: 6, resolution: '720', aspect_ratio: '9:16' }
  return base
}

async function estimar(ruta) {
  try {
    const res = await fetch(`${BASE}/estimate${ruta}`, {
      method: 'POST',
      headers: { Authorization: `Key ${ID}:${SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpoEstimacion(ruta)),
    })
    if (!res.ok) return null
    const j = await res.json()
    return j?.usd ? `$${Number(j.usd).toFixed(2)} USD · ${j.credits} cr` : null
  } catch {
    return null
  }
}

const disponibles = []

for (const ruta of RUTAS) {
  let etiqueta
  try {
    const res = await fetch(`${BASE}${ruta}`, {
      method: 'POST',
      headers: { Authorization: `Key ${ID}:${SECRET}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    const [texto, ok] = VEREDICTO[res.status] ?? [`? HTTP ${res.status}`, false]
    etiqueta = texto
    if (ok) {
      disponibles.push(ruta)
      const costo = await estimar(ruta)
      if (costo) etiqueta = `${texto}  ${costo}`
    }
  } catch (err) {
    etiqueta = `error de red: ${err.message}`
  }
  console.log(`  ${etiqueta.startsWith('DISPONIBLE') ? '✓' : '·'} ${ruta.padEnd(50)} ${etiqueta}`)
  // Un respiro entre peticiones: hay límites de tasa y este barrido no urge
  await new Promise((r) => setTimeout(r, 400))
}

console.log()
if (disponibles.length === 0) {
  console.log('Ningún modelo disponible. Revisa las llaves y el plan en higgsfield.ai.')
  process.exit(1)
}
console.log(`Disponibles: ${disponibles.length}. Para usar uno, en Railway → Variables:`)
console.log(`  HIGGSFIELD_ENDPOINT=${disponibles[0]}`)
console.log('\nOJO: que esté disponible no significa que haya saldo — eso solo lo dice un envío')
console.log('real (403 not_enough_credits). Y que tenga perfil de cuerpo en higgsfield.js es')
console.log('aparte: cada familia usa tipos distintos.')

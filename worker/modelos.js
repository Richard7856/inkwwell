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
 *   403 not_enough_credits → disponible, pero la cuenta no tiene saldo
 * Nunca llega a arrancar una generación, así que no se cobra.
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
  403: ['disponible, SIN SALDO', true],
  400: ['DISPONIBLE', true],
  422: ['DISPONIBLE', true],
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
    if (ok) disponibles.push(ruta)
  } catch (err) {
    etiqueta = `error de red: ${err.message}`
  }
  console.log(`  ${etiqueta === 'DISPONIBLE' ? '✓' : '·'} ${ruta.padEnd(50)} ${etiqueta}`)
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
console.log('\nOJO: que esté disponible no significa que higgsfield.js tenga su perfil de')
console.log('cuerpo. Los perfiles viven en PERFILES; cada familia usa tipos distintos.')

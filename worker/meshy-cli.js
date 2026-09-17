#!/usr/bin/env node
/**
 * Fotos de una mascota → modelo 3D GLB, por el API de Meshy.
 *
 * ── Por qué existe y no se hace en la web de Meshy ──
 * El objetivo no es sacar un modelo, es saber si esto se puede AUTOMATIZAR:
 * que un cliente suba fotos y le salga su modelo sin que nadie toque un panel.
 * Hacerlo a mano en su web contesta "¿se ve bien?" pero no contesta "¿se puede
 * construir?". Este archivo es el borrador de lo que después vive en el worker.
 *
 * ── Por qué las fotos van en base64 y no hospedadas ──
 * El API acepta `data:image/jpeg;base64,…` además de URLs públicas. Eso evita
 * montar un bucket público solo para que Meshy pueda leer la foto de la mascota
 * de alguien — una foto que, además, no tiene por qué ser pública nunca.
 *
 * ── Por qué NO rigea por omisión ──
 * El esqueleto que monta Meshy es humanoide: su propia documentación dice que
 * "non-bipeds (animals, objects) may rig poorly", y las 678 animaciones de su
 * biblioteca son de bípedo (sus vistas previas cuelgan de /preview/biped/).
 * Un perro rigeado como persona sale deforme, y sería una lástima descartar una
 * malla buena por un rig malo. Primero la malla; el rig se pide aparte.
 *
 * Uso:
 *   cd worker
 *   node --env-file=.env meshy-cli.js frente.jpg izq.jpg der.jpg atras.jpg
 *   node --env-file=.env meshy-cli.js *.jpg --salida zero.glb --poligonos 24000
 *
 * Necesita MESHY_API_KEY en el entorno. Nada más: no toca Supabase ni Higgsfield.
 */

import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { extname, basename } from 'node:path'
import * as meshy from './meshy.js'

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
}

const args = process.argv.slice(2)
const bandera = (n) => args.includes(n)
const valor = (n, pordef) => {
  const i = args.indexOf(n)
  return i >= 0 && args[i + 1] ? args[i + 1] : pordef
}
const fotos = args.filter((a) => /\.(jpe?g|png|webp)$/i.test(a))

const SALIDA = valor('--salida', 'modelo.glb')
const POLIGONOS = Number(valor('--poligonos', meshy.POLIGONOS_POR_OMISION))
const RIG = bandera('--rig')

/*
  Presupuesto de tamaño, medido contra lo que ya carga la app.

  Los modelos que trae el repo pesan entre 0.6 y 1.8 MB. El AR los baja por red
  antes de poder mostrar nada, así que un GLB de 10 MB no es "más bonito": es
  varios segundos de pantalla vacía sobre datos móviles, justo en el momento en
  que el usuario está decidiendo si esto funciona.
*/
const LIMITE_MB = 4

function ayuda(msg) {
  console.error(`${C.red}${msg}${C.reset}`)
  console.error('\nUso: node --env-file=.env meshy-cli.js frente.jpg izq.jpg der.jpg atras.jpg')
  console.error('     --salida <archivo.glb>   nombre del archivo (por omisión modelo.glb)')
  console.error('     --poligonos <n>          objetivo de triángulos (por omisión 24000)')
  console.error('     --rig                    además rigea. OJO: el esqueleto es humanoide')
  process.exit(1)
}

if (!meshy.meshyConfigurado) ayuda('Falta MESHY_API_KEY en el entorno.')
if (fotos.length === 0) ayuda('No se indicó ninguna foto.')
if (fotos.length > 4) ayuda(`Meshy acepta hasta 4 imágenes; se pasaron ${fotos.length}.`)

console.log(`\n${C.bold}Fotos → 3D · Meshy${C.reset}`)
console.log(`${C.dim}No toca Supabase ni Higgsfield. Solo necesita MESHY_API_KEY.${C.reset}\n`)

/** Lee una foto y la vuelve data URI, que es lo que el API acepta sin hospedar. */
function aDataUri(ruta) {
  const ext = extname(ruta).toLowerCase()
  const tipo = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  const bytes = readFileSync(ruta)
  return { uri: `data:${tipo};base64,${bytes.toString('base64')}`, mb: bytes.length / 1024 / 1024 }
}

const imagenes = []
let pesoTotal = 0
for (const f of fotos) {
  const { uri, mb } = aDataUri(f)
  imagenes.push(uri)
  pesoTotal += mb
  const peso = mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(mb * 1024)} KB`
  console.log(`  ${C.cyan}✓${C.reset} ${basename(f).padEnd(28)} ${peso}`)
}
console.log(`\n  imágenes: ${imagenes.length}   ·   objetivo: ${POLIGONOS} triángulos   ·   rig: ${RIG ? `${C.yellow}sí (humanoide)${C.reset}` : 'no'}`)
if (pesoTotal > 15) {
  console.log(`  ${C.yellow}aviso:${C.reset} ${pesoTotal.toFixed(1)} MB de fotos; en base64 el envío ronda ${(pesoTotal * 1.33).toFixed(0)} MB`)
}

console.log(`\n${C.bold}Enviando…${C.reset}`)

let tarea, ruta
try {
  ;({ tarea, ruta } = await meshy.crear({ imagenes, poligonos: POLIGONOS, rig: RIG }))
} catch (err) {
  console.error(`\n${C.red}${err.message}${C.reset}`)
  if (err.codigo === 'sin_creditos') {
    console.error(`${C.dim}Revisa en tu panel que los créditos del API sean los mismos de la`)
    console.error(`suscripción web: su documentación no lo aclara, y este proyecto ya se`)
    console.error(`quemó dos veces con esa confusión en Higgsfield.${C.reset}`)
  }
  process.exit(1)
}
console.log(`  ${C.green}aceptada${C.reset}  tarea ${tarea}`)

console.log(`\n${C.bold}Esperando…${C.reset}`)
const inicio = Date.now()
let ultimo = -1
let final = null

while (Date.now() - inicio < 20 * 60 * 1000) {
  await new Promise((r) => setTimeout(r, 5000))
  let e
  try {
    e = await meshy.estado(tarea, ruta)
  } catch (err) {
    // Un tropiezo de red no cancela la espera: la tarea sigue viva del otro lado
    console.warn(`  ${C.dim}sondeo falló, se reintenta: ${err.message}${C.reset}`)
    continue
  }
  if (e.avance !== ultimo) {
    ultimo = e.avance
    const barra = '█'.repeat(Math.round(ultimo / 4)).padEnd(25, '·')
    process.stdout.write(`\r  ${barra} ${String(ultimo).padStart(3)}%  ${e.estado}   `)
  }
  if (['SUCCEEDED', 'FAILED', 'CANCELED'].includes(e.estado)) { final = e; break }
}
console.log()

if (!final) {
  console.error(`\n${C.red}Sin respuesta terminal en 20 minutos.${C.reset} La tarea ${tarea} puede seguir viva.`)
  process.exit(1)
}
if (final.estado !== 'SUCCEEDED') {
  console.error(`\n${C.red}Terminó en ${final.estado}:${C.reset} ${final.error ?? '(sin detalle)'}`)
  process.exit(1)
}

const urlGlb = final.glb
if (!urlGlb) {
  console.error(`\n${C.red}Terminó bien pero no vino GLB.${C.reset}`)
  process.exit(1)
}

const descarga = await fetch(urlGlb)
if (!descarga.ok) {
  console.error(`\n${C.red}No se pudo descargar el GLB (${descarga.status}).${C.reset}`)
  process.exit(1)
}
writeFileSync(SALIDA, Buffer.from(await descarga.arrayBuffer()))

const mb = statSync(SALIDA).size / 1024 / 1024
const segundos = ((Date.now() - inicio) / 1000).toFixed(0)

console.log(`\n${C.green}${C.bold}Listo en ${segundos}s${C.reset}`)
console.log(`  archivo   ${SALIDA}  ${mb.toFixed(2)} MB`)
if (final.miniatura) console.log(`  vista     ${final.miniatura}`)

if (mb > LIMITE_MB) {
  console.log(`\n${C.yellow}Pesa más de ${LIMITE_MB} MB.${C.reset} Los modelos que ya carga la app van de 0.6 a 1.8 MB.`)
  console.log(`${C.dim}El AR lo baja antes de mostrar nada, así que esto son segundos de pantalla`)
  console.log(`vacía sobre datos móviles. Vuelve a correr con --poligonos ${Math.round(POLIGONOS / 2)}.${C.reset}`)
} else {
  console.log(`\n${C.dim}Dentro del presupuesto de la app (0.6-1.8 MB es lo que ya carga).${C.reset}`)
}
console.log(`\n${C.dim}Siguiente paso: mándame el .glb y lo conecto como demo para probarlo en el brazo.${C.reset}\n`)

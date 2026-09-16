#!/usr/bin/env node
/**
 * Ejercita el camino de Higgsfield de punta a punta, sin Supabase y sin app.
 *
 * ── Por qué existe ──
 * La generación de video está construida desde el 9 de septiembre y **nunca se
 * ha ejecutado**: cero generaciones en la base. Todo lo que hay entre `enviar`
 * y el video descargado —el perfil del cuerpo, el sondeo, el estado terminal,
 * la URL del resultado— está escrito contra el `openapi.json`, no contra una
 * ejecución. Este script lo corre aislado: si algo está mal, aquí se ve sin
 * gastar un crédito de usuario, sin tocar la base y sin compilar un APK.
 *
 * ── Qué prueba que `modelos.js` no puede ──
 * `modelos.js` dice qué modelos existen y cuánto cuestan, pero **no si hay
 * saldo**: la API valida el cuerpo antes de revisar créditos, así que una
 * cuenta vacía también sale "disponible". Solo un envío real lo confirma. Este
 * script hace ese envío — y de paso verifica que el interruptor de degradación
 * reacciona como debe.
 *
 * ── Por qué por omisión no gasta ──
 * Un video cuesta dinero de verdad (~$0.28 con el modelo configurado). El modo
 * por omisión comprueba llaves, modelo, costo estimado y estado del interruptor
 * sin enviar nada. Gastar exige escribirlo: `--generar`.
 *
 * Uso:
 *   cd worker
 *   node --env-file=.env generar-cli.js              # no gasta: revisa y estima
 *   node --env-file=.env generar-cli.js --generar    # ENVÍA UNO DE VERDAD (~$0.28)
 *   node --env-file=.env generar-cli.js --generar --foto https://... --historia "..."
 *
 * Solo necesita HIGGSFIELD_KEY_ID y HIGGSFIELD_KEY_SECRET. No toca Supabase, no
 * reserva créditos y no escribe en ninguna tabla.
 */

import { writeFileSync } from 'node:fs'
import * as hf from './higgsfield.js'
import { supabaseConfigurado } from './supabase-admin.js'
import { estadoGeneracion, registrarFalloDeCuenta, registrarEnvioAceptado } from './disponibilidad.js'

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
}

const args = process.argv.slice(2)
const quiere = (bandera) => args.includes(bandera)
const valor = (bandera, porOmision) => {
  const i = args.indexOf(bandera)
  return i >= 0 && args[i + 1] ? args[i + 1] : porOmision
}

// Una foto pública y estable del propio sitio: no depende de Storage ni de una
// sesión, y sirve igual para probar que la API la acepta y la descarga.
const FOTO = valor('--foto', 'https://inkar.app/logo-inkar.png')
const HISTORIA = valor('--historia', 'slow gentle zoom, soft light')

/* El mismo prompt que arma el worker — si cambia allá, cambia aquí. */
function promptDe(historia) {
  return (
    'Plain flat solid bright green screen background, uniform color, no other ' +
    'background elements, no text. Subject centered, natural gentle motion. ' +
    historia.trim()
  )
}

function linea(etiqueta, valorTexto, color = C.reset) {
  console.log(`  ${etiqueta.padEnd(26)} ${color}${valorTexto}${C.reset}`)
}

/*
  El interruptor de esta corrida es una copia en memoria del proceso: sirve para
  ver cómo reacciona, pero NO toca el worker de Railway. Allá el estado lo
  cambian los envíos reales de los usuarios.

  Y ojo con `no_configurado`: `estadoGeneracion()` también exige Supabase, que
  este script no necesita. Se aclara cuál mitad falta para no salir de aquí
  creyendo que el problema es Higgsfield.
*/
function mostrarInterruptor(momento) {
  const e = estadoGeneracion()
  const color = e.disponible ? C.green : C.red
  const extra = e.reintentaEn ? ` · reintenta en ${e.reintentaEn}s` : ''
  let nota = ''
  if (e.motivo === 'no_configurado') {
    nota = supabaseConfigurado
      ? ' (faltan las llaves de Higgsfield)'
      : ' (falta Supabase en ESTE proceso; Higgsfield sí está)'
  }
  linea(
    `interruptor (${momento})`,
    `${e.disponible ? 'ofrece' : 'APAGADO'} · ${e.motivo}${extra}${nota}`,
    color,
  )
}

console.log(`\n${C.bold}Prueba de generación — Higgsfield${C.reset}`)
console.log(`${C.dim}Aislado: no toca Supabase, no reserva créditos, no escribe en la base.`)
console.log(`El interruptor que se muestra es el de ESTE proceso, no el de Railway.${C.reset}\n`)

if (!hf.higgsfieldConfigurado) {
  console.error(`${C.red}Faltan HIGGSFIELD_KEY_ID y HIGGSFIELD_KEY_SECRET.${C.reset}`)
  console.error('Uso: node --env-file=.env generar-cli.js')
  process.exit(1)
}

linea('modelo', hf.ENDPOINT, C.cyan)
linea('foto', FOTO)
linea('historia', HISTORIA)
mostrarInterruptor('inicio')

/*
  El costo real, sin generar. `/estimate` no aparece en el openapi.json; está en
  la página de billing. Que responda confirma además que las llaves sirven.
*/
const cuerpoEstimacion = {
  prompt: promptDe(HISTORIA),
  image_url: FOTO,
  duration: 6,
  resolution: '768P',
  prompt_optimizer: false,
}

try {
  const res = await fetch(`https://api.higgsfield.ai/estimate${hf.ENDPOINT}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${process.env.HIGGSFIELD_KEY_ID}:${process.env.HIGGSFIELD_KEY_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cuerpoEstimacion),
  })
  const j = await res.json().catch(() => null)
  if (res.ok && j?.usd) {
    linea('costo estimado', `$${Number(j.usd).toFixed(2)} USD · ${j.credits} créditos`, C.yellow)
  } else {
    linea('costo estimado', `no se pudo estimar (HTTP ${res.status} ${j?.detail ?? ''})`, C.dim)
  }
} catch (err) {
  linea('costo estimado', `error de red: ${err.message}`, C.dim)
}

if (!quiere('--generar')) {
  console.log(`\n${C.dim}Nada se envió. El estimado NO confirma que haya saldo: la API valida`)
  console.log(`el cuerpo antes de revisar créditos. Para confirmarlo hace falta un envío`)
  console.log(`real — vuelve a correr con ${C.reset}${C.bold}--generar${C.reset}${C.dim} (cuesta dinero).${C.reset}\n`)
  process.exit(0)
}

console.log(`\n${C.bold}Enviando de verdad…${C.reset}`)

let requestId
try {
  ;({ requestId } = await hf.enviar({ prompt: promptDe(HISTORIA), imageUrl: FOTO }))
  registrarEnvioAceptado()
  linea('aceptada', requestId, C.green)
  mostrarInterruptor('tras aceptar')
} catch (err) {
  /*
    Este es el punto que importa: es el ÚNICO lugar donde se entera uno de que
    la cuenta no tiene saldo. Se replica aquí la clasificación del worker para
    comprobar que el interruptor se apaga con el motivo correcto.
  */
  if (err.esDeCuenta) {
    registrarFalloDeCuenta(err.detalle)
    console.error(`\n${C.red}Es problema de la CUENTA, no de la petición:${C.reset} ${err.message}`)
    console.error(`${C.dim}detalle crudo: ${err.detalle}${C.reset}`)
    mostrarInterruptor('tras el fallo')
    console.error(`\n${C.dim}En producción esto apaga "Anima tu recuerdo" 15 minutos y el`)
    console.error(`usuario recupera su crédito automáticamente.${C.reset}\n`)
  } else {
    console.error(`\n${C.red}Higgsfield rechazó la petición:${C.reset} ${err.message}`)
    console.error(`${C.dim}No es de cuenta: revisa el perfil del cuerpo en higgsfield.js`)
    console.error(`para ${hf.ENDPOINT}, o la URL de la foto.${C.reset}\n`)
  }
  process.exit(1)
}

console.log(`\n${C.bold}Esperando…${C.reset} ${C.dim}(minutos; se informa cada cambio de estado)${C.reset}`)
const inicio = Date.now()
const r = await hf.esperar(requestId, {
  onEstado: (s) => console.log(`  ${C.dim}${new Date().toISOString().slice(11, 19)}${C.reset}  ${s}`),
})
const segundos = ((Date.now() - inicio) / 1000).toFixed(0)

console.log()
linea('estado final', r.status, r.status === 'completed' ? C.green : C.red)
linea('tardó', `${segundos}s`)

if (r.status !== 'completed' || !r.videoUrl) {
  console.error(`\n${C.red}No llegó video.${C.reset} ${r.error ?? ''}`)
  console.error(`${C.dim}En producción el crédito se reembolsa y la generación queda como`)
  console.error(`${r.status === 'nsfw' ? "'rechazada'" : "'fallida'"}.${C.reset}\n`)
  process.exit(1)
}

/*
  Descargar de verdad y no solo confirmar la URL: los enlaces de Higgsfield
  caducan a los 7 días y el worker los copia a nuestro Storage. Si la descarga
  falla, el usuario pagaría por un video que nunca llega.
*/
const descarga = await fetch(r.videoUrl)
if (!descarga.ok) {
  console.error(`\n${C.red}El video existe pero no se pudo descargar (${descarga.status}).${C.reset}\n`)
  process.exit(1)
}
const buffer = Buffer.from(await descarga.arrayBuffer())
const destino = valor('--salida', '/tmp/inkar-prueba.mp4')
writeFileSync(destino, buffer)

linea('video', `${(buffer.byteLength / 1024).toFixed(0)} KB → ${destino}`, C.green)
mostrarInterruptor('final')

console.log(`\n${C.green}${C.bold}El camino completo funciona.${C.reset}`)
console.log(`${C.dim}Revisa el archivo: el fondo debe salir verde y plano (la capa de video`)
console.log(`mide el color real y recorta con ese). Si salió con paisaje o texto, el`)
console.log(`problema es el prompt, no el código.${C.reset}\n`)

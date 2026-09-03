#!/usr/bin/env node
/**
 * CLI para analizar calidad de tracking de fotos de tatuajes.
 *
 * Para qué sirve:
 * Correr un lote de fotos y ver cuáles van a trackear bien ANTES de meterlas
 * al producto. Es el banco de pruebas para calibrar los umbrales del analyzer
 * contra comportamiento real en cámara.
 *
 * Uso:
 *   node analyze-cli.js foto.jpg                 # una foto
 *   node analyze-cli.js ./fotos/                 # todas las de una carpeta
 *   node analyze-cli.js ./fotos/ --json out.json # además guarda JSON crudo
 *
 * Nota: cada imagen tarda 10-30s en compilar. Un lote de 20 puede tomar 10 min.
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs'
import { join, extname, basename } from 'path'
import { analyzeTattooImage } from './analyzer.js'

const VALID_EXT = ['.jpg', '.jpeg', '.png', '.webp']

// Colores ANSI — el veredicto se lee de un vistazo en una tabla larga
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
}

const VERDICT_COLOR = {
  excelente: C.green,
  bueno: C.green,
  aceptable: C.yellow,
  malo: C.red,
}

function collectImages(target) {
  const stat = statSync(target)
  if (stat.isFile()) return [target]

  return readdirSync(target)
    .filter((f) => VALID_EXT.includes(extname(f).toLowerCase()))
    .map((f) => join(target, f))
    .sort()
}

function printReport(file, m) {
  const v = m.verdict
  const color = VERDICT_COLOR[v.level] ?? C.reset

  console.log(`\n${C.bold}${basename(file)}${C.reset}`)
  console.log(`  ${m.image.width}×${m.image.height}px`)
  console.log(`  ${color}${C.bold}${v.level.toUpperCase()}${C.reset}`)
  console.log(
    `  ${C.dim}detección${C.reset} ${m.detection.totalPoints} pts ` +
    `(${m.detection.usableScaleLevels}/${m.detection.scaleLevels} escalas útiles)  ` +
    `${C.dim}tracking${C.reset} ${m.tracking.totalPoints}/${m.tracking.maxPossible} ` +
    `(${Math.round(m.tracking.fillRatio * 100)}%)  ` +
    `${C.dim}zonas${C.reset} ${m.distribution.occupiedCells}/9`
  )

  if (v.reasons.length > 0) {
    console.log(`  ${C.yellow}Problemas:${C.reset}`)
    v.reasons.forEach((r) => console.log(`    • ${r}`))
  }
  if (v.tips.length > 0) {
    console.log(`  ${C.cyan}Cómo mejorar:${C.reset}`)
    v.tips.forEach((t) => console.log(`    → ${t}`))
  }
}

function printTable(results) {
  console.log(`\n${C.bold}${'─'.repeat(78)}${C.reset}`)
  console.log(`${C.bold}RESUMEN${C.reset}\n`)

  const pad = (s, n) => String(s).padEnd(n)
  const padL = (s, n) => String(s).padStart(n)

  console.log(
    `${C.dim}${pad('ARCHIVO', 26)}${padL('DETECC', 8)}${padL('TRACK', 10)}` +
    `${padL('ZONAS', 7)}${padL('CONCEN', 8)}  VEREDICTO${C.reset}`
  )
  console.log(C.dim + '─'.repeat(78) + C.reset)

  for (const { file, metrics: m } of results) {
    const v = m.verdict
    const color = VERDICT_COLOR[v.level] ?? C.reset
    const name = basename(file)
    console.log(
      pad(name.length > 25 ? name.slice(0, 22) + '...' : name, 26) +
      padL(m.detection.totalPoints, 8) +
      padL(`${Math.round(m.tracking.fillRatio * 100)}%`, 10) +
      padL(`${m.distribution.occupiedCells}/9`, 7) +
      padL(`${Math.round(m.distribution.maxCellShare * 100)}%`, 8) +
      `  ${color}${v.level}${C.reset}`
    )
  }

  // Conteo por nivel — señal rápida de si el lote de fotos es usable
  const counts = results.reduce((acc, r) => {
    acc[r.metrics.verdict.level] = (acc[r.metrics.verdict.level] ?? 0) + 1
    return acc
  }, {})
  console.log(C.dim + '─'.repeat(78) + C.reset)
  console.log(
    `${results.length} imágenes · ` +
    Object.entries(counts).map(([k, n]) => `${VERDICT_COLOR[k]}${k}: ${n}${C.reset}`).join('  ')
  )
  console.log(`\n${C.dim}DETECC = puntos para reconocer el tatuaje desde cero`)
  console.log(`TRACK  = % del máximo posible de puntos de seguimiento (predice estabilidad)`)
  console.log(`ZONAS  = celdas ocupadas de una grilla 3x3 (repartición espacial)`)
  console.log(`CONCEN = % de puntos en la zona más densa (>50% es problema)${C.reset}`)
}

async function main() {
  const args = process.argv.slice(2)
  const target = args[0]

  if (!target) {
    console.log('Uso: node analyze-cli.js <archivo|carpeta> [--json salida.json]')
    process.exit(1)
  }

  const jsonIdx = args.indexOf('--json')
  const jsonOut = jsonIdx !== -1 ? args[jsonIdx + 1] : null

  const files = collectImages(target)
  if (files.length === 0) {
    console.log('No se encontraron imágenes (.jpg/.jpeg/.png/.webp)')
    process.exit(1)
  }

  console.log(`\nAnalizando ${files.length} imagen(es)...`)
  console.log(`${C.dim}Cada una tarda 10-30s — la compilación es intensiva en CPU${C.reset}`)

  const results = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    process.stdout.write(`\r${C.dim}[${i + 1}/${files.length}] ${basename(file)}...${C.reset}          `)

    try {
      const buffer = readFileSync(file)
      const { metrics } = await analyzeTattooImage(buffer)
      results.push({ file, metrics })
      process.stdout.write('\r' + ' '.repeat(70) + '\r')
      printReport(file, metrics)
    } catch (err) {
      process.stdout.write('\r' + ' '.repeat(70) + '\r')
      console.log(`\n${C.red}✗ ${basename(file)}: ${err.message}${C.reset}`)
    }
  }

  if (results.length > 1) printTable(results)

  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify(results, null, 2))
    console.log(`\n${C.dim}JSON guardado en ${jsonOut}${C.reset}`)
  }
  console.log()
}

main().catch((err) => {
  console.error('Error fatal:', err)
  process.exit(1)
})

/**
 * Worker de compilación .mind para Inkwell AR.
 *
 * Responsabilidad única: recibir la foto de un tatuaje (multipart/form-data),
 * compilarla en un image target MindAR (.mind), y devolver el binario.
 *
 * El frontend maneja el storage (Supabase) y la persistencia del registro.
 * Este servicio no sabe nada de Supabase — solo compila.
 *
 * Endpoints:
 *   GET  /health   → health check para Railway y ngrok
 *   POST /compile  → recibe 'image' file, devuelve .mind binario
 */

import express from 'express'
import multer from 'multer'
import cors from 'cors'
import { compileTattooImage } from './compiler.js'
import { analyzeTattooImage } from './analyzer.js'

const app = express()

// CORS abierto — el frontend viene de un origen diferente (Vite :5173 o Vercel)
// En producción Railway se puede restringir al dominio de Inkwell AR
app.use(cors())

// multer con memory storage — la imagen nunca toca disco, vive en RAM durante compilación
// Límite 10MB: fotos de tatuaje no deberían pesar más, y compilar imágenes grandes es más lento
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_, file, cb) => {
    // Solo JPG y PNG — otros formatos pueden fallar en el canvas loader
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Formato no soportado: ${file.mimetype}. Usar JPG, PNG o WebP.`))
    }
  },
})

// Health check — usado por Railway y para verificar que ngrok está activo
app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'inkwell-ar-worker', timestamp: new Date().toISOString() })
})

// POST /compile — endpoint principal
// Acepta: multipart/form-data con campo 'image' (el File del tatuaje)
// Devuelve: application/octet-stream — el .mind binario listo para subir a Supabase
app.post('/compile', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'Se requiere campo "image" con el archivo de la foto del tatuaje',
    })
  }

  console.log(`\n[compile] Imagen recibida: ${req.file.originalname} (${(req.file.size / 1024).toFixed(0)}KB)`)
  const startTime = Date.now()

  try {
    const mindBuffer = await compileTattooImage(req.file.buffer)

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[compile] ✓ Completado en ${elapsed}s — .mind size: ${(mindBuffer.byteLength / 1024).toFixed(0)}KB`)

    // Devolver el .mind como binario puro — el frontend lo sube a Supabase Storage
    res.set('Content-Type', 'application/octet-stream')
    res.set('X-Compile-Time-Seconds', elapsed)
    res.send(Buffer.from(mindBuffer))
  } catch (err) {
    console.error('[compile] Error:', err.message)
    res.status(500).json({
      error: `Compilación fallida: ${err.message}`,
      hint: 'Verificar que la imagen tiene suficiente detalle y contraste (mínimo 800x800px)',
    })
  }
})

/*
  POST /analyze — mide si un tatuaje va a trackear bien ANTES de activarlo.

  Por qué existe separado de /compile:
  MindAR no se entrena. Si la foto no tiene suficientes puntos de interés únicos,
  ningún parámetro de runtime lo salva. Medir antes evita que el usuario active
  un tatuaje que nunca va a funcionar y culpe al producto.

  Acepta: multipart/form-data con campo 'image'
  Devuelve: JSON con métricas + veredicto + tips accionables

  Nota: internamente compila igual que /compile (10-30s). El .mind resultante
  se descarta aquí — cuando el frontend implemente "analizar y luego activar",
  conviene devolverlo en base64 o cachearlo para no compilar dos veces.
*/
app.post('/analyze', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'Se requiere campo "image" con el archivo de la foto del tatuaje',
    })
  }

  console.log(`\n[analyze] Imagen recibida: ${req.file.originalname} (${(req.file.size / 1024).toFixed(0)}KB)`)
  const startTime = Date.now()

  try {
    const { metrics } = await analyzeTattooImage(req.file.buffer)

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const v = metrics.verdict
    console.log(
      `[analyze] ✓ ${elapsed}s — veredicto: ${v.level.toUpperCase()} ` +
      `(detección: ${metrics.detection.totalPoints} pts, ` +
      `tracking: ${metrics.tracking.totalPoints} pts, ` +
      `zonas: ${metrics.distribution.occupiedCells}/9)`
    )

    res.json({ ...metrics, analyzeTimeSeconds: Number(elapsed) })
  } catch (err) {
    console.error('[analyze] Error:', err.message)
    res.status(500).json({
      error: `Análisis fallido: ${err.message}`,
      hint: 'Verificar que la imagen es válida y tiene resolución suficiente (mínimo 800x800px)',
    })
  }
})

// Manejador de errores de multer (archivo muy grande, formato inválido)
app.use((err, req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Imagen muy grande. Máximo 10MB.' })
  }
  res.status(400).json({ error: err.message })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`\n🖋️  Inkwell AR Worker corriendo en http://localhost:${PORT}`)
  console.log(`   Health check: http://localhost:${PORT}/health`)
  console.log(`   Compile:      POST http://localhost:${PORT}/compile`)
  console.log(`   Analyze:      POST http://localhost:${PORT}/analyze\n`)
})

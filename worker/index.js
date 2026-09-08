/**
 * Worker de compilación .mind para InkAR.
 *
 * Responsabilidad única: recibir la foto de un tatuaje (multipart/form-data),
 * compilarla en un image target MindAR (.mind), y devolver el binario.
 *
 * El frontend maneja el storage (Supabase) y la persistencia del registro.
 * Este servicio no sabe nada de Supabase — solo compila.
 *
 * Endpoints:
 *   GET  /health         → health check para Railway y ngrok
 *   POST /compile        → recibe 'image' file, devuelve .mind binario
 *   POST /compile-stream → compila + mide calidad, con progreso por SSE (el que usa la app)
 *   POST /analyze        → solo métricas de calidad, para el banco de pruebas por CLI
 */

import express from 'express'
import multer from 'multer'
import cors from 'cors'
import { compileTattooImage } from './compiler.js'
import { analyzeTattooImage } from './analyzer.js'

const app = express()

// CORS abierto — el frontend viene de un origen diferente (Vite :5173 o Vercel)
// En producción Railway se puede restringir al dominio de InkAR
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
  res.json({ status: 'ok', service: 'inkar-worker', timestamp: new Date().toISOString() })
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

  Nota: internamente compila igual que /compile (10-30s) y descarta el .mind.
  La APP no usa este endpoint — usa /compile-stream, que devuelve métricas y
  binario de una sola pasada. Este queda para analyze-cli.js, donde solo
  interesan los números.
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


/*
  POST /compile-stream — compila, MIDE la calidad y transmite el progreso.

  Por qué existe aparte y no reemplaza a /compile:
  compilar toma decenas de segundos y sin feedback el usuario asume que la app
  se colgó. MindAR reporta avance real por callback; este endpoint lo retransmite
  como Server-Sent Events.

  Se deja /compile intacto para que un cliente viejo (o un APK ya instalado)
  siga funcionando, y para que el cliente nuevo pueda caer a él si el streaming
  falla por un proxy intermedio que no soporte respuestas incrementales.

  POR QUÉ MIDE AQUÍ Y NO EN /analyze:
  analyzeTattooImage() devuelve las métricas Y el .mind de una sola compilación
  —medir es contar arrays que la compilación ya produjo, no una segunda pasada—.
  Encadenar /analyze y luego /compile costaría al usuario ~11 segundos extra
  para llegar al mismo binario. /analyze se conserva para el banco de pruebas
  por CLI, donde el .mind sobra.

  Formato de los eventos:
    {"type":"progress","value":0-100}
    {"type":"done","mind":"<base64>","seconds":N,"metrics":{...}}
    {"type":"error","message":"..."}

  `metrics` es aditivo: un cliente viejo que solo lee `mind` sigue funcionando.

  El .mind viaja en base64 (infla ~33%) porque SSE es un canal de texto. Para un
  archivo de ~500KB el sobrecosto es aceptable a cambio de tener progreso real.
*/
app.post('/compile-stream', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'Se requiere campo "image" con el archivo de la foto del tatuaje',
    })
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    // Desactiva el buffering de proxies intermedios; sin esto los eventos
    // llegarían todos juntos al final y el progreso no serviría de nada
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders?.()

  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`)

  console.log(`\n[compile-stream] ${req.file.originalname} (${(req.file.size / 1024).toFixed(0)}KB)`)
  const startTime = Date.now()

  try {
    let lastSent = -1
    const { metrics, mindBuffer } = await analyzeTattooImage(req.file.buffer, (progress) => {
      // Emitir solo en cambios de punto porcentual entero: MindAR llama al
      // callback muy seguido y mandar cada fracción satura la conexión
      const whole = Math.floor(progress)
      if (whole > lastSent) {
        lastSent = whole
        send({ type: 'progress', value: whole })
      }
    })

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(
      `[compile-stream] ✓ ${elapsed}s — ${(mindBuffer.byteLength / 1024).toFixed(0)}KB ` +
      `— veredicto: ${metrics.verdict.level.toUpperCase()} ` +
      `(seguimiento ${Math.round(metrics.tracking.fillRatio * 100)}%, ` +
      `detección ${metrics.detection.totalPoints} pts, ` +
      `zonas ${metrics.distribution.occupiedCells}/9)`
    )

    send({
      type: 'done',
      mind: Buffer.from(mindBuffer).toString('base64'),
      seconds: Number(elapsed),
      metrics,
    })
    res.end()
  } catch (err) {
    console.error('[compile-stream] Error:', err.message)
    // El error va como evento, no como status HTTP: los headers ya se enviaron
    // al abrir el stream y no se puede cambiar el código de respuesta
    send({ type: 'error', message: err.message })
    res.end()
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
  console.log(`\n🖋️  InkAR Worker corriendo en http://localhost:${PORT}`)
  console.log(`   Health check: http://localhost:${PORT}/health`)
  console.log(`   Compile:      POST http://localhost:${PORT}/compile`)
  console.log(`   Analyze:      POST http://localhost:${PORT}/analyze\n`)
})

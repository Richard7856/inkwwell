/**
 * Wrapper sobre MindAR OfflineCompiler para uso en Node.js.
 *
 * ¿Por qué OfflineCompiler y no Compiler?
 * La clase `Compiler` de MindAR usa Web Workers internamente — solo corre en browser.
 * `OfflineCompiler` es la variante síncrona diseñada para Node.js: misma lógica,
 * sin dependencia de browser APIs.
 *
 * ¿Por qué `canvas` package para cargar la imagen?
 * Node.js no tiene HTMLImageElement ni ImageBitmap. El package `canvas` (ya incluido
 * como dependencia de `mind-ar`) provee `loadImage()` que devuelve un objeto compatible
 * con `context.drawImage()`, que es lo que OfflineCompiler espera.
 *
 * @param {Buffer} imageBuffer - Buffer del archivo de imagen (JPG/PNG)
 * @returns {Promise<ArrayBuffer>} Buffer del archivo .mind compilado
 */

import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js'
import { loadImage } from 'canvas'

export async function compileTattooImage(imageBuffer, onProgress = null) {
  // loadImage acepta Buffer directamente — no necesitamos escribir a disco
  const img = await loadImage(imageBuffer)

  const compiler = new OfflineCompiler()

  /*
    El callback de progreso de MindAR reporta avance real, no estimado:
    0-50% corresponde a la extracción de features de detección (matchingData),
    50-100% a los de seguimiento (trackingData).

    Se expone hacia afuera (onProgress) para poder transmitirlo al cliente por SSE.
    La compilación puede tomar decenas de segundos y sin feedback el usuario asume
    que la app se colgó.
  */
  await compiler.compileImageTargets([img], (progress) => {
    process.stdout.write(`\rCompilando image target: ${progress.toFixed(1)}%  `)
    if (onProgress) onProgress(progress)
  })

  console.log('\n✓ Image target compilado correctamente')

  // exportData() devuelve el .mind como ArrayBuffer (formato msgpack interno de MindAR)
  return compiler.exportData()
}

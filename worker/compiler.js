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

export async function compileTattooImage(imageBuffer) {
  // loadImage acepta Buffer directamente — no necesitamos escribir a disco
  const img = await loadImage(imageBuffer)

  const compiler = new OfflineCompiler()

  // compileImageTargets acepta array de imágenes — en Phase 1 siempre es uno
  // El callback de progreso es importante para debugging: compilar puede tomar 15-30s
  await compiler.compileImageTargets([img], (progress) => {
    process.stdout.write(`\rCompilando image target: ${progress.toFixed(1)}%  `)
  })

  console.log('\n✓ Image target compilado correctamente')

  // exportData() devuelve el .mind como ArrayBuffer (formato msgpack interno de MindAR)
  return compiler.exportData()
}

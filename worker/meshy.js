/**
 * Cliente de Meshy: fotos de una mascota → modelo 3D GLB.
 *
 * ── Qué es esto y qué NO es ──
 * Es la mitad de proveedor de un posible producto en 3D, escrita para poder
 * PROBARLO: que un cliente suba fotos y le salga su modelo sin que nadie toque
 * un panel. No hay tabla, ni cobro de créditos, ni asignación a un tatuaje —
 * nada de eso se construye hasta saber si el resultado vale la pena. Lo que
 * vende el producto hoy sigue siendo el video.
 *
 * ── Por qué las fotos pueden ir en base64 ──
 * El API acepta `data:image/jpeg;base64,…` además de URLs públicas. Eso evita
 * tener que hacer pública la foto de la mascota de alguien solo para que Meshy
 * la lea. Importa para el producto, no solo para la prueba.
 *
 * ── Por qué no rigea por omisión ──
 * El esqueleto que monta Meshy es humanoide —su documentación dice que
 * "non-bipeds (animals, objects) may rig poorly"— y su biblioteca de 678
 * animaciones es de bípedo: las vistas previas cuelgan de `/preview/biped/`.
 * Un perro rigeado como persona sale deforme, y sería una lástima tirar una
 * malla buena por un rig malo. El rig se pide aparte, a propósito.
 */

const BASE = 'https://api.meshy.ai'
const LLAVE = process.env.MESHY_API_KEY

export const meshyConfigurado = Boolean(LLAVE)

/*
  Presupuesto de tamaño, medido contra lo que la app ya carga.

  Los modelos del repo pesan entre 0.6 y 1.8 MB, y el AR los baja por red ANTES
  de poder mostrar nada. Un GLB de 10 MB no es "más bonito": son segundos de
  pantalla vacía sobre datos móviles, justo cuando el usuario decide si esto
  funciona. Por eso el objetivo de polígonos por omisión es conservador y la
  textura va a 2k — 4k no se distingue en un antebrazo y sí engorda el archivo.
*/
export const POLIGONOS_POR_OMISION = 24000

/** Error con código estable, para que la ruta responda con el status correcto */
export class ErrorMeshy extends Error {
  constructor(codigo, message, status = 500) {
    super(message)
    this.codigo = codigo
    this.status = status
  }
}

function cabeceras() {
  if (!meshyConfigurado) {
    throw new ErrorMeshy('no_configurado', 'Falta MESHY_API_KEY en el entorno del worker', 503)
  }
  return { Authorization: `Bearer ${LLAVE}`, 'Content-Type': 'application/json' }
}

/*
  Una imagen y varias son rutas DISTINTAS del API, no la misma con un arreglo.
  El multi-imagen es el que gana precisión geométrica con vistas de varios
  ángulos, que es justamente por qué se piden cuatro tomas de la mascota.
*/
function rutaDe(imagenes) {
  return imagenes.length > 1 ? '/openapi/v1/multi-image-to-3d' : '/openapi/v1/image-to-3d'
}

/**
 * Arranca la generación. Devuelve en cuanto Meshy acepta; el modelo tarda
 * minutos y se consulta con `estado()`.
 *
 * @param {object} datos
 * @param {string[]} datos.imagenes - 1 a 4. URLs https o data URIs en base64
 * @param {number} [datos.poligonos]
 * @param {boolean} [datos.rig] - ver el encabezado antes de activarlo
 * @returns {Promise<{ tarea: string, ruta: string }>}
 */
export async function crear({ imagenes, poligonos = POLIGONOS_POR_OMISION, rig = false }) {
  if (!Array.isArray(imagenes) || imagenes.length === 0) {
    throw new ErrorMeshy('sin_imagenes', 'Se requiere al menos una imagen', 400)
  }
  if (imagenes.length > 4) {
    throw new ErrorMeshy('demasiadas_imagenes', `Meshy acepta hasta 4 imágenes; llegaron ${imagenes.length}`, 400)
  }

  const ruta = rutaDe(imagenes)
  const multi = imagenes.length > 1

  const res = await fetch(`${BASE}${ruta}`, {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify({
      ...(multi ? { image_urls: imagenes } : { image_url: imagenes[0] }),
      should_texture: true,
      enable_pbr: false,        // mapas que la escena de la app no aprovecha
      texture_resolution: '2k',
      should_remesh: true,
      topology: 'triangle',
      target_polycount: poligonos,
      ai_model: 'latest',
      ...(rig ? { enable_rigging: true } : {}),
    }),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    /*
      Se distingue lo que es problema de NUESTRA cuenta de lo que es problema de
      la petición, igual que con Higgsfield: al usuario no se le puede insinuar
      que sus fotos estuvieron mal cuando lo que pasa es que nos quedamos sin
      créditos.
    */
    if (res.status === 402) {
      throw new ErrorMeshy('sin_creditos', 'La cuenta de Meshy no tiene créditos', 503)
    }
    if (res.status === 401 || res.status === 403) {
      throw new ErrorMeshy('credenciales', 'MESHY_API_KEY inválida o sin permiso', 503)
    }
    throw new ErrorMeshy('proveedor', `Meshy respondió ${res.status}: ${json?.message ?? JSON.stringify(json)}`, 502)
  }

  const tarea = json?.result ?? json?.id
  if (!tarea) {
    throw new ErrorMeshy('proveedor', `Meshy aceptó pero no devolvió id: ${JSON.stringify(json)}`, 502)
  }
  return { tarea, ruta }
}

/**
 * Estado de una generación.
 *
 * `ruta` hace falta porque el GET cuelga del MISMO endpoint que creó la tarea,
 * y hay dos. Quien llama la conserva; si no la tiene, se prueban las dos.
 *
 * @returns {Promise<{ estado: string, avance: number, glb: string|null, error: string|null, miniatura: string|null }>}
 */
export async function estado(tarea, ruta = null) {
  const candidatas = ruta ? [ruta] : ['/openapi/v1/multi-image-to-3d', '/openapi/v1/image-to-3d']

  for (const r of candidatas) {
    const res = await fetch(`${BASE}${r}/${tarea}`, { headers: cabeceras() })
    if (res.status === 404) continue
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      throw new ErrorMeshy('proveedor', `Meshy respondió ${res.status} al consultar ${tarea}`, 502)
    }
    return {
      estado: json?.status ?? 'unknown',
      avance: json?.progress ?? 0,
      glb: json?.model_urls?.glb ?? null,
      error: json?.task_error?.message ?? null,
      miniatura: json?.thumbnail_url ?? null,
    }
  }
  throw new ErrorMeshy('no_encontrada', `Meshy no conoce la tarea ${tarea}`, 404)
}

/*
  ═══ IMAGEN A IMAGEN ══════════════════════════════════════════════════════

  ── Por qué el producto necesita esto y no solo video ──
  Pedirle a un modelo de video que INVENTE una escena sale mal, y lo probamos
  caro: cara deforme, concha del tamaño de un sillón, marcas que no son las del
  perro. Un modelo de video es malo inventando y bueno moviendo.

  Así que se parte en dos. Aquí se COMPONE la escena como imagen fija —el perro
  de cuerpo entero, el objeto del recuerdo, a la escala correcta, con las marcas
  que salen de la foto del cliente— y recién esa imagen se manda a animar. El
  modelo de video ya no inventa nada: mueve lo que ve.

  ── Por qué nano-banana y no un generador ──
  Es un modelo de EDICIÓN: parte de las imágenes de referencia y cambia solo lo
  que se le pide. Un generador, por más que se le describa al perro, devuelve
  otro perro "parecido" — ya pasó con popcorn y con soul. La identidad de la
  mascota no es un detalle estético: es el producto entero.

  ── Por qué se puede enseñar al cliente antes de gastar ──
  Una imagen cuesta una fracción de un video. Eso permite componer, mostrar
  —"así se va a ver tu recuerdo, ¿lo generamos?"— y recién entonces gastar en
  el video. Deja de ser un ahorro y pasa a ser una función.
*/

/** Lo que cuesta cada modelo de edición, en créditos de Meshy. */
export const MODELOS_IMAGEN = {
  'nano-banana': 3,
  'nano-banana-2': 6,
  'nano-banana-pro': 9,
  'gpt-image-2': 12,
  'gpt-image-2-5-flare': 12,
  'gpt-image-2-5-sunburst': 12,
}

const PROPORCIONES = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3']

/**
 * Compone o edita una imagen a partir de hasta cinco referencias.
 *
 * @param {object} datos
 * @param {string[]} datos.imagenes - 1 a 5. URLs https o data URIs
 * @param {string} datos.prompt - qué cambiar, no qué generar
 * @param {string} [datos.modelo] - ver MODELOS_IMAGEN
 * @param {string} [datos.proporcion] - '9:16' para lo vertical de la app
 * @param {boolean} [datos.quitarFondo] - devuelve PNG transparente
 * @returns {Promise<{ tarea: string }>}
 */
export async function componerImagen({
  imagenes, prompt, modelo = 'nano-banana-pro', proporcion = '9:16', quitarFondo = false,
}) {
  if (!Array.isArray(imagenes) || imagenes.length === 0) {
    throw new ErrorMeshy('sin_imagenes', 'Se requiere al menos una imagen de referencia', 400)
  }
  if (imagenes.length > 5) {
    throw new ErrorMeshy('demasiadas_imagenes', `El API acepta hasta 5 referencias; llegaron ${imagenes.length}`, 400)
  }
  if (!prompt || prompt.trim().length < 10) {
    throw new ErrorMeshy('sin_prompt', 'El prompt describe la edición y no puede ir vacío', 400)
  }
  if (!MODELOS_IMAGEN[modelo]) {
    throw new ErrorMeshy('modelo_desconocido',
      `Modelo ${modelo} no está en la lista. Conocidos: ${Object.keys(MODELOS_IMAGEN).join(', ')}`, 400)
  }
  if (!PROPORCIONES.includes(proporcion)) {
    throw new ErrorMeshy('proporcion_invalida',
      `aspect_ratio ${proporcion} no permitido. Válidos: ${PROPORCIONES.join(', ')}`, 400)
  }

  const res = await fetch(`${BASE}/openapi/v1/image-to-image`, {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify({
      ai_model: modelo,
      prompt: prompt.trim(),
      reference_image_urls: imagenes,
      aspect_ratio: proporcion,
      remove_background: quitarFondo,
    }),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 402) throw new ErrorMeshy('sin_creditos', 'La cuenta de Meshy no tiene créditos', 503)
    if (res.status === 401 || res.status === 403) {
      throw new ErrorMeshy('credenciales', 'MESHY_API_KEY inválida o sin permiso', 503)
    }
    throw new ErrorMeshy('proveedor', `Meshy respondió ${res.status}: ${json?.message ?? JSON.stringify(json)}`, 502)
  }
  const tarea = json?.result ?? json?.id
  if (!tarea) {
    throw new ErrorMeshy('proveedor', `Meshy aceptó pero no devolvió id: ${JSON.stringify(json)}`, 502)
  }
  return { tarea }
}

/**
 * Estado de una composición.
 *
 * Devuelve también el JSON crudo a propósito: la documentación no fija el
 * nombre del campo donde viaja la imagen terminada, y adivinarlo mal haría
 * parecer que la tarea falló cuando en realidad salió bien.
 */
export async function estadoImagen(tarea) {
  const res = await fetch(`${BASE}/openapi/v1/image-to-image/${tarea}`, { headers: cabeceras() })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ErrorMeshy('proveedor', `Meshy respondió ${res.status} al consultar ${tarea}`, 502)
  }
  const urls = json?.image_urls ?? (json?.image_url ? [json.image_url] : null)
  return {
    estado: json?.status ?? 'unknown',
    avance: json?.progress ?? 0,
    imagenes: urls ?? [],
    error: json?.task_error?.message ?? null,
    crudo: json,
  }
}

import * as THREE from 'three'

/**
 * Capa de video 2D anclada a un image target.
 *
 * ── Por qué video y no 3D ──
 * Ver DECISIONS.md: un modelo 3D personalizado cuesta trabajo humano por
 * cliente, mientras que un video animado lo produce el propio tatuador —que ya
 * es ilustrador— y su costo marginal son créditos de generación, que escalan
 * con el ingreso en vez de con la infraestructura.
 *
 * ── El problema de la transparencia ──
 * El contenido tiene que aparecer SOBRE la piel, no dentro de un rectángulo
 * opaco: un recuadro negro encima del tatuaje arruina el efecto por completo.
 *
 * Y el video con canal alfa no es portable: WebM con VP9 lleva alfa pero Safari
 * no lo reproduce, y HEVC con alfa solo corre en Safari. Publicar los dos
 * significa producir y alojar cada pieza dos veces.
 *
 * La salida es recortar el fondo en el sombreador: el video se produce sobre un
 * color plano y la GPU descarta esos píxeles al pintar. Funciona en todos los
 * navegadores con un solo archivo, y es lo que se usa en producción.
 */

/*
  Verde de croma de respaldo.

  Se elige el verde y no el negro o el blanco porque es el color más lejano a
  los tonos de piel y de tinta: un fondo negro se comería las sombras del
  dibujo, y uno blanco sus brillos.

  Solo se usa si no se puede muestrear el video. Lo normal es detectar el color
  real — ver `detectarCroma`.
*/
/*
  Verde medido en las piezas generadas ([89,178,74] tal como lo decodifica el
  navegador), no el #00FF00 que se le pide al generador: con el recorte
  relativo a la saturación, un respaldo de verde puro queda tan lejos del
  fondo real que no recorta nada y se ve la pantalla verde completa.
*/
const CROMA_POR_DEFECTO = new THREE.Color(89 / 255, 178 / 255, 74 / 255)

/*
  Saturación mínima para aceptar una medición como fondo de croma. Un cuadro
  aún sin decodificar se lee negro (saturación 0), y aceptarlo apagaba el
  recorte por completo.
*/
const SATURACION_MIN = 0.12

/**
 * Detecta el color de fondo muestreando las esquinas del primer cuadro.
 *
 * ── Por qué no basta con asumir verde puro ──
 * Los generadores de video NO respetan el color exacto que se les pide. Medido
 * sobre una pieza real generada pidiendo #00FF00: el fondo salió [105,195,80],
 * bien lejos del verde puro — pero con una desviación de 1.5, o sea plano como
 * una pared. Asumir el color pedido dejaría el fondo entero sin recortar.
 *
 * Se muestrean las cuatro esquinas porque el sujeto va centrado; si alguna
 * discrepa mucho de las otras es que el fondo no es uniforme, y ahí más vale
 * avisar que recortar mal en silencio.
 *
 * @returns {{color: THREE.Color, uniforme: boolean, valido: boolean} | null}
 */
function detectarCroma(video) {
  const lienzo = document.createElement('canvas')
  const N = 24
  lienzo.width = video.videoWidth
  lienzo.height = video.videoHeight
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })
  if (!ctx || !lienzo.width) return null

  try {
    ctx.drawImage(video, 0, 0)
    const esquinas = [
      [0, 0], [lienzo.width - N, 0],
      [0, lienzo.height - N], [lienzo.width - N, lienzo.height - N],
    ].map(([x, y]) => {
      const d = ctx.getImageData(x, y, N, N).data
      let r = 0, g = 0, b = 0
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2] }
      const n = d.length / 4
      return [r / n / 255, g / n / 255, b / n / 255]
    })

    const media = esquinas.reduce((a, c) => [a[0]+c[0], a[1]+c[1], a[2]+c[2]], [0,0,0])
      .map((v) => v / esquinas.length)
    // Si una esquina se aleja mucho de la media, el fondo no es plano
    const dispersion = Math.max(...esquinas.map((c) =>
      Math.hypot(c[0]-media[0], c[1]-media[1], c[2]-media[2])))

    // Sin conversión de espacio: los valores del lienzo y los de la textura
    // viven en el mismo espacio, que es justo lo que permite compararlos.
    const gris = (media[0] + media[1] + media[2]) / 3
    const saturacion = Math.hypot(media[0] - gris, media[1] - gris, media[2] - gris)
    return {
      color: new THREE.Color(media[0], media[1], media[2]),
      uniforme: dispersion < 0.08,
      valido: saturacion >= SATURACION_MIN,
    }
  } catch {
    /*
      getImageData lanza si el video contaminó el lienzo por CORS. Ocurre cuando
      el archivo se sirve sin cabeceras de origen cruzado. Se cae al color de
      respaldo en vez de romper la carga.
    */
    return null
  }
}

/*
  Tolerancia del recorte, en PROPORCIÓN de la saturación del fondo.

  `umbral` es la distancia a partir de la cual un píxel deja de ser fondo.
  `suavizado` define la franja de transición: sin ella el borde queda
  dentado, porque la compresión de video difumina el contorno y crea píxeles
  intermedios entre el dibujo y el fondo.

  ── Por qué relativa y no absoluta ──
  Un color neutro (negro, blanco, gris) está SIEMPRE a la misma distancia del
  fondo: exactamente la saturación del verde. El generador entrega un verde
  apagado (~0.31 de saturación), y el umbral absoluto anterior era 0.32±0.10:
  el pelaje negro y el pecho blanco de Zero quedaban a alfa ~0.45 y se veía el
  tatuaje a través del perro. Dividiendo entre la saturación, un neutro vale
  1.0 sin importar qué tan apagado salga el fondo, y queda opaco.
*/
const UMBRAL = 0.45
const SUAVIZADO = 0.15

const VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT = `
  uniform sampler2D mapa;
  uniform vec3 croma;
  uniform float umbral;
  uniform float suavizado;
  uniform float opacidad;
  uniform sampler2D base;
  uniform float usarBase;
  uniform float soloCambios;
  uniform float listo;
  varying vec2 vUv;

  void main() {
    // Sin un cuadro real subido, la textura es negra: no se pinta nada
    if (listo < 0.5) discard;
    vec4 color = texture2D(mapa, vUv);

    /*
      Distancia al color de fondo.

      Se compara solo en crominancia y no en brillo: si se incluyera la
      luminancia, una zona muy iluminada del dibujo con algo de verde se
      recortaría junto con el fondo. Restar el promedio de canales deja fuera
      la parte de brillo de la comparación.
    */
    vec3 d = color.rgb - croma;
    float brillo = (d.r + d.g + d.b) / 3.0;
    // Saturación del fondo: la distancia de un gris a él. Piso de 0.05 por si
    // el fondo medido fuera casi neutro y la división se disparara.
    float saturacion = max(length(croma - (croma.r + croma.g + croma.b) / 3.0), 0.05);
    float distancia = length(d - brillo) / saturacion;

    /*
      Con soloCambios el video NO trae croma: es el tatuaje filmado sobre la
      piel. Ahí el recorte por color no aplica —la piel del video no es un
      fondo que quitar— y todo el trabajo lo hace la llave por diferencia de
      abajo: se pinta lo que se mueve, y lo quieto deja ver el brazo real.
    */
    float alfa = soloCambios > 0.5
      ? 1.0
      : smoothstep(umbral - suavizado, umbral + suavizado, distancia);

    /*
      Llave por diferencia (solo durante la intro).

      La intro arranca con el dibujo del tatuaje, pero el tatuaje REAL ya está
      ahí, en la piel. Si se pinta el dibujo del video encima, cualquier
      desfase del rastreo se ve como líneas dobles (visto en el teléfono el
      16 sep). Así que lo que sigue igual que en el primer cuadro no se pinta:
      se ve la piel. Solo aparece lo que cambió — la tinta que empieza a
      escurrir y lo que sale de ella.

      Umbral 0.10-0.22 en distancia RGB: la compresión mueve los píxeles
      quietos ~0.03-0.06; la tinta que se derrite cambia de verde a negro
      (~0.6), así que hay margen amplio.
    */
    if (usarBase > 0.0) {
      float cambio = length(color.rgb - texture2D(base, vUv).rgb);
      // usarBase baja a 0 cuando el sujeto sale: si no, su pelaje negro sobre
      // una línea del dibujo original contaría como "sin cambio" y se recortaría
      alfa *= mix(1.0, smoothstep(0.10, 0.22, cambio), usarBase);
      // El borde del cambio se difumina para que no se note el recorte sobre
      // la piel: sin esto, la zona que revive aparece con un contorno duro
      alfa *= smoothstep(0.0, 0.05, alfa);
    }

    if (alfa < 0.01) discard;   // píxel de fondo o dibujo quieto: no se escribe

    /*
      Desderrame.

      Recortar el alfa no basta: los píxeles del borde SOBREVIVEN al recorte
      pero siguen teñidos del color de fondo, porque la compresión de video
      mezcla el dibujo con el verde en el contorno. El resultado es un halo
      verde que sobre la piel se lee como un error de recorte.

      Se limita el canal del croma a lo que justifican los otros dos: si el
      verde supera el promedio de rojo y azul, ese exceso viene del fondo y se
      recorta. Es la técnica estándar y cuesta dos operaciones por píxel.
    */
    vec3 rgb = color.rgb;
    if (soloCambios > 0.5) {
      gl_FragColor = vec4(rgb, alfa * opacidad);
      return;
    }

    /*
      El desderrame se aplica SOLO en el borde, con fuerza proporcional a
      (1 - alfa).

      Aplicarlo a todo el sujeto tiñe zonas legítimas: en un crema o un blanco
      cálido el canal verde apenas supera al promedio de los otros dos, así que
      la corrección se lo baja y la zona queda grisácea. Se vio en la primera
      prueba sobre piel — el pecho del perro salió manchado, aunque el video de
      origen estaba limpio.

      La contaminación real vive donde el fondo se mezcla con el dibujo, es
      decir donde el alfa es parcial. En el interior opaco, alfa vale 1 y el
      factor cae a 0: el color no se toca.
    */
    float derrame = 1.0 - alfa;
    if (derrame > 0.001) {
      if (croma.g > 0.5) {
        float ref = (rgb.r + rgb.b) * 0.5;
        if (rgb.g > ref) rgb.g = mix(rgb.g, ref, derrame);
      }
      if (croma.b > 0.5) {
        float ref = (rgb.r + rgb.g) * 0.5;
        if (rgb.b > ref) rgb.b = mix(rgb.b, ref, derrame);
      }
    }

    gl_FragColor = vec4(rgb, alfa * opacidad);

  }
`

/*
  En qué tramo de la intro se apaga la llave por diferencia, como fracción de
  su duración. Antes, el dibujo quieto no se pinta (se ve el tatuaje real);
  después, se pinta todo. Medido en zero-nace (6 s): el charco ya cubrió el
  dibujo a los ~2.4 s y el perro asoma a los ~2.9 s. Un video con otro ritmo
  puede ajustarlo con `introLlave: [inicio, fin]` en segundos.
*/
const LLAVE_FRACCION = [0.40, 0.48]

/*
  Si el rastreo se pierde menos que esto, al recuperarlo el video CONTINÚA en
  vez de volver al inicio. El tatuaje de la huella rastrea al 16% y parpadea:
  reiniciar en cada parpadeo repetiría la intro sin fin.
*/
const GRACIA_PERDIDA_MS = 1500

/**
 * Copia el cuadro actual del video a una textura, a media resolución (la
 * comparación no necesita detalle y así pesa la cuarta parte).
 *
 * @returns {THREE.CanvasTexture|null} null si el cuadro sale negro (Android a
 *   veces entrega 'loadeddata' sin cuadro decodificado) o si CORS lo impide
 */
function capturarCuadro(video) {
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.max(1, Math.round(video.videoWidth / 2))
  lienzo.height = Math.max(1, Math.round(video.videoHeight / 2))
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })
  try {
    ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height)
    // Una esquina negra delata un cuadro sin decodificar: el croma nunca es negro
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    if (r + g + b < 30) return null
  } catch {
    return null
  }
  // Mismo criterio que la textura del video: sin declarar espacio de color
  return new THREE.CanvasTexture(lienzo)
}

/**
 * Abre un <video> y espera a que tenga un cuadro decodificado.
 * @returns {Promise<{video: HTMLVideoElement, textura: THREE.VideoTexture, croma: THREE.Color|null, url: string}>}
 */
function abrirVideo(url, { bucle, croma }) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    /*
      crossOrigin ANTES de src: WebGL rechaza texturas de otro origen sin CORS
      declarado, y ponerlo después de asignar src llega tarde. El video vive en
      Supabase Storage, que es otro dominio.
    */
    video.crossOrigin = 'anonymous'
    video.loop = bucle
    video.muted = true          // requisito para autoreproducir en móvil
    video.playsInline = true    // sin esto, iOS lo abre a pantalla completa
    video.preload = 'auto'
    video.src = url

    video.addEventListener('error', () => reject(new Error(`No se pudo cargar el video: ${url}`)), { once: true })

    /*
      Se espera a 'loadeddata' y NO a 'loadedmetadata'.

      En loadedmetadata ya se conocen las medidas del video, pero todavía NO hay
      ningún cuadro decodificado: dibujarlo en un lienzo devuelve negro. Medido:
      [0,0,0] en loadedmetadata contra [100,180,78] con un cuadro real.
    */
    video.addEventListener('loadeddata', () => {
      /*
        La textura se deja SIN declarar espacio de color, a propósito.

        Este proyecto corre Three 0.151 con ColorManagement desactivado y
        outputEncoding lineal: el renderizador no convierte nada. Marcar la
        textura como sRGB hace que la GPU la linealice al leerla, y entonces
        el muestreo queda oscuro y deja de coincidir con el color de fondo
        medido, así que el recorte no recorta.
      */
      const textura = new THREE.VideoTexture(video)
      const pieza = { video, textura, croma: null, url, avisaCuadros: false }
      /*
        ¿El navegador avisa de cada cuadro? Si sí, Three sube la textura por su
        cuenta y la app no debe duplicarlo (ver actualizarVideo). Se registra
        aparte del aviso de Three para no tocar su ciclo.
      */
      if ('requestVideoFrameCallback' in video) {
        const alAvisar = () => {
          pieza.avisaCuadros = true
          pieza.subida = true
          video.requestVideoFrameCallback(alAvisar)
        }
        video.requestVideoFrameCallback(alAvisar)
      }

      if (croma) {
        const detectado = detectarCroma(video)
        if (detectado?.valido) {
          pieza.croma = detectado.color
          if (!detectado.uniforme) {
            console.warn('[videoLayer] El fondo del video no es uniforme; el recorte va a dejar manchas:', url)
          }
        } else {
          /*
            Visto en Android: 'loadeddata' llegó sin cuadro decodificado, la
            medición salió negra y el recorte quedó apagado — pantalla verde
            completa. Se vuelve a medir con el video ya corriendo, y mientras
            tanto se usa el respaldo.
          */
          console.warn('[videoLayer] El primer cuadro no trae un croma legible; se vuelve a medir al reproducir:', url)
          video.addEventListener('playing', () => requestAnimationFrame(() => {
            const nuevo = detectarCroma(video)
            if (nuevo?.valido) {
              pieza.croma = nuevo.color
              pieza.alMedir?.()
            } else {
              console.warn('[videoLayer] Tampoco al reproducir se pudo medir el croma; queda el respaldo:', url)
            }
          }), { once: true })
        }
      }
      resolve(pieza)
    }, { once: true })
  })
}

/**
 * Crea el plano de video y lo cuelga del ancla del target.
 *
 * ── Intro + video principal ──
 * Con `introUrl`, primero se reproduce UNA vez la intro —el video que nace del
 * dibujo del tatuaje— y al terminar se pasa al principal, en bucle. Los dos
 * deben medir lo mismo: comparten el plano, y el último cuadro de la intro es
 * el primero del principal, así que el cambio no se nota (ver
 * worker/componer-inicio.js).
 *
 * @param {object} config
 * @param {string} config.videoUrl - Video principal, en bucle
 * @param {string} [config.introUrl] - Se reproduce una vez antes del principal
 * @param {[number, number]} [config.introLlave] - Segundos en que la llave por
 *   diferencia se apaga. Por defecto, LLAVE_FRACCION de la duración.
 * @param {boolean} [config.soloCambios] - Para el video que ANIMA EL TATUAJE
 *   mismo: se filmó sobre la piel, no sobre croma, así que se pinta solo lo
 *   que cambia respecto del primer cuadro y la llave nunca se apaga.
 * @param {boolean} [config.croma] - Recortar el fondo por color. Con false el
 *   video se muestra completo, dentro de su rectángulo.
 * @param {number} [config.escala] - Ancho del plano en unidades del target,
 *   donde 1 es el ancho del tatuaje.
 * @param {THREE.Group} anchorGroup
 * @returns {Promise<object>} handle de la capa
 */
export async function cargarVideo(config, anchorGroup) {
  const { videoUrl, introUrl = null, croma = true, escala = 1, introLlave = null, soloCambios = false } = config

  const [principal, intro] = await Promise.all([
    abrirVideo(videoUrl, { bucle: true, croma }),
    /*
      Si la intro falla, se muestra el principal solo: la intro es un
      adorno, el recuerdo es el producto.
    */
    introUrl
      ? abrirVideo(introUrl, { bucle: false, croma }).catch((err) => {
          console.error('[videoLayer] Sin intro, se muestra solo el video principal:', err.message)
          return null
        })
      : null,
  ])

  const { video } = principal
  const proporcion = video.videoWidth / video.videoHeight || 1
  if (intro && intro.video.videoWidth * video.videoHeight !== video.videoWidth * intro.video.videoHeight) {
    console.warn(
      `[videoLayer] La intro (${intro.video.videoWidth}x${intro.video.videoHeight}) no tiene la proporción del ` +
      `principal (${video.videoWidth}x${video.videoHeight}); se va a deformar al compartir el plano.`
    )
  }

  const primera = intro ?? principal

  /*
    Primer cuadro de la intro, para la llave por diferencia. Si no se puede
    capturar ahora, se reintenta al reproducir: los primeros ~0.8 s de la
    intro son el dibujo quieto, así que ese cuadro sigue sirviendo.
  */
  /*
    El primer cuadro de referencia. En la intro es el dibujo del tatuaje sobre
    croma; con soloCambios es la foto del brazo quieto, y la referencia es del
    video PRINCIPAL porque no hay intro.
  */
  const conBase = soloCambios ? principal : intro
  if (conBase && (croma || soloCambios)) {
    const d = conBase.video.duration || 6
    // Con soloCambios la llave no se apaga nunca: todo lo quieto es piel real
    conBase.llave = soloCambios ? [Infinity, Infinity] : (introLlave ?? [d * LLAVE_FRACCION[0], d * LLAVE_FRACCION[1]])
    conBase.base = capturarCuadro(conBase.video)
    const intro = conBase   // el reintento vale para la pieza que lleva base
    if (!intro.base) {
      intro.video.addEventListener('playing', () => requestAnimationFrame(() => {
        intro.base = capturarCuadro(intro.video)
        if (intro.base && capa.actual === intro) mostrarPieza(capa, intro)
        if (!intro.base) console.warn('[videoLayer] Sin primer cuadro de la intro; se mostrará el dibujo completo')
      }), { once: true })
    }
  }

  const material = (croma || soloCambios)
    ? new THREE.ShaderMaterial({
        uniforms: {
          mapa: { value: primera.textura },
          croma: { value: (primera.croma ?? CROMA_POR_DEFECTO).clone() },
          umbral: { value: UMBRAL },
          suavizado: { value: SUAVIZADO },
          soloCambios: { value: soloCambios ? 1 : 0 },
          opacidad: { value: 1 },
          base: { value: null },
          usarBase: { value: 0 },
          listo: { value: 0 },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        // El plano se ve desde ambos lados: el tatuaje puede quedar de
        // frente o volteado según cómo sostenga el teléfono quien mira.
        side: THREE.DoubleSide,
        // Sin profundidad: es una calcomanía sobre la piel, no un objeto
        // que deba ocultarse detrás de nada.
        depthWrite: false,
      })
    : new THREE.MeshBasicMaterial({ map: primera.textura, side: THREE.DoubleSide, toneMapped: false })

  const plano = new THREE.Mesh(new THREE.PlaneGeometry(escala, escala / proporcion), material)
  // Ligeramente por delante del plano del target, para que no compita con
  // él en el buffer de profundidad y parpadee
  plano.position.z = 0.01
  anchorGroup.add(plano)

  if (croma || soloCambios) mostrarPiezaEnMaterial(material, primera)

  const capa = {
    tipo: 'video',
    plano,
    material,
    principal,
    intro,
    actual: primera,
    perdidoDesde: null,
    // Las animaciones son del GLB; un video no las tiene. Se devuelve la
    // lista vacía para que index.jsx no necesite distinguir el tipo.
    animationNames: [],
  }

  // Cada pieza trae su propio verde: el generador no repite el tono exacto
  // entre un video y otro, así que al cambiar de pieza cambia también el croma
  for (const pieza of [principal, intro]) {
    if (pieza) pieza.alMedir = () => { if (capa.actual === pieza) mostrarPieza(capa, pieza) }
  }

  if (intro) {
    intro.video.addEventListener('ended', () => {
      mostrarPieza(capa, principal)
      principal.video.currentTime = 0
      principal.video.play().catch(() => {})
    })
  }

  return capa
}

/** Pone una pieza (intro o principal) en el plano, con su color de fondo. */
function mostrarPieza(capa, pieza) {
  capa.actual = pieza
  if (capa.material.uniforms) {
    mostrarPiezaEnMaterial(capa.material, pieza)
  } else {
    capa.material.map = pieza.textura
    capa.material.needsUpdate = true
  }
}

function mostrarPiezaEnMaterial(material, pieza) {
  const u = material.uniforms
  u.mapa.value = pieza.textura
  if (pieza.croma) u.croma.value.copy(pieza.croma)
  // Solo la intro tiene base: el principal se pinta completo
  u.base.value = pieza.base ?? null
  u.usarBase.value = pieza.base ? fuerzaLlave(pieza) : 0
}

function fuerzaLlave(pieza) {
  const [ini, fin] = pieza.llave
  if (!isFinite(ini)) return 1   // llave permanente (soloCambios)
  const t = pieza.video.currentTime
  return 1 - Math.min(1, Math.max(0, (t - ini) / (fin - ini)))
}

/**
 * Se llama en cada cuadro, antes de dibujar.
 *
 * ── Por qué la app sube el cuadro y no confía en Three ──
 * VideoTexture (Three 0.151) solo sube un cuadro cuando el navegador lo avisa
 * con requestVideoFrameCallback. Hasta el primer aviso la textura está vacía y
 * se pinta NEGRA; y algunos navegadores móviles avisan tarde o nunca para un
 * <video> que no está en el documento. Visto el 16 sep: rectángulo negro sobre
 * el tatuaje y en el teléfono "ya no carga". Si el navegador no ha avisado,
 * la app sube el cuadro cuando cambia el tiempo del video.
 *
 * Solo como respaldo: subir en paralelo al aviso hizo que Chrome dejara de
 * mostrar el video de la CÁMARA (pantalla negra detrás del contenido, visto en
 * la prueba con cámara simulada).
 *
 * `listo` esconde el plano hasta que hay un cuadro real de la pieza actual:
 * al reiniciar la intro, su textura aún tiene el último cuadro de la vez
 * anterior (el perro) y se vería un destello.
 */
export function actualizarVideo(capa) {
  if (capa?.tipo !== 'video') return
  const pieza = capa.actual
  const v = pieza.video
  if (!pieza.avisaCuadros && v.readyState >= 2 && !v.seeking && v.currentTime !== pieza.ultimoTiempo) {
    pieza.textura.needsUpdate = true
    pieza.ultimoTiempo = v.currentTime
    pieza.subida = true
  }
  const u = capa.material.uniforms
  if (!u) return
  u.listo.value = pieza.subida ? 1 : 0
  if (pieza.base) u.usarBase.value = fuerzaLlave(pieza)
}

/**
 * Reproduce o pausa según el target esté visible.
 *
 * Sin esto el video corre desde que carga: cuando alguien por fin apunta al
 * tatuaje, la animación va por la mitad o ya terminó. Además gasta batería
 * decodificando cuadros que nadie ve.
 */
export function alternarVideo(capa, visible) {
  if (capa?.tipo !== 'video') return

  if (!visible) {
    capa.actual.video.pause()
    capa.perdidoDesde = performance.now()
    return
  }

  const parpadeo = capa.perdidoDesde !== null && performance.now() - capa.perdidoDesde < GRACIA_PERDIDA_MS
  capa.perdidoDesde = null

  if (!parpadeo) {
    // Aparición nueva: quien apunta al tatuaje debe ver la pieza desde el
    // principio, y si hay intro, el video vuelve a nacer del tatuaje
    capa.actual.video.pause()
    mostrarPieza(capa, capa.intro ?? capa.principal)
    capa.actual.video.currentTime = 0
    // Hasta subir un cuadro del nuevo inicio no se pinta (ver actualizarVideo)
    capa.actual.subida = false
    capa.actual.ultimoTiempo = undefined
  }
  // play() devuelve una promesa que el navegador rechaza si bloquea la
  // autoreproducción. Se ignora: el video queda en el primer cuadro, que es
  // preferible a un error en consola que no le sirve a nadie.
  capa.actual.video.play().catch(() => {})
}

/** Libera los videos y sus texturas. */
export function liberarVideo(capa) {
  if (capa?.tipo !== 'video') return
  for (const pieza of [capa.principal, capa.intro]) {
    if (!pieza) continue
    pieza.video.pause()
    pieza.video.removeAttribute('src')
    /*
      load() tras quitar el src es lo que de verdad corta la descarga y libera
      el decodificador. Sin esa llamada el navegador puede seguir bajando el
      archivo aunque el elemento ya no esté en uso.
    */
    pieza.video.load()
    pieza.textura.dispose()
    pieza.base?.dispose()
  }
  capa.material?.dispose()
  capa.plano?.geometry?.dispose()
  capa.plano?.parent?.remove(capa.plano)
}

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
const CROMA_POR_DEFECTO = new THREE.Color(0x00ff00)

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
 * @returns {{color: THREE.Color, uniforme: boolean} | null}
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
    return {
      color: new THREE.Color(media[0], media[1], media[2]),
      uniforme: dispersion < 0.08,
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
  Tolerancia del recorte.

  `umbral` es la distancia de color a partir de la cual un píxel se considera
  fondo. `suavizado` define la franja de transición: sin ella el borde queda
  dentado, porque la compresión de video difumina el contorno y crea píxeles
  intermedios entre el dibujo y el fondo.
*/
const UMBRAL = 0.32
const SUAVIZADO = 0.10

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
  varying vec2 vUv;

  void main() {
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
    float distancia = length(d - brillo);

    float alfa = smoothstep(umbral - suavizado, umbral + suavizado, distancia);
    if (alfa < 0.01) discard;   // píxel de fondo: ni siquiera se escribe

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
    float referencia = (rgb.r + rgb.b) * 0.5;
    if (croma.g > 0.5 && rgb.g > referencia) rgb.g = mix(rgb.g, referencia, 0.9);
    if (croma.b > 0.5 && rgb.b > (rgb.r + rgb.g) * 0.5) rgb.b = mix(rgb.b, (rgb.r + rgb.g) * 0.5, 0.9);

    gl_FragColor = vec4(rgb, alfa * opacidad);

  }
`

/**
 * Crea el elemento <video> y su plano, y lo cuelga del ancla del target.
 *
 * @param {object} config
 * @param {string} config.videoUrl
 * @param {boolean} [config.croma] - Recortar el fondo por color. Con false el
 *   video se muestra completo, dentro de su rectángulo.
 * @param {number} [config.escala] - Ancho del plano en unidades del target,
 *   donde 1 es el ancho del tatuaje.
 * @param {THREE.Group} anchorGroup
 * @returns {Promise<object>} handle de la capa
 */
export function cargarVideo(config, anchorGroup) {
  const { videoUrl, croma = true, escala = 1 } = config

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    /*
      crossOrigin ANTES de src: WebGL rechaza texturas de otro origen sin CORS
      declarado, y ponerlo después de asignar src llega tarde. El video vive en
      Supabase Storage, que es otro dominio.
    */
    video.crossOrigin = 'anonymous'
    video.loop = true
    video.muted = true          // requisito para autoreproducir en móvil
    video.playsInline = true    // sin esto, iOS lo abre a pantalla completa
    video.preload = 'auto'
    video.src = videoUrl

    const alFallar = () => reject(new Error(`No se pudo cargar el video: ${videoUrl}`))
    video.addEventListener('error', alFallar, { once: true })

    /*
      Se espera a 'loadeddata' y NO a 'loadedmetadata'.

      En loadedmetadata ya se conocen las medidas del video, pero todavía NO hay
      ningún cuadro decodificado: dibujarlo en un lienzo devuelve negro. Medido:
      [0,0,0] en loadedmetadata contra [100,180,78] con un cuadro real.

      El efecto de detectar negro es engañoso, porque no falla de golpe — el
      fondo verde queda a media opacidad en vez de desaparecer, y se lee como
      "el recorte no jala y además se ve oscuro", que parecen dos problemas
      distintos y llevan a buscar en el lugar equivocado.
    */
    video.addEventListener('loadeddata', () => {
      const proporcion = video.videoWidth / video.videoHeight || 1
      const textura = new THREE.VideoTexture(video)
      /*
        La textura se deja SIN declarar espacio de color, a propósito.

        Este proyecto corre Three 0.151 con ColorManagement desactivado y
        outputEncoding lineal: el renderizador no convierte nada. Marcar la
        textura como sRGB hace que la GPU la linealice al leerla, y entonces
        pasan dos cosas a la vez — el muestreo queda oscuro, y deja de coincidir
        con el color de fondo medido en sRGB, así que el recorte no recorta.
        Ambos síntomas se vieron juntos y despistan, porque parecen dos fallas.

        Sin declararlo, todo vive en el espacio nativo del video: se compara
        contra el color medido y se escribe tal cual.
      */

      const detectado = croma ? detectarCroma(video) : null
      if (detectado && !detectado.uniforme) {
        console.warn(
          '[videoLayer] El fondo del video no es uniforme; el recorte va a dejar manchas:',
          videoUrl
        )
      }

      const material = croma
        ? new THREE.ShaderMaterial({
            uniforms: {
              mapa: { value: textura },
              croma: { value: detectado?.color ?? CROMA_POR_DEFECTO.clone() },
              umbral: { value: UMBRAL },
              suavizado: { value: SUAVIZADO },
              opacidad: { value: 1 },
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
        : new THREE.MeshBasicMaterial({ map: textura, side: THREE.DoubleSide, toneMapped: false })

      const ancho = escala
      const alto = escala / proporcion
      const plano = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), material)
      // Ligeramente por delante del plano del target, para que no compita con
      // él en el buffer de profundidad y parpadee
      plano.position.z = 0.01
      anchorGroup.add(plano)

      resolve({
        tipo: 'video',
        video,
        plano,
        textura,
        material,
        // Las animaciones son del GLB; un video no las tiene. Se devuelve la
        // lista vacía para que index.jsx no necesite distinguir el tipo.
        animationNames: [],
      })
    }, { once: true })
  })
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
  if (visible) {
    // Se reinicia al aparecer: quien apunta al tatuaje debe ver la pieza
    // desde el principio, no desde donde se había quedado.
    capa.video.currentTime = 0
    // play() devuelve una promesa que el navegador rechaza si bloquea la
    // autoreproducción. Se ignora: el video queda en el primer cuadro, que es
    // preferible a un error en consola que no le sirve a nadie.
    capa.video.play().catch(() => {})
  } else {
    capa.video.pause()
  }
}

/** Libera el video y su textura. */
export function liberarVideo(capa) {
  if (capa?.tipo !== 'video') return
  capa.video.pause()
  capa.video.removeAttribute('src')
  /*
    load() tras quitar el src es lo que de verdad corta la descarga y libera el
    decodificador. Sin esa llamada el navegador puede seguir bajando el archivo
    aunque el elemento ya no esté en uso.
  */
  capa.video.load()
  capa.textura?.dispose()
  capa.material?.dispose()
  capa.plano?.geometry?.dispose()
  capa.plano?.parent?.remove(capa.plano)
}

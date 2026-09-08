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
  Verde de croma por defecto.

  Se elige el verde y no el negro o el blanco porque es el color más lejano a
  los tonos de piel y de tinta: un fondo negro se comería las sombras del
  dibujo, y uno blanco sus brillos.
*/
const CROMA_POR_DEFECTO = new THREE.Color(0x00ff00)

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

    video.addEventListener('loadedmetadata', () => {
      const proporcion = video.videoWidth / video.videoHeight || 1
      const textura = new THREE.VideoTexture(video)
      textura.colorSpace = THREE.SRGBColorSpace

      const material = croma
        ? new THREE.ShaderMaterial({
            uniforms: {
              mapa: { value: textura },
              croma: { value: CROMA_POR_DEFECTO.clone() },
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

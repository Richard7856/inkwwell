import * as THREE from 'three'
import { calcularMascaraTinta, muestrearPuntosDeTinta } from './mascaraTinta.js'

/**
 * Evocación: el contenido SALE del tatuaje en vez de aparecer encima.
 *
 * ── Por qué existe ──
 * Poner un video sobre una imagen rastreada es fácil de copiar y no se siente
 * ligado a la piel. Aquí la secuencia usa los píxeles del PROPIO tatuaje —los
 * que MindAR ya guarda en el .mind—, así que solo funciona sobre ese tatuaje y
 * alineada con él:
 *
 *   1. Despertar  — una onda recorre las líneas de tinta y las enciende.
 *   2. Levantarse — la tinta se desprende en partículas que suben de la piel.
 *   3. Formarse   — las partículas convergen y el contenido se materializa
 *                   desde el centro, con el borde encendido del mismo color.
 *
 * ── Por qué en la GPU y no dentro del video generado ──
 * El generador no sabe dónde está el tatuaje real ni con qué perspectiva se
 * mira; un efecto horneado en el video se vería pegado. Además costaría otra
 * generación por usuario. Esto es gratis, instantáneo, y sirve igual para el
 * catálogo 3D.
 *
 * Todo el movimiento vive en los sombreadores: el CPU solo avanza un reloj.
 */

/* ── Línea de tiempo, en segundos desde que se encuentra el tatuaje ── */
const T_ONDA = 0.9          // lo que tarda la onda en cruzar el tatuaje
const T_PARTICULA = 1.3     // vida de cada partícula
const T_FORMA_INICIO = 0.85 // arranca la materialización del contenido
const T_FORMA = 1.15        // lo que dura
const T_BRILLO_FIN = 3.6    // la tinta vuelve a verse como tinta

/*
  Si el rastreo se pierde menos que esto, al recuperarlo se CONTINÚA en vez de
  repetir la secuencia. El tatuaje de la huella rastrea al 16%: parpadea, y
  repetir la evocación en cada parpadeo la volvería molesta en segundos.
*/
const GRACIA_PERDIDA = 1.5

/*
  Cuánto se despega el contenido de la piel al formarse, en anchos de
  tatuaje. Da paralaje: al mover el teléfono, el contenido flota sobre el
  brazo en vez de verse impreso. Más de ~0.2 deja de sentirse anclado.
*/
const ELEVACION = 0.12

const N_PARTICULAS = 700

// Violeta "Realidad" de la marca
const COLOR_TINTA = new THREE.Color(0x8b5cf6)

/**
 * Lee de MindAR las imágenes de rastreo de cada target.
 *
 * Se toman del tracker ya cargado para no descargar el .mind dos veces.
 * `controller.tracker.trackingDataList` no es API pública; si una versión
 * futura lo cambia, se devuelve vacío y el visor sigue sin evocación en lugar
 * de romperse.
 *
 * @returns {({data: Uint8Array, width: number, height: number} | null)[]}
 */
export function leerImagenesDeTarget(mindar) {
  try {
    const lista = mindar?.controller?.tracker?.trackingDataList ?? []
    // [0] es la escala más grande (256 px de ancho): la de más detalle
    return lista.map((escalas) => (escalas?.[0]?.data ? escalas[0] : null))
  } catch (err) {
    console.warn('[evocacion] No se pudo leer la imagen de los targets:', err.message)
    return []
  }
}

/**
 * Monta la evocación en el ancla de un target.
 *
 * @param {object} imagen - {data, width, height} de `leerImagenesDeTarget`
 * @param {THREE.Group} anchorGroup
 * @param {object} contenido
 * @param {THREE.Object3D} contenido.objeto - Plano de video o modelo 3D
 * @param {(p: number) => void} [contenido.alFormarse] - Progreso 0..1 de la
 *   materialización, para que la capa aplique su propio disolvido
 * @param {() => void} [contenido.alEmpezar] - Se llama cuando el contenido
 *   empieza a formarse; el video arranca ahí y no antes
 */
export function crearEvocacion(imagen, anchorGroup, contenido) {
  const { data, width, height } = imagen
  const proporcion = height / width
  const mascara = calcularMascaraTinta(data, width, height)

  const brillo = crearBrillo(mascara, width, height, proporcion)
  const particulas = crearParticulas(mascara, width, height, proporcion)
  anchorGroup.add(brillo.malla, particulas.puntos)

  /*
    Orden explícito: la tinta encendida debajo, las partículas encima, el
    contenido al final. Los tres son transparentes y sin escritura de
    profundidad, así que sin esto Three los ordena por distancia y el orden
    cambia al mover el teléfono.
  */
  brillo.malla.renderOrder = 1
  particulas.puntos.renderOrder = 2
  contenido.objeto.renderOrder = 3

  const obj = contenido.objeto
  const escalaBase = obj.scale.clone()
  const zBase = obj.position.z

  let tiempo = 0
  let activa = false          // la secuencia ya empezó en esta aparición
  let contenidoEmpezado = false
  let perdidoDesde = null

  const aplicarForma = (p) => {
    // easeOutBack: el contenido se asoma un poco de más y se asienta, como si
    // lo empujara algo desde abajo
    const s = 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2)
    const escala = 0.35 + 0.65 * s
    obj.scale.copy(escalaBase).multiplyScalar(Math.max(0.001, escala))
    obj.position.z = zBase + ELEVACION * suave(p)
    contenido.alFormarse?.(p)
  }

  // Antes de la primera aparición el contenido no debe verse
  aplicarForma(0)

  return {
    /** El tatuaje entró en cámara. */
    mostrar() {
      const breve = perdidoDesde !== null && performance.now() - perdidoDesde < GRACIA_PERDIDA * 1000
      perdidoDesde = null
      if (activa && breve) {
        // Parpadeo del rastreo: se continúa donde iba
        if (contenidoEmpezado) contenido.alEmpezar?.({ reiniciar: false })
        return
      }
      tiempo = 0
      activa = true
      contenidoEmpezado = false
      aplicarForma(0)
    },

    /** El tatuaje salió de cámara. */
    ocultar() {
      perdidoDesde = performance.now()
    },

    /**
     * Avanza la secuencia. Se llama en cada cuadro desde el loop de render.
     * @param {number} delta - segundos desde el cuadro anterior
     * @param {number} altoPx - alto del lienzo en píxeles físicos
     */
    actualizar(delta, altoPx) {
      particulas.material.uniforms.altoPx.value = altoPx
      if (!activa) return

      // Mientras está perdido el reloj se detiene: si vuelve pronto,
      // continúa donde iba, y si no, se reinicia al volver
      if (perdidoDesde !== null) return

      // Tope por cuadro: tras una pausa larga del navegador, un delta enorme
      // saltaría la secuencia entera
      tiempo += Math.min(delta, 0.1)

      brillo.material.uniforms.tiempo.value = tiempo
      particulas.material.uniforms.tiempo.value = tiempo

      if (!contenidoEmpezado && tiempo >= T_FORMA_INICIO) {
        contenidoEmpezado = true
        contenido.alEmpezar?.({ reiniciar: true })
      }
      const p = Math.min(1, Math.max(0, (tiempo - T_FORMA_INICIO) / T_FORMA))
      aplicarForma(p)
    },

    liberar() {
      brillo.malla.geometry.dispose()
      brillo.material.dispose()
      brillo.textura.dispose()
      particulas.puntos.geometry.dispose()
      particulas.material.dispose()
      brillo.malla.parent?.remove(brillo.malla)
      particulas.puntos.parent?.remove(particulas.puntos)
    },
  }
}

/* ───────────────────── 1. La tinta se enciende ───────────────────── */

const BRILLO_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const BRILLO_FRAGMENT = `
  uniform sampler2D mascara;
  uniform float tiempo;
  uniform float proporcion;
  uniform vec3 color;
  varying vec2 vUv;

  const float T_ONDA = ${T_ONDA.toFixed(3)};
  const float T_FIN = ${T_BRILLO_FIN.toFixed(3)};

  void main() {
    float tinta = texture2D(mascara, vUv).r;
    if (tinta < 0.02) discard;

    // Distancia al centro en unidades reales (el plano no es cuadrado)
    vec2 p = (vUv - 0.5) * vec2(1.0, proporcion);
    float d = length(p);

    /*
      Frente de onda: un anillo que sale del centro. Radio máximo ~0.75 para
      cubrir las esquinas de un tatuaje vertical.
    */
    float frente = tiempo / T_ONDA * 0.75;
    float anillo = exp(-pow((d - frente) * 14.0, 2.0));

    // Lo que la onda ya tocó queda encendido y se apaga despacio
    float tocado = smoothstep(frente + 0.02, frente - 0.06, d);
    float apagado = 1.0 - smoothstep(T_ONDA, T_FIN, tiempo);
    // Pulso leve mientras el contenido se forma: la tinta "empuja"
    float pulso = 0.75 + 0.25 * sin(tiempo * 9.0);

    /*
      pow(0.6) levanta los rellenos punteados, que en la máscara quedan en
      0.3-0.6; sin eso la huella encendía el contorno y dejaba las almohadillas
      apagadas. El x2.2 compensa que la luz se suma sobre tinta casi negra.
    */
    float fuerza = pow(tinta, 0.6) * 2.2;
    float intensidad = fuerza * (anillo * 1.4 + tocado * apagado * pulso);
    if (intensidad < 0.01) discard;

    // El centro del trazo tira a blanco: se lee como luz, no como pintura
    vec3 c = mix(color, vec3(1.0), clamp(intensidad - 0.6, 0.0, 1.0));
    gl_FragColor = vec4(c * intensidad, 1.0);
  }
`

function crearBrillo(mascara, ancho, alto, proporcion) {
  /*
    La máscara viene con la fila 0 arriba y las texturas de Three leen la
    fila 0 como la de ABAJO. Se invierte aquí, una vez, en vez de voltear las
    coordenadas en el sombreador.
  */
  const bytes = new Uint8Array(ancho * alto * 4)
  for (let y = 0; y < alto; y++) {
    const origen = (alto - 1 - y) * ancho
    for (let x = 0; x < ancho; x++) {
      const v = Math.round(mascara[origen + x] * 255)
      bytes.set([v, v, v, 255], (y * ancho + x) * 4)
    }
  }
  /*
    RGBA aunque solo se use un canal: con LuminanceFormat la textura llegaba
    vacía en WebGL2 sin ningún error en consola, y la tinta nunca se encendía.
    RGBA + UnsignedByte es el único formato garantizado en WebGL1 y WebGL2.
  */
  const textura = new THREE.DataTexture(bytes, ancho, alto, THREE.RGBAFormat)
  textura.magFilter = THREE.LinearFilter
  textura.minFilter = THREE.LinearFilter
  textura.needsUpdate = true

  const material = new THREE.ShaderMaterial({
    uniforms: {
      mascara: { value: textura },
      tiempo: { value: 0 },
      proporcion: { value: proporcion },
      color: { value: COLOR_TINTA.clone() },
    },
    vertexShader: BRILLO_VERTEX,
    fragmentShader: BRILLO_FRAGMENT,
    transparent: true,
    // Aditivo: la luz se SUMA a la piel de la cámara. Sobre tinta negra el
    // trazo queda violeta; sobre piel clara apenas se nota fuera del trazo.
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })

  // El ancla de MindAR mide 1 de ancho y `proporcion` de alto, centrada
  const malla = new THREE.Mesh(new THREE.PlaneGeometry(1, proporcion), material)
  malla.position.z = 0.002
  return { malla, material, textura }
}

/* ───────────────────── 2 y 3. La tinta se levanta ───────────────────── */

const PARTICULAS_VERTEX = `
  attribute vec3 destino;
  attribute float retraso;
  attribute float semilla;
  uniform float tiempo;
  uniform float altoPx;
  varying float vVida;
  varying float vSemilla;

  const float T_VIDA = ${T_PARTICULA.toFixed(3)};

  void main() {
    float t = clamp((tiempo - retraso) / T_VIDA, 0.0, 1.0);
    vVida = (tiempo < retraso) ? -1.0 : t;
    vSemilla = semilla;

    /*
      Trayectoria: sube recto de la piel y luego se curva hacia su destino.
      Curva de Bézier cuadrática con el punto de control encima del origen, así
      la partícula primero "se despega" y después viaja.
    */
    vec3 origen = position;
    vec3 control = vec3(origen.xy, destino.z * 2.2);
    float e = t * t * (3.0 - 2.0 * t);
    vec3 p = mix(mix(origen, control, e), mix(control, destino, e), e);

    // Remolino alrededor del eje del tatuaje, que se cierra al llegar
    float ang = (1.0 - e) * (semilla - 0.5) * 2.5 * e;
    p.xy = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xy;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    /*
      Tamaño en píxeles a partir de un tamaño en el mundo. El ancla de MindAR
      viene escalada al ancho del marcador en px (cientos de unidades), así
      que la escala se lee de la propia matriz en vez de suponerla.
    */
    float escalaAncla = length(modelMatrix[0].xyz);
    float tam = mix(0.016, 0.006, t) * (0.6 + semilla * 0.8);
    gl_PointSize = tam * escalaAncla * projectionMatrix[1][1] * altoPx * 0.5 / max(abs(mv.z), 0.0001);
  }
`

const PARTICULAS_FRAGMENT = `
  uniform vec3 color;
  varying float vVida;
  varying float vSemilla;

  void main() {
    if (vVida < 0.0 || vVida >= 1.0) discard;
    // Punto redondo y suave
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float nucleo = pow(1.0 - r * 2.0, 1.8);

    // Entran rápido y se desvanecen al fundirse con el contenido
    float alfa = smoothstep(0.0, 0.12, vVida) * (1.0 - smoothstep(0.65, 1.0, vVida));
    vec3 c = mix(color, vec3(1.0), 0.25 + 0.35 * vSemilla);
    gl_FragColor = vec4(c * nucleo * alfa, 1.0);
  }
`

function crearParticulas(mascara, ancho, alto, proporcion) {
  const puntos = muestrearPuntosDeTinta(mascara, ancho, alto, N_PARTICULAS)
  const n = puntos.length
  const posiciones = new Float32Array(n * 3)
  const destinos = new Float32Array(n * 3)
  const retrasos = new Float32Array(n)
  const semillas = new Float32Array(n)

  // Mismo azar determinista que el muestreo, para destinos repetibles
  let s = 1234567
  const azar = () => ((s = (s * 16807) % 2147483647) / 2147483647)

  puntos.forEach((pt, i) => {
    const x = pt.u - 0.5
    const y = (pt.v - 0.5) * proporcion
    posiciones.set([x, y, 0.004], i * 3)

    /*
      Destino: una nube elíptica al centro, a la altura a la que flota el
      contenido. Es donde el sujeto se va a formar, así que las partículas
      parecen construirlo.
    */
    const a = azar() * Math.PI * 2
    const r = Math.sqrt(azar())
    destinos.set([Math.cos(a) * r * 0.22, Math.sin(a) * r * 0.3, ELEVACION], i * 3)

    // Cada partícula sale cuando la onda de brillo pasa por su punto
    const d = Math.hypot(x, y)
    retrasos[i] = (d / 0.75) * T_ONDA * 0.9 + azar() * 0.12
    semillas[i] = azar()
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3))
  geo.setAttribute('destino', new THREE.BufferAttribute(destinos, 3))
  geo.setAttribute('retraso', new THREE.BufferAttribute(retrasos, 1))
  geo.setAttribute('semilla', new THREE.BufferAttribute(semillas, 1))

  const material = new THREE.ShaderMaterial({
    uniforms: {
      tiempo: { value: 0 },
      altoPx: { value: 1000 },
      color: { value: COLOR_TINTA.clone() },
    },
    vertexShader: PARTICULAS_VERTEX,
    fragmentShader: PARTICULAS_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  const puntosMalla = new THREE.Points(geo, material)
  // Las posiciones se mueven en el sombreador; el cálculo de visibilidad de
  // Three solo ve las de origen y podría descartar la nube por error
  puntosMalla.frustumCulled = false
  return { puntos: puntosMalla, material }
}

function suave(t) {
  return t * t * (3 - 2 * t)
}

import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/**
 * Visor de modelos 3D sin AR — herramienta de desarrollo.
 *
 * PARA QUÉ SIRVE:
 * Revisar un GLB (colores, texturas, animaciones, escala) sin necesitar un
 * tatuaje compilado, cámara ni backend. Cuando un modelo no se ve bien en AR,
 * aquí se puede aislar si el problema es del modelo o del tracking.
 *
 * Usa el MISMO setup de carga que el ARViewer (DRACOLoader + luces equivalentes)
 * para que lo que se ve aquí sea representativo de lo que se verá sobre el tatuaje.
 *
 * Uso: /preview?model=/models/shiba_negro.glb
 */

const MODELS = [
  { label: 'Shiba negro', url: '/models/shiba_negro.glb' },
  { label: 'Malamute', url: '/models/alaskan_malamute_dog.glb' },
  { label: 'Fénix', url: '/models/Fenix.glb' },
  { label: 'Dr. Simi', url: '/models/farmacias_similares.glb' },
]

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')

export default function ModelPreview() {
  const [searchParams, setSearchParams] = useSearchParams()
  const modelUrl = searchParams.get('model') ?? MODELS[0].url

  const containerRef = useRef(null)
  const [animations, setAnimations] = useState([])
  const [activeAnim, setActiveAnim] = useState('')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  // Refs al estado de Three.js que necesitan los handlers fuera del efecto
  const mixerRef = useRef(null)
  const actionsRef = useRef({})
  const currentRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let frameId = null

    const scene = new THREE.Scene()
    // Gris medio a propósito: con fondo negro un modelo negro (como el shiba)
    // es imposible de inspeccionar, y con fondo blanco se pierden las zonas claras
    scene.background = new THREE.Color(0x4a4a4a)

    const camera = new THREE.PerspectiveCamera(
      45, container.clientWidth / container.clientHeight, 0.01, 100
    )
    camera.position.set(0, 0.3, 2)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0, 0, 0)

    // Mismas luces que el ARViewer para que el preview sea representativo
    scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    const dir = new THREE.DirectionalLight(0xffffff, 1.5)
    dir.position.set(1, 3, 2)
    scene.add(dir)

    const clock = new THREE.Clock()
    const loader = new GLTFLoader()
    loader.setDRACOLoader(dracoLoader)

    setStatus('loading')
    setError('')
    setAnimations([])
    actionsRef.current = {}
    currentRef.current = null

    loader.load(
      modelUrl,
      (gltf) => {
        if (disposed) return
        const model = gltf.scene

        // Mismo auto-escalado y centrado que el ARViewer, para que el tamaño
        // relativo que se ve aquí corresponda al que se verá sobre el tatuaje
        const bbox = new THREE.Box3().setFromObject(model)
        const size = bbox.getSize(new THREE.Vector3())
        const center = bbox.getCenter(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = maxDim > 0 ? 1 / maxDim : 1
        model.scale.setScalar(scale)
        model.position.copy(center).multiplyScalar(-scale)
        scene.add(model)

        if (gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model)
          mixerRef.current = mixer
          gltf.animations.forEach((clip) => {
            actionsRef.current[clip.name] = mixer.clipAction(clip)
          })
          const first = gltf.animations[0].name
          actionsRef.current[first].play()
          currentRef.current = actionsRef.current[first]
          setActiveAnim(first)
          setAnimations(gltf.animations.map((c) => c.name))
        }

        clock.start()
        setStatus('ready')
      },
      undefined,
      (err) => {
        if (disposed) return
        setStatus('error')
        setError(err?.message ?? 'No se pudo cargar el modelo')
      }
    )

    const animate = () => {
      frameId = requestAnimationFrame(animate)
      const delta = clock.getDelta()
      if (mixerRef.current) mixerRef.current.update(delta)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      if (!container.clientWidth) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      disposed = true
      if (frameId) cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      // Liberar GPU: sin esto, cambiar de modelo varias veces agota el contexto WebGL
      scene.traverse((o) => {
        if (o.isMesh) {
          o.geometry?.dispose()
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          mats.forEach((m) => {
            Object.values(m ?? {}).forEach((v) => v?.isTexture && v.dispose())
            m?.dispose?.()
          })
        }
      })
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
      mixerRef.current = null
    }
  }, [modelUrl])

  const playAnimation = (name) => {
    const next = actionsRef.current[name]
    if (!next || next === currentRef.current) return
    currentRef.current?.fadeOut(0.3)
    next.reset().fadeIn(0.3).play()
    currentRef.current = next
    setActiveAnim(name)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link to="/" className="text-gray-500 hover:text-white text-sm">← Inicio</Link>
        <h1 className="font-semibold">Visor de modelos</h1>
      </div>

      {/* Selector de modelo del catálogo */}
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        {MODELS.map((m) => (
          <button
            key={m.url}
            onClick={() => setSearchParams({ model: m.url })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
              ${modelUrl === m.url
                ? 'bg-white text-black border-white'
                : 'bg-gray-900 text-gray-300 border-gray-700 hover:border-gray-500'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="flex-1 min-h-[60vh] relative">
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
            Cargando modelo...
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <div>
              <p className="text-red-400 font-medium mb-1">No se pudo cargar</p>
              <p className="text-gray-500 text-sm">{error}</p>
            </div>
          </div>
        )}
      </div>

      {animations.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 px-4 py-4">
          {animations.map((name) => (
            <button
              key={name}
              onClick={() => playAnimation(name)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all
                ${activeAnim === name
                  ? 'bg-white text-black border-white'
                  : 'bg-gray-900 text-white border-gray-600'}`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-gray-600 text-xs pb-4">
        Arrastra para rotar · rueda o pellizca para zoom
      </p>
    </div>
  )
}

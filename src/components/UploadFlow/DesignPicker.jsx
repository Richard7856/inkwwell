/**
 * Selector de diseño GLB del catálogo.
 * Phase 1: lista estática hardcodeada.
 * Phase 2: carga dinámica desde tabla `designs` en Supabase.
 */

// Catálogo de Phase 1 — assets disponibles en /public/models/
// Phase 2: esta lista se carga dinámicamente desde la tabla `designs` en Supabase
const CATALOG = [
  {
    id: 'malamute',
    name: 'Alaskan Malamute',
    description: 'Perro rigged con animaciones de trote y rascado',
    glbUrl: '/models/alaskan_malamute_dog.glb',
    tier: 'catalog',
    emoji: '🐕',
  },
  {
    id: 'fenix',
    name: 'Fénix',
    description: 'Criatura mítica con 5 animaciones: parado, ataque y más',
    glbUrl: '/models/Fenix.glb',
    tier: 'catalog',
    emoji: '🦅',
  },
  /*
    Farmacia del Dr. Simi — temporalmente oculto del picker.

    Por qué se quita del catálogo:
    El GLB es una escena COMPLETA exportada desde Cinema 4D, no un personaje suelto.
    Tiene dos problemas técnicos que no se resuelven con tuning rápido de scale/autoPlay:

    1. La animación "CINEMA_4D_Main" es una animación de cámara/timeline de C4D.
       Three.js la interpreta como transformaciones de objetos y los manda fuera del frame.
       Sin reproducirla, el modelo queda en su "rest pose" de C4D — también mal posicionado.

    2. El bbox del modelo está dominado por el piso/letreros. El personaje (Dr. Simi)
       es ~5% del bbox total → microscópico al normalizar. Subir el scaleMultiplier
       lo agranda pero también agranda el piso, no resuelve el ratio.

    Solución pendiente (post-demo): extraer solo los meshes simi_body_*, simi_bigote_0,
    simi_eyes_0 con gltf-transform y re-exportar como personaje aislado.

    Mientras tanto, el GLB sigue en /public/models/ y MODEL_CONFIGS en useThreeScene.js
    sigue teniendo su entry — listos para reactivarlo cuando esté el fix real.
  */
  // {
  //   id: 'farmacia-simi',
  //   name: 'Farmacia del Dr. Simi',
  //   description: 'Escena 3D completa con el Dr. Simi en su farmacia',
  //   glbUrl: '/models/farmacias_similares.glb',
  //   tier: 'catalog',
  //   emoji: '🏥',
  // },
]

export default function DesignPicker({ onDesignSelected }) {
  return (
    <div>
      <p className="text-gray-400 mb-6">Elige el diseño 3D para tu tatuaje</p>

      <div className="grid gap-4">
        {CATALOG.map((design) => (
          <button
            key={design.id}
            onClick={() => onDesignSelected(design)}
            className="bg-white/5 rounded-2xl p-5 border border-white/10 text-left
                       hover:bg-white/10 hover:border-white/20 transition-all active:scale-95"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{design.emoji}</span>
              <div>
                <h3 className="font-semibold text-lg">{design.name}</h3>
                <p className="text-gray-400 text-sm mt-0.5">{design.description}</p>
              </div>
            </div>
            <span className="inline-block mt-3 text-xs bg-white/10 px-3 py-1 rounded-full text-gray-300">
              {design.tier}
            </span>
          </button>
        ))}
      </div>

      <p className="text-gray-600 text-xs text-center mt-6">
        Más diseños disponibles próximamente
      </p>
    </div>
  )
}

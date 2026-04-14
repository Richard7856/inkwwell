/**
 * Selector de diseño GLB del catálogo.
 * Phase 1: lista estática hardcodeada.
 * Phase 2: carga dinámica desde tabla `designs` en Supabase.
 */

// Catálogo de Phase 1 — assets disponibles en /public/models/
const CATALOG = [
  {
    id: 'malamute',
    name: 'Alaskan Malamute',
    description: 'Perro 3D con animaciones de trote y rascado',
    glbUrl: '/models/alaskan_malamute_dog.glb',
    tier: 'catalog',
  },
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
                       hover:bg-white/10 hover:border-white/20 transition-all"
          >
            <h3 className="font-semibold text-lg">{design.name}</h3>
            <p className="text-gray-400 text-sm mt-1">{design.description}</p>
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

"""Render de Zero sobre verde plano, para usarlo de ENTRADA de image-to-video."""
import bpy, math, sys
from mathutils import Vector

glb, salida = sys.argv[-2:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)

mallas = [o for o in bpy.data.objects if o.type == 'MESH']
pts = [o.matrix_world @ v.co for o in mallas for v in o.data.vertices]
lo = Vector((min(p[i] for p in pts) for i in range(3)))
hi = Vector((max(p[i] for p in pts) for i in range(3)))
centro = (lo + hi) / 2
tam = hi - lo

# ── de qué lado está la cabeza ──
# Se buscaba a ojo y salía cortada. La cabeza es el grupo de vértices más ALTO:
# se toma el 4% superior y se mira hacia qué extremo del eje largo cae su centro.
# En este modelo la cabeza Y la cola están levantadas, así que "el 4% más alto"
# no distingue una de otra de forma fiable. Se deja el lado como argumento y se
# miran los dos renders: dos minutos de cómputo contra una heurística que puede
# mentir en silencio.
frente = float(sys.argv[-3])
print(f"### tam {tuple(round(x,2) for x in tam)} · frente {frente:+.0f}Y")

esc = bpy.context.scene
esc.render.engine = 'CYCLES'
esc.cycles.device = 'CPU'
esc.cycles.samples = 200
esc.cycles.use_denoising = True
esc.render.resolution_x, esc.render.resolution_y = 768, 1364
# Standard y no Filmic: Filmic desatura y aplana, y el primer intento salió con
# el pelo negro leído como gris verdoso. Aquí se quiere que el negro sea negro.
esc.view_settings.view_transform = 'Standard'

# ── el fondo verde NO debe iluminar al perro ──
# Con un mundo verde a secas, ese verde rebota sobre el pelaje y el negro de
# Zero se lee gris verdoso: exactamente lo que arruinó el primer intento. Y es
# peor de lo que parece, porque el recorte de croma de la app mide crominancia
# —un pelo teñido de verde se le parece al fondo y se recorta con él.
#
# Se separa con Light Path: el rayo que viene de la CÁMARA ve verde; cualquier
# otro rayo (los que iluminan) ve un gris neutro. Así el fondo es verde en la
# imagen y no aporta color a la luz.
mundo = bpy.data.worlds.new('w'); esc.world = mundo
mundo.use_nodes = True
nt = mundo.node_tree
for n in list(nt.nodes):
    if n.type != 'OUTPUT_WORLD':
        nt.nodes.remove(n)
salida_mundo = next(n for n in nt.nodes if n.type == 'OUTPUT_WORLD')
verde = nt.nodes.new('ShaderNodeBackground')
verde.inputs[0].default_value = (0.11, 0.55, 0.18, 1)
neutro = nt.nodes.new('ShaderNodeBackground')
neutro.inputs[0].default_value = (0.05, 0.05, 0.05, 1)
mezcla = nt.nodes.new('ShaderNodeMixShader')
camino = nt.nodes.new('ShaderNodeLightPath')
nt.links.new(camino.outputs['Is Camera Ray'], mezcla.inputs[0])
nt.links.new(neutro.outputs[0], mezcla.inputs[1])
nt.links.new(verde.outputs[0], mezcla.inputs[2])
nt.links.new(mezcla.outputs[0], salida_mundo.inputs['Surface'])

d = max(tam)
def luz(nombre, energia, pos, tamano):
    ld = bpy.data.lights.new(nombre, 'AREA'); ld.energy = energia; ld.size = tamano
    o = bpy.data.objects.new(nombre, ld); esc.collection.objects.link(o)
    o.location = centro + Vector(pos)
    o.rotation_euler = (centro - o.location).to_track_quat('-Z', 'Y').to_euler()

# Menos potencia que el primer intento, que quemaba el pecho blanco.
luz('clave',   d*d*40, ( d*1.4,  d*1.5*frente,  d*0.8), d*1.4)
luz('relleno', d*d*14,  (-d*1.7,  d*0.9*frente,  d*0.3), d*2.0)
luz('contra',  d*d*20, (-d*0.5, -d*1.9*frente,  d*1.1), d*1.2)

cd = bpy.data.cameras.new('cam')
cd.type = 'PERSP'; cd.lens = 85; cd.sensor_fit = 'VERTICAL'; cd.clip_end = d*80
cam = bpy.data.objects.new('cam', cd); esc.collection.objects.link(cam); esc.camera = cam

# ── distancia calculada, no adivinada ──
# El primer intento se puso "d*3.2" a ojo y el hocico quedó fuera. Aquí se
# resuelve la distancia a la que la caja envolvente cabe con margen, en los DOS
# ejes, y se toma la más lejana.
fov_v = 2 * math.atan(cd.sensor_height / 2 / cd.lens)
fov_h = 2 * math.atan((cd.sensor_height * 768 / 1364) / 2 / cd.lens)
MARGEN = 1.12                       # 30% de aire alrededor: sitio a donde caminar
radio = max(tam) / 2
dist = max(radio * MARGEN / math.tan(fov_v / 2), radio * MARGEN / math.tan(fov_h / 2))

# Tres cuartos DELANTERO: se ve la cara y el cuerpo entero. El perfil puro pierde
# la mirada, y la mirada es lo que hace que alguien reconozca a SU perro.
ang = math.radians(38)
cam.location = centro + Vector((math.sin(ang) * dist, math.cos(ang) * dist * frente, tam.z * 0.06))
cam.rotation_euler = (centro - cam.location).to_track_quat('-Z', 'Y').to_euler()
print(f"### distancia {dist:.2f} (radio {radio:.2f})")

esc.render.filepath = salida
bpy.ops.render.render(write_still=True)
print("### listo", salida)

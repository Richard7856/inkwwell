#!/usr/bin/env python3
"""
Malla estática de Meshy + esqueleto de perro que ya trae el repo → GLB animado.

── El problema que resuelve ──
Meshy devuelve una malla excelente y un esqueleto inservible: su rig es
humanoide (su propia documentación admite que "non-bipeds (animals, objects)
may rig poorly") y sus 678 animaciones son de bípedo. Un perro rigeado como
persona sale deforme. Por eso `worker/meshy.js` no rigea por omisión.

── Por qué no hay que arreglar ese esqueleto ──
Porque ya tenemos uno bueno. `public/models/shiba_negro.glb` trae 191 huesos
con anatomía de cuadrúpedo de verdad —hombro/codo/muñeca adelante,
cadera/rodilla/tobillo atrás, siete de cola— y cinco animaciones de perro
(sentarse, sacudirse, echarse, rodar, de pie). Y no es un archivo cualquiera:
es el que la app YA carga en AR (`src/components/ARViewer/targetLoader.js`).
Si Zero sale con ESE esqueleto, se sabe de antemano que el visor lo reproduce.

Rigear desde cero es pintar pesos a mano sobre 22 mil vértices. Esto no rigea:
copia los pesos que el donante ya tiene bien pintados, por cercanía de
superficie, una vez que las dos mallas están alineadas.

── Lo único que hay que hacer a mano ──
La cola. El resto de la anatomía canina coincide entre perros; la cola no —la
del shiba se enrosca sobre el lomo y la de Zero sale recta— así que la copia
por cercanía la desgarra. Se rehace repartiendo la cola del destino a lo largo
de la cadena de huesos según su propia distancia a la raíz.

── Uso ──
    blender --background --python scripts/rigear-mascota.py -- \
        --malla brand/3d/zero-optimizado.glb \
        --donante public/models/shiba_negro.glb \
        --salida public/models/zero-animado.glb

También corre con el módulo `bpy` de PyPI (pip install bpy), sin Blender:
    python scripts/rigear-mascota.py --malla ... --donante ... --salida ...

── Licencia: NO es opcional ──
Los dos esqueletos donantes del repo son CC-BY-4.0. Usarlos comercialmente
está permitido; usarlos SIN CRÉDITO no. Ver brand/3d/CREDITOS.md.
"""

import argparse
import math
import os
import sys

import bpy
from mathutils import Vector

# Presupuesto de tamaño: los modelos que la app ya baja pesan de 0.6 a 1.8 MB,
# y el AR los descarga ANTES de poder mostrar nada. Mismo límite que meshy-cli.js.
LIMITE_MB = 4.0


def argumentos():
    crudo = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser(description='Malla estática + esqueleto donante → GLB animado')
    p.add_argument('--malla', required=True, help='GLB sin esqueleto (salida de Meshy)')
    p.add_argument('--donante', required=True, help='GLB con esqueleto y animaciones')
    p.add_argument('--salida', required=True, help='GLB a escribir')
    p.add_argument('--escala', choices=['alto', 'largo'], default='alto',
                   help='qué medida se iguala entre las dos mallas (por omisión alto: '
                        'las patas tienen que llegar al suelo donde el hueso las espera)')
    p.add_argument('--cola', choices=['rigida', 'cadena', 'ninguna'], default='rigida',
                   help='cómo rehacer los pesos de la cola (ver rehacer_cola)')
    p.add_argument('--animaciones', default='',
                   help='lista separada por comas: solo se exportan las animaciones cuyo '
                        'nombre contenga alguna. Vacío = todas')
    p.add_argument('--render', metavar='DIR', help='además, una tira de cuadros para revisar')
    p.add_argument('--accion', default='', help='qué animación renderizar (subcadena del nombre)')
    return p.parse_args(crudo)


def caja(obj):
    """
    Caja envolvente en coordenadas de mundo, medida sobre los VÉRTICES.

    Lo natural sería usar `obj.bound_box`, que es justo eso y ya viene calculado.
    No sirve: Blender lo cachea y en una malla importada de glTF con esqueleto
    puede quedar desfasado del contenido real. Medido sobre el malamute de
    Sketchfab, `bound_box` daba (1.7, 4.7, 2.4) donde los vértices daban
    (158.0, 5.1, 153.8) — un factor de casi 90, suficiente para que el alineado
    escalara la malla a un tamaño absurdo y todo lo demás fuera basura.

    Recorrer los vértices cuesta microsegundos en mallas de este tamaño y no
    depende de ninguna caché.
    """
    lo = Vector((1e9,) * 3)
    hi = Vector((-1e9,) * 3)
    m = obj.matrix_world
    for v in obj.data.vertices:
        w = m @ v.co
        lo = Vector((min(lo[i], w[i]) for i in range(3)))
        hi = Vector((max(hi[i], w[i]) for i in range(3)))
    return lo, hi


def profundidad(hueso):
    d = 0
    while hueso.parent:
        hueso = hueso.parent
        d += 1
    return d


def rehacer_cola(zero, arm, modo):
    """
    Rehace los pesos de la cola, que es el único sitio donde la copia falla.

    La copia por cercanía asigna cada vértice al hueso que le queda más cerca en
    el espacio. Eso acierta donde las dos anatomías coinciden —lomo, patas,
    cuello— y falla justo en la cola: la del shiba se enrosca sobre el lomo y la
    de Zero sale recta hacia atrás, así que cada vértice cae cerca de un hueso
    que apunta a otro lado. Sin este arreglo la cola sale desgarrada.

    Dos formas de rehacerla, y la rígida es la que sale bien:

    · `rigida` — toda la cola cuelga del primer hueso de la cadena. Ese hueso
      nace donde nace la cola de verdad, así que el brazo de palanca es corto y
      la cola conserva su forma: gira entera desde la base, como una cola.

    · `cadena` — se reparte a lo largo de los siete huesos según la distancia de
      cada vértice a la raíz. Suena mejor y sale peor: los huesos 4 a 7 del
      shiba viven ENCIMA del lomo, no detrás, y hacer girar un vértice de Zero
      alrededor de un punto que le queda lejos lo manda a volar. El resultado es
      una cuchilla plana en lugar de una cola. Queda como opción por si algún
      día el donante tiene la cola extendida.
    """
    cadena = [b for b in arm.data.bones
              if 'tail' in b.name.lower() and 'end' not in b.name.lower()]
    cadena.sort(key=profundidad)
    if len(cadena) < 2:
        return 0

    grupos = [g for g in (zero.vertex_groups.get(b.name) for b in cadena) if g]
    if len(grupos) < 2:
        return 0

    indices_cola = {g.index for g in zero.vertex_groups if 'tail' in g.name.lower()}
    raiz = arm.matrix_world @ cadena[0].head_local
    mundo = zero.matrix_world

    de_la_cola = []
    for v in zero.data.vertices:
        if not v.groups:
            continue
        dominante = max(v.groups, key=lambda g: g.weight)
        if dominante.group in indices_cola:
            de_la_cola.append((v.index, (mundo @ v.co - raiz).length))
    if not de_la_cola:
        return 0

    solo_cola = [i for i, _ in de_la_cola]
    for g in zero.vertex_groups:
        g.remove(solo_cola)

    if modo == 'rigida':
        grupos[0].add(solo_cola, 1.0, 'REPLACE')
        return len(de_la_cola)

    lejano = max(d for _, d in de_la_cola) or 1.0
    ultimo = len(grupos) - 1
    for i, d in de_la_cola:
        t = min(max(d / lejano, 0.0), 1.0) * ultimo
        bajo = int(t)
        alto = min(bajo + 1, ultimo)
        f = t - bajo
        grupos[bajo].add([i], 1.0 - f, 'REPLACE')
        if f > 0:
            grupos[alto].add([i], f, 'REPLACE')
    return len(de_la_cola)


def tira_de_cuadros(arm, donante_tam, centro, carpeta, subcadena):
    """Seis cuadros de una animación, para poder mirar el resultado sin abrir Blender."""
    os.makedirs(carpeta, exist_ok=True)
    acciones = list(bpy.data.actions)
    accion = next((a for a in acciones if subcadena.lower() in a.name.lower()), acciones[0]) \
        if acciones else None
    if accion is None:
        return
    if not arm.animation_data:
        arm.animation_data_create()
    arm.animation_data.action = accion
    # Blender 4.4+ guarda las curvas en "slots"; sin elegir uno la acción no suena
    if hasattr(arm.animation_data, 'action_slot') and accion.slots:
        arm.animation_data.action_slot = accion.slots[0]

    esc = bpy.context.scene
    esc.render.engine = 'CYCLES'          # Cycles no necesita OpenGL: corre sin pantalla
    esc.cycles.device = 'CPU'
    esc.cycles.samples = 16
    esc.render.resolution_x = esc.render.resolution_y = 480

    mundo = bpy.data.worlds.new('w')
    esc.world = mundo
    mundo.use_nodes = True
    mundo.node_tree.nodes['Background'].inputs[0].default_value = (0.05, 0.05, 0.06, 1)
    for rot, energia in (((50, 0, 35), 4.0), ((70, 0, -140), 1.5)):
        d = bpy.data.lights.new('l', 'SUN')
        d.energy = energia
        o = bpy.data.objects.new('l', d)
        esc.collection.objects.link(o)
        o.rotation_euler = tuple(math.radians(x) for x in rot)

    # Vista lateral limpia: es el único ángulo donde se lee si las patas doblan
    # bien. Ortográfica para que no haya perspectiva que disimule una deformación.
    radio = max(donante_tam)
    cd = bpy.data.cameras.new('cam')
    cd.type = 'ORTHO'
    cd.ortho_scale = radio * 1.25
    cd.clip_end = radio * 10   # la escena del donante mide decenas de unidades
    cam = bpy.data.objects.new('cam', cd)
    esc.collection.objects.link(cam)
    esc.camera = cam
    cam.location = centro + Vector((radio * 2, 0, 0))
    cam.rotation_euler = (math.radians(90), 0, math.radians(90))

    ini, fin = (int(v) for v in accion.frame_range)
    for n in range(6):
        esc.frame_set(ini + round((fin - ini) * n / 5))
        esc.render.filepath = os.path.join(carpeta, f'cuadro-{n}.png')
        bpy.ops.render.render(write_still=True)
    print(f'   tira      {carpeta}  ({accion.name}, cuadros {ini}-{fin})')


def main():
    a = argumentos()
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # ── 1. el donante ──
    bpy.ops.import_scene.gltf(filepath=a.donante)
    arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    if arm is None:
        sys.exit(f'El donante {a.donante} no trae esqueleto.')
    donante = max((o for o in bpy.data.objects if o.type == 'MESH'),
                  key=lambda o: len(o.data.vertices))
    acciones = [x.name for x in bpy.data.actions]
    print(f'\n  donante   {os.path.basename(a.donante)}')
    print(f'            {len(arm.data.bones)} huesos · {len(donante.data.vertices)} vértices · '
          f'{len(acciones)} animaciones')
    print(f'            {", ".join(acciones)}')

    # Los pesos del donante corresponden a su esqueleto SIN animar. Si se copian
    # con la armadura en pose, se copia la deformación del cuadro 1 encima.
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()

    # ── 2. la malla a rigear ──
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=a.malla)
    llegaron = set(bpy.data.objects) - antes
    nuevos = [o for o in llegaron if o.type == 'MESH']
    if not nuevos:
        sys.exit(f'{a.malla} no trae ninguna malla.')
    zero = max(nuevos, key=lambda o: len(o.data.vertices))
    print(f'  malla     {os.path.basename(a.malla)} · {len(zero.data.vertices)} vértices')
    if len(nuevos) > 1:
        # Meshy entrega una sola malla; un modelo de catálogo llega partido en
        # cuerpo, ojos, collar… y a veces con más de un animal en el archivo.
        # Se queda la más grande, que casi siempre es el cuerpo, PERO eso tira
        # las demás partes en silencio si no se avisa.
        otras = sorted((len(o.data.vertices) for o in nuevos if o is not zero), reverse=True)
        print(f'  AVISO     el archivo trae {len(nuevos)} mallas; se usa solo la mayor. '
              f'Las otras: {otras[:6]}{"…" if len(otras) > 6 else ""}')

    # ── 2b. desarmar lo que la malla traiga puesto ──
    #
    # Una malla recién salida de Meshy llega limpia, pero cualquier modelo
    # bajado de Sketchfab —o un intento anterior de rigeo— llega con esqueleto,
    # modificador, padre y grupos de vértices propios. Si no se quitan pasan
    # tres cosas, y las tres se vieron al probar con el malamute:
    #
    #   · la caja envolvente sale deformada, porque se mide sobre la malla YA
    #     deformada por su propia armadura en el cuadro 1, no sobre su geometría
    #     de reposo. El alineado dio (5183, 6606, 915) contra (34, 114, 83);
    #   · la copia de pesos agrega los grupos del donante a los que ya tenía:
    #     231 grupos donde debían ser 191, con los viejos compitiendo por los
    #     mismos vértices;
    #   · el objeto acaba con dos modificadores Armature y se deforma dos veces.
    #
    # Se desarma antes de tocar nada. Lo que se tira es el rig, no la malla.
    # El ORDEN importa y ya costó una ronda: hay que copiar la matriz de mundo
    # ANTES de borrar nada. Borrar un padre desemparenta al hijo y le deja su
    # matriz local, así que la contribución del padre —que en un glTF de
    # Sketchfab suele traer toda la escala— se pierde antes de poder guardarla.
    mundo = zero.matrix_world.copy()
    sobrantes = [o for o in llegaron if o is not zero]
    for o in sobrantes:
        bpy.data.objects.remove(o, do_unlink=True)
    zero.parent = None
    zero.matrix_world = mundo
    zero.modifiers.clear()
    zero.vertex_groups.clear()
    zero.animation_data_clear()
    if zero.data.shape_keys:
        zero.shape_key_clear()
    bpy.context.view_layer.update()
    if sobrantes:
        print(f'  desarmada {len(sobrantes)} objeto(s) que traía la malla '
              f'(esqueleto o rig previo) y sus grupos de vértices')

    # ── 3. alinear ──
    dlo, dhi = caja(donante)
    zlo, zhi = caja(zero)
    dtam, ztam = dhi - dlo, zhi - zlo
    k = (dtam.z / ztam.z) if a.escala == 'alto' else (dtam.y / ztam.y)
    zero.scale = (k, k, k)
    bpy.context.view_layer.update()

    zlo, zhi = caja(zero)
    # Mismo suelo y mismo centro en planta: las patas tienen que nacer donde el
    # hueso las espera, y el suelo es la referencia que las dos mallas comparten.
    zero.location += Vector(((dlo.x + dhi.x) / 2 - (zlo.x + zhi.x) / 2,
                             (dlo.y + dhi.y) / 2 - (zlo.y + zhi.y) / 2,
                             dlo.z - zlo.z))
    bpy.context.view_layer.update()
    zlo, zhi = caja(zero)
    print(f'  alineado  escala ×{k:.2f} por {a.escala} · '
          f'{tuple(round(v, 1) for v in (zhi - zlo))} contra {tuple(round(v, 1) for v in dtam)}')

    bpy.ops.object.select_all(action='DESELECT')
    zero.select_set(True)
    bpy.context.view_layer.objects.active = zero
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # ── 4. copiar los pesos ──
    bpy.ops.object.select_all(action='DESELECT')
    donante.select_set(True)
    zero.select_set(True)
    bpy.context.view_layer.objects.active = donante
    bpy.ops.object.data_transfer(
        data_type='VGROUP_WEIGHTS',
        use_create=True,
        vert_mapping='POLYINTERP_NEAREST',
        layers_select_src='ALL',
        layers_select_dst='NAME',
    )
    huerfanos = sum(1 for v in zero.data.vertices if not v.groups)
    print(f'  pesos     {len(zero.vertex_groups)} grupos copiados · '
          f'{huerfanos} vértices sin peso')
    if huerfanos:
        # Un vértice sin peso se queda clavado en el origen mientras el resto se
        # mueve: es un desgarro visible, no un detalle.
        print(f'            AVISO: esos {huerfanos} vértices van a desgarrar la malla')

    if a.cola != 'ninguna':
        n = rehacer_cola(zero, arm, a.cola)
        print(f'  cola      {n} vértices · modo {a.cola}')

    # ── 5. amarrar al esqueleto ──
    zero.parent = arm
    zero.matrix_parent_inverse = arm.matrix_world.inverted()
    zero.modifiers.new('Armature', 'ARMATURE').object = arm
    arm.data.pose_position = 'POSE'

    # El donante ya cumplió: si se queda, su malla y su textura viajan en el GLB
    bpy.data.objects.remove(donante, do_unlink=True)

    if a.render:
        tira_de_cuadros(arm, dtam, (dlo + dhi) / 2, a.render, a.accion)

    # ── 6. exportar ──
    bpy.ops.object.select_all(action='DESELECT')
    zero.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    os.makedirs(os.path.dirname(os.path.abspath(a.salida)) or '.', exist_ok=True)
    if a.animaciones:
        quiero = [x.strip().lower() for x in a.animaciones.split(',') if x.strip()]
        for accion in list(bpy.data.actions):
            if not any(q in accion.name.lower() for q in quiero):
                bpy.data.actions.remove(accion)
        print(f'  animación {", ".join(x.name for x in bpy.data.actions)}')

    bpy.ops.export_scene.gltf(
        filepath=a.salida,
        export_format='GLB',
        use_selection=True,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_skins=True,
        export_apply=False,
        # El visor de la app ya monta DRACOLoader (useThreeScene.js) porque
        # shiba_negro.glb viene comprimido. Sin Draco la geometría sola son
        # megabytes que el AR baja antes de poder dibujar nada.
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        # 191 huesos por cinco animaciones son miles de fotogramas clave, y la
        # mayoría no dicen nada: un hueso de la oreja quieto durante 12 segundos
        # igual guarda 288 llaves idénticas. Esto las tira.
        export_optimize_animation_size=True,
    )

    mb = os.path.getsize(a.salida) / 1024 / 1024
    print(f'\n  salida    {a.salida}  {mb:.2f} MB')
    if mb > LIMITE_MB:
        print(f'            Pesa más de {LIMITE_MB} MB. El AR lo baja antes de mostrar nada;')
        print(f'            en datos móviles eso son segundos de pantalla vacía.')
        print(f'            Usa la malla optimizada o baja la textura a 1k.')
    else:
        print('            Dentro del presupuesto de la app (0.6 a 1.8 MB es lo que ya carga).')
    print()


main()

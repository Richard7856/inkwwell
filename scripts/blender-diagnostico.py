"""
Radiografía de un archivo .blend con una mascota rigeada. NO MODIFICA NADA.

── Para qué ──
Cuando alguien dice "ya está Zero en 3D con una animación", eso puede
significar cosas muy distintas: una malla con el esqueleto humanoide de Meshy
encima (que sale deforme), una malla bien pesada con un esqueleto de
cuadrúpedo, o una malla sin amarrar a la que solo le pusieron una armadura al
lado. Las tres se ven parecidas en el visor y necesitan arreglos opuestos.

Este guion contesta cuál de las tres es, y qué está roto exactamente.

── Cómo se usa ──
1. Abre tu .blend en Blender.
2. Pestaña Scripting → New → pega esto → Run Script (o Alt+P).
3. Se abre un bloque de texto llamado `diagnostico.txt` con el informe, y se
   escribe el mismo archivo junto al .blend. Ese texto es lo que hay que
   mandar: con él se puede escribir el arreglo sin tener el archivo.

No toca la escena: solo lee y crea un bloque de texto. No hace falta guardar.
"""

import json
import os

import bpy

# Nombres que SOLO tiene un bípedo. Ojo: 'spine' y 'hips' no sirven —un perro
# también tiene columna y cadera— y meterlos ahí fue el primer intento, que
# clasificó como humanoide un esqueleto de perro perfectamente bueno.
BIPEDO = ('thumb', 'index', 'pinky', 'middlefinger', 'ringfinger', 'mixamo',
          'upperarm', 'lowerarm', 'forearm', 'leftarm', 'rightarm', 'armjnt')

# Nombres que solo tiene un cuadrúpedo.
CUADRUPEDO = ('hind', 'hock', 'paw', 'tail', 'muzzle', 'snout', 'withers',
              'croup', 'carpus', 'fetlock')

lineas = []


def di(texto=''):
    lineas.append(str(texto))


def curvas_de(accion):
    """
    Las curvas de una acción, en Blender viejo y nuevo.

    Desde 4.4 las acciones guardan las curvas dentro de capas y "slots"; el
    `action.fcurves` de toda la vida queda vacío en esos archivos y haría creer
    que la animación no tiene nada.
    """
    if getattr(accion, 'fcurves', None):
        return list(accion.fcurves)
    fuera = []
    for capa in getattr(accion, 'layers', []):
        for tira in getattr(capa, 'strips', []):
            for bolsa in getattr(tira, 'channelbags', []):
                fuera.extend(bolsa.fcurves)
    return fuera


def hueso_de(ruta):
    """De `pose.bones["Hips"].location` saca `Hips`."""
    if '"' in ruta:
        return ruta.split('"')[1]
    return None


di('=' * 72)
di('DIAGNÓSTICO DEL ARCHIVO')
di('=' * 72)
di(f'Blender    {bpy.app.version_string}')
di(f'Archivo    {bpy.data.filepath or "(sin guardar)"}')
esc = bpy.context.scene
di(f'Escena     {esc.name} · {esc.render.fps} fps · cuadros {esc.frame_start}-{esc.frame_end}')
di()

mallas = [o for o in bpy.data.objects if o.type == 'MESH']
armaduras = [o for o in bpy.data.objects if o.type == 'ARMATURE']
otros = [o for o in bpy.data.objects if o.type not in ('MESH', 'ARMATURE')]
di(f'Objetos    {len(mallas)} malla(s) · {len(armaduras)} armadura(s) · '
   f'{len(otros)} otro(s): {", ".join(o.name for o in otros) or "ninguno"}')
di()

# ── mallas ──
di('-' * 72)
di('MALLAS')
di('-' * 72)
for o in mallas:
    di(f'\n· {o.name}')
    di(f'    {len(o.data.vertices)} vértices · {len(o.data.polygons)} caras')
    di(f'    dimensiones {tuple(round(v, 3) for v in o.dimensions)}')
    di(f'    escala      {tuple(round(v, 3) for v in o.scale)}'
       + ('   ← sin aplicar: deforma los pesos y el exportador'
          if any(abs(v - 1) > 0.001 for v in o.scale) else ''))
    di(f'    rotación    {tuple(round(v, 3) for v in o.rotation_euler)}')
    di(f'    padre       {o.parent.name if o.parent else "ninguno"}'
       f' ({o.parent_type if o.parent else "-"})')
    di(f'    UV          {[c.name for c in o.data.uv_layers] or "NINGUNA ← sin UV no hay textura"}')
    di(f'    materiales  {[m.name if m else "(vacío)" for m in o.data.materials] or "ninguno"}')

    mods = [(m.name, m.type, getattr(getattr(m, "object", None), "name", None)) for m in o.modifiers]
    di(f'    modificadores {mods or "ninguno"}')
    if not any(m.type == 'ARMATURE' for m in o.modifiers):
        di('        ← SIN modificador Armature: la malla NO sigue al esqueleto')

    # texturas: si faltan o no están empotradas, el GLB sale sin color
    for m in o.data.materials:
        if not m or not m.use_nodes:
            continue
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                # Una textura empotrada viaja dentro del .blend. Una externa
                # depende de una ruta del disco de quien la creó, y si el
                # archivo viaja sin ella el modelo sale gris.
                if n.image.packed_file:
                    di(f'    textura     {n.image.name} {tuple(n.image.size)} empotrada')
                else:
                    ruta = bpy.path.abspath(n.image.filepath)
                    existe = os.path.exists(ruta) if ruta else False
                    di(f'    textura     {n.image.name} {tuple(n.image.size)} externa: {ruta}'
                       + ('' if existe else '   ← EL ARCHIVO NO ESTÁ: empótrala con '
                                            'File → External Data → Pack Resources'))

    # pesos
    sin_peso = sum(1 for v in o.data.vertices if not v.groups)
    if o.vertex_groups:
        sumas = [sum(g.weight for g in v.groups) for v in o.data.vertices if v.groups]
        raros = sum(1 for s in sumas if abs(s - 1.0) > 0.01)
        di(f'    grupos      {len(o.vertex_groups)}')
        di(f'    sin peso    {sin_peso} vértices'
           + ('   ← se quedan clavados y desgarran la malla' if sin_peso else ''))
        di(f'    peso ≠ 1    {raros} vértices'
           + ('   ← deformación que encoge o estira' if raros else ''))
    else:
        di('    grupos      NINGUNO ← la malla no está pesada a ningún hueso')

# ── armaduras ──
di()
di('-' * 72)
di('ESQUELETOS')
di('-' * 72)
for arm in armaduras:
    huesos = arm.data.bones
    nombres = [b.name for b in huesos]
    bajo = ' '.join(nombres).lower().replace('_', '').replace('.', '').replace(' ', '')
    puntos_bip = sum(1 for t in BIPEDO if t in bajo)
    puntos_cua = sum(1 for t in CUADRUPEDO if t in bajo)

    # Dos señales para saber si el esqueleto es de persona o de animal, porque
    # ninguna de las dos es fiable sola:
    #
    #   · los nombres — mienten: hay rigs de perro con huesos llamados
    #     'shoulder' y 'wrist', y todo vertebrado tiene 'spine' y 'hips';
    #   · los apoyos que llegan al suelo — dos en un bípedo, cuatro en un
    #     cuadrúpedo. Tampoco es infalible: la punta de una cola que cuelga
    #     cuenta como apoyo, y un personaje con los brazos caídos da cuatro.
    #
    # Por eso esto NO concluye: deja las dos señales a la vista y la jerarquía
    # completa más abajo, que es la evidencia de verdad. Un rig de Meshy se
    # reconoce de un vistazo por nombres tipo LeftUpLeg / RightHand / Spine2.
    puntas = [b.tail_local for b in huesos]
    zs = [p.z for p in puntas] + [b.head_local.z for b in huesos]
    suelo, techo = min(zs), max(zs)
    alto = (techo - suelo) or 1.0
    # Cuánto tiene que separar dos puntas para contar como dos patas distintas.
    # Se mide contra el ALTO, no contra el ancho: medido contra el ancho, las
    # dos patas de adelante de un perro quedaban más juntas que el umbral y se
    # contaban como una sola, así que un cuadrúpedo salía bípedo.
    palmo = alto * 0.12 or 1.0
    bajas = [p for p in puntas if p.z < suelo + alto * 0.18]
    apoyos = []
    for p in bajas:
        if not any(((p.x - q.x) ** 2 + (p.y - q.y) ** 2) ** 0.5 < palmo for q in apoyos):
            apoyos.append(p)

    di(f'\n· {arm.name} — {len(huesos)} huesos')
    di(f'    escala      {tuple(round(v, 3) for v in arm.scale)}'
       + ('   ← sin aplicar' if any(abs(v - 1) > 0.001 for v in arm.scale) else ''))
    di(f'    pose        {arm.data.pose_position}')
    di(f'    señales     {len(apoyos)} apoyos cerca del suelo · '
       f'nombres de perro {puntos_cua} / de persona {puntos_bip}')
    di(f'                (dos apoyos y nombres de persona = rig humanoide, el que')
    di(f'                 deforma a un animal. Confírmalo en la jerarquía de abajo.)')

    sin_deformar = [b.name for b in huesos if not b.use_deform]
    di(f'    no deforman {len(sin_deformar)} huesos'
       + (f': {", ".join(sin_deformar[:10])}{"…" if len(sin_deformar) > 10 else ""}'
          if sin_deformar else ''))

    # huesos sin grupo y grupos sin hueso: las dos mitades de un rig mal amarrado
    amarradas = [o for o in mallas if any(
        m.type == 'ARMATURE' and m.object == arm for m in o.modifiers)]
    for o in amarradas:
        gr = {g.name for g in o.vertex_groups}
        hn = set(nombres)
        mudos = sorted(n for n in hn - gr if huesos[n].use_deform)
        sueltos = sorted(gr - hn)
        di(f'    contra {o.name}:')
        di(f'        huesos sin grupo   {len(mudos)}'
           + (f': {", ".join(mudos[:8])}{"…" if len(mudos) > 8 else ""}' if mudos else '')
           + ('   ← esos huesos se mueven y no arrastran nada' if mudos else ''))
        di(f'        grupos sin hueso   {len(sueltos)}'
           + (f': {", ".join(sueltos[:8])}{"…" if len(sueltos) > 8 else ""}' if sueltos else ''))
    if not amarradas:
        di('    ← ninguna malla usa este esqueleto')

    di('    jerarquía:')
    def rama(b, prof):
        if prof > 6:
            return
        marca = '' if b.use_deform else '  (no deforma)'
        di('        ' + '  ' * prof + b.name + marca)
        for h in b.children:
            rama(h, prof + 1)
    for b in huesos:
        if b.parent is None:
            rama(b, 0)

# ── animación ──
di()
di('-' * 72)
di('ANIMACIÓN')
di('-' * 72)
if not bpy.data.actions:
    di('No hay ninguna acción en el archivo.')
for accion in bpy.data.actions:
    curvas = curvas_de(accion)
    movidos = sorted({h for h in (hueso_de(c.data_path) for c in curvas) if h})
    ini, fin = accion.frame_range
    di(f'\n· {accion.name}')
    di(f'    cuadros     {ini:.0f}-{fin:.0f}  ({(fin - ini) / max(esc.render.fps, 1):.1f} s)')
    di(f'    curvas      {len(curvas)} · huesos movidos {len(movidos)}')
    if getattr(accion, 'slots', None):
        di(f'    slots       {[s.name_display for s in accion.slots]}  (formato 4.4+)')
    if movidos:
        di(f'    mueve       {", ".join(movidos[:12])}{"…" if len(movidos) > 12 else ""}')
    else:
        di('    ← no mueve ningún hueso: la acción está vacía o es de objeto, no de pose')

for arm in armaduras:
    ad = arm.animation_data
    activa = ad.action.name if ad and ad.action else 'ninguna'
    pistas = [t.name for t in ad.nla_tracks] if ad else []
    di(f'\n{arm.name}: acción activa = {activa} · pistas NLA = {pistas or "ninguna"}')

# ── resumen para pegar ──
resumen = {
    'blender': bpy.app.version_string,
    'mallas': [{'nombre': o.name, 'verts': len(o.data.vertices),
                'grupos': len(o.vertex_groups),
                'sin_peso': sum(1 for v in o.data.vertices if not v.groups),
                'armature': any(m.type == 'ARMATURE' for m in o.modifiers)}
               for o in mallas],
    'armaduras': [{'nombre': a.name, 'huesos': len(a.data.bones)} for a in armaduras],
    'acciones': [{'nombre': x.name, 'curvas': len(curvas_de(x))} for x in bpy.data.actions],
}
di()
di('-' * 72)
di('RESUMEN (una línea, por si el informe largo no cabe)')
di('-' * 72)
di(json.dumps(resumen, ensure_ascii=False))

informe = '\n'.join(lineas)
print(informe)

# En Windows y Mac la consola de Blender no se ve por omisión, así que el
# informe tiene que quedar en algún lado que se pueda abrir y copiar.
nombre = 'diagnostico.txt'
bloque = bpy.data.texts.get(nombre) or bpy.data.texts.new(nombre)
bloque.clear()
bloque.write(informe)

carpeta = os.path.dirname(bpy.data.filepath) or os.path.expanduser('~')
destino = os.path.join(carpeta, nombre)
try:
    with open(destino, 'w', encoding='utf-8') as f:
        f.write(informe)
    print(f'\n>>> informe escrito en {destino}')
except OSError as e:
    print(f'\n>>> no se pudo escribir el archivo ({e}); está en el bloque '
          f'de texto "{nombre}" de la pestaña Scripting')

#!/usr/bin/env python3
"""
Genera todos los assets de marca de InkAR desde una sola fuente SVG.

POR QUÉ UN GENERADOR Y NO PNGs A MANO:
Son 20+ archivos en 5 densidades. Hechos a mano, cualquier ajuste al logo obliga
a rehacerlos uno por uno y basta olvidar una densidad para que un teléfono
muestre el icono viejo. Aquí se cambia `brand/icono.svg`, se corre esto, y todo
queda consistente.

Uso:  python3 scripts/generar-marca.py
Requiere: rsvg-convert (brew install librsvg) y Pillow.
"""
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
RES = RAIZ / 'android/app/src/main/res'
K = RAIZ / 'brand/K.svg'
FUENTE = RAIZ / 'brand/Montserrat.ttf'

# Paleta del tablero de marca
TINTA = (0, 0, 0, 255)          # #000000
CLARIDAD = (247, 247, 247, 255) # #F7F7F7 — fondo del icono
NEGRO = (11, 11, 15, 255)       # #0B0B0F — fondo de la app y del splash

# Densidades de Android. El icono adaptativo se dibuja en un lienzo de 108dp;
# el lanzador solo muestra los 72dp centrales, así que el legado se obtiene
# ampliando 108/72 = 1.5 y recortando al centro — que es justo lo que se ve.
DENSIDADES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
ESCALA_LEGADO = 108 / 72


# Proporción del lienzo de 108dp que puede ocupar el dibujo.
#
# El icono adaptativo mide 108dp pero el lanzador solo garantiza el círculo
# central de 66dp: fuera de ahí recorta según la forma que use el sistema. La K
# lleva salpicaduras, y una salpicadura cortada por la máscara no se lee como
# estilo sino como un error de dibujo, así que TODO el arte —salpicaduras
# incluidas— se encierra dentro de ese círculo.
PROPORCION_SEGURA = 0.60


def _k_recortada(px: int) -> Image.Image:
    """La K rasterizada a `px` de alto y recortada a su contenido real."""
    salida = Path('/tmp/_k_tmp.png')
    subprocess.run(['rsvg-convert', '-w', str(px), '-h', str(px),
                    str(K), '-o', str(salida)], check=True)
    img = Image.open(salida).convert('RGBA')
    # El SVG trae márgenes; se recorta al alfa para poder centrar de verdad.
    caja = img.getbbox()
    return img.crop(caja) if caja else img


def render(px: int, color=TINTA) -> Image.Image:
    """
    Capa FRENTE del icono: lienzo transparente de `px` con la K centrada.

    Se compone aquí y no en un SVG con transform porque el arte no está
    centrado en su propio viewBox: recortar al alfa y centrar por código evita
    calcular a mano un desplazamiento que cambiaría con cada versión del asset.
    """
    lienzo = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    objetivo = int(px * PROPORCION_SEGURA)
    k = _k_recortada(max(objetivo * 3, 600))
    prop = min(objetivo / k.width, objetivo / k.height)
    k = k.resize((max(1, int(k.width * prop)), max(1, int(k.height * prop))), Image.LANCZOS)

    if color != TINTA:
        # Recolorear conservando el alfa: la textura del pincel vive en el alfa,
        # así que pintar encima con la máscara preserva cada salpicadura.
        tinte = Image.new('RGBA', k.size, color)
        tinte.putalpha(k.split()[-1])
        k = tinte

    lienzo.alpha_composite(k, ((px - k.width) // 2, (px - k.height) // 2))
    return lienzo


def sobre_fondo(frente: Image.Image, color=CLARIDAD) -> Image.Image:
    fondo = Image.new('RGBA', frente.size, color)
    return Image.alpha_composite(fondo, frente)


def icono_legado(lado: int, redondo: bool) -> Image.Image:
    """Icono clásico para Android 7 y anterior: sin capas, ya recortado."""
    grande = int(lado * ESCALA_LEGADO)
    img = sobre_fondo(render(grande))
    borde = (grande - lado) // 2
    img = img.crop((borde, borde, borde + lado, borde + lado))
    if redondo:
        mascara = Image.new('L', (lado, lado), 0)
        ImageDraw.Draw(mascara).ellipse((0, 0, lado - 1, lado - 1), fill=255)
        img.putalpha(mascara)
    return img


def _texto(cadena: str, px: int, peso: int = 600, tracking: float = 0.12,
           color=TINTA) -> Image.Image:
    """
    Dibuja texto con espaciado entre letras.

    PIL no soporta tracking, así que se avanza carácter por carácter usando el
    avance real de la fuente (getlength) y no el ancho del glifo: con el ancho
    se comerían los laterales y las letras quedarían pegadas de forma despareja.
    """
    f = ImageFont.truetype(str(FUENTE), px)
    f.set_variation_by_axes([peso])
    sep = int(px * tracking)
    avances = [f.getlength(c) for c in cadena]
    ancho = int(sum(avances) + sep * (len(cadena) - 1)) + px
    alto = int(px * 1.6)
    im = Image.new('RGBA', (ancho, alto), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = px // 2
    for c, av in zip(cadena, avances):
        d.text((x, alto // 2), c, font=f, fill=color, anchor='lm')
        x += av + sep
    caja = im.getbbox()
    return im.crop(caja) if caja else im


def logo(alto_mayuscula: int = 200, color=TINTA) -> Image.Image:
    """
    Logotipo completo: IN + la K a pincel + AR.

    Se genera como imagen en vez de componerse en HTML con texto real porque si
    Montserrat carga tarde el logo brincaría al cambiar de tipografía — y lo
    hace justo en la primera pantalla, que es donde más se nota.

    La K se dibuja 1.9× la altura de mayúscula: su cuerpo queda a la altura de
    las letras y las salpicaduras sobresalen, que es como se comporta en el
    tablero de marca.
    """
    izq = _texto('IN', alto_mayuscula, color=color)
    der = _texto('AR', alto_mayuscula, color=color)
    k = _k_recortada(int(alto_mayuscula * 1.9))
    if color != TINTA:
        tinte = Image.new('RGBA', k.size, color)
        tinte.putalpha(k.split()[-1])
        k = tinte

    hueco = int(alto_mayuscula * 0.10)
    ancho = izq.width + hueco + k.width + hueco + der.width
    alto = max(izq.height, k.height, der.height)
    im = Image.new('RGBA', (ancho, alto), (0, 0, 0, 0))
    for pieza, x in ((izq, 0),
                     (k, izq.width + hueco),
                     (der, izq.width + hueco + k.width + hueco)):
        im.alpha_composite(pieza, (x, (alto - pieza.height) // 2))
    caja = im.getbbox()
    return im.crop(caja) if caja else im


def main():
    if not K.exists():
        sys.exit(f'Falta {K}')

    # ── Icono ──
    for nombre, factor in DENSIDADES.items():
        carpeta = RES / f'mipmap-{nombre}'
        carpeta.mkdir(parents=True, exist_ok=True)
        # Frente del adaptativo: lienzo completo de 108dp, con transparencia
        render(int(108 * factor)).save(carpeta / 'ic_launcher_foreground.png')
        lado = int(48 * factor)
        icono_legado(lado, redondo=False).save(carpeta / 'ic_launcher.png')
        icono_legado(lado, redondo=True).save(carpeta / 'ic_launcher_round.png')
        print(f'  icono {nombre}: {lado}px')

    # ── Ficha de Play: 512x512, sin transparencia (Play la rechaza) ──
    (RAIZ / 'brand').mkdir(exist_ok=True)
    sobre_fondo(render(int(512 * ESCALA_LEGADO))) \
        .crop((int((512 * ESCALA_LEGADO - 512) / 2),) * 2 +
              (int((512 * ESCALA_LEGADO - 512) / 2) + 512,) * 2) \
        .convert('RGB').save(RAIZ / 'brand/play-icono-512.png')
    print('  ficha de Play: 512px')

    # ── Splash ──
    # Sin texto a propósito: depender de una fuente del sistema haría que el
    # resultado cambie según la máquina que lo genere. La marca sola basta.
    for orientacion, (ancho, alto) in {'port': (320, 480), 'land': (480, 320)}.items():
        for nombre, factor in DENSIDADES.items():
            w, h = int(ancho * factor), int(alto * factor)
            lienzo = Image.new('RGBA', (w, h), NEGRO)
            # 0.57 y no algo menor: el SVG reserva el círculo seguro de
            # Android, así que el dibujo real ocupa 61% del lienzo. Sin
            # compensarlo, la marca del splash se ve diminuta.
            lado = int(min(w, h) * 0.57)
            marca = render(lado, color=(255, 255, 255, 255))
            lienzo.alpha_composite(marca, ((w - lado) // 2, (h - lado) // 2))
            carpeta = RES / f'drawable-{orientacion}-{nombre}'
            carpeta.mkdir(parents=True, exist_ok=True)
            lienzo.convert('RGB').save(carpeta / 'splash.png')
        print(f'  splash {orientacion}: 5 densidades')

    # También el splash genérico que algunos temas resuelven sin calificador
    generico = Image.new('RGBA', (1280, 1920), NEGRO)
    lado = int(1280 * 0.57)
    generico.alpha_composite(render(lado, color=(255, 255, 255, 255)),
                             ((1280 - lado) // 2, (1920 - lado) // 2))
    (RES / 'drawable').mkdir(parents=True, exist_ok=True)
    generico.convert('RGB').save(RES / 'drawable/splash.png')
    print('  splash genérico')

    # ── Logotipo completo, en tinta y en blanco ──
    logo(220, color=TINTA).save(RAIZ / 'public/logo-inkar.png')
    logo(220, color=(255, 255, 255, 255)).save(RAIZ / 'public/logo-inkar-blanco.png')
    print('  logotipo completo')

    # ── La K blanca sobre transparente, para la landing oscura ──
    render(512, color=(255, 255, 255, 255)).save(RAIZ / 'public/marca-k.png')
    print('  marca para la web')

    # ── Favicon web ──
    (RAIZ / 'public').mkdir(exist_ok=True)
    sobre_fondo(render(180)).convert('RGB').save(RAIZ / 'public/apple-touch-icon.png')
    icono_legado(32, redondo=False).convert('RGB').save(RAIZ / 'public/favicon.png')
    print('  favicon web')


if __name__ == '__main__':
    main()

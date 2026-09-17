# Guion del video de la landing

> Escrito el 17 de septiembre de 2026, para grabar el viernes 18.
> El video vive en `public/media/demo.mp4`; el rótulo que sale debajo lo decide
> `VIDEO_ES_GRABACION` en `src/pages/Landing.jsx`.

---

## El problema que resuelve este guion

La primera grabación enseña **un mecanismo**: una huella tatuada de la que sale
un perro. Quien no conoce a Richard ve un truco de realidad aumentada.

Lo que el producto vende, en palabras de la propia landing, es otra cosa:

> *"Si llevas al perro que se murió, vuelve a correr."*

Ese salto —de truco a significado— **no se consigue con más luces**. Se consigue
con una toma más, que ya existe y no hay que producir: la foto del perro.

---

## Tres tomas

| | Toma | Dura | Cómo se graba |
|---|---|---|---|
| 1 | **La foto de Zero** | ~2 s | Cámara normal. Puede ser la foto impresa, en la mano, o en la pantalla del celular |
| 2 | **El tatuaje, quieto** | ~2 s | Cámara normal. El antebrazo, la huella, el nombre |
| 3 | **El AR** | ~7 s | Grabación de pantalla, `inkar.app/scan?demo=zero-nace` |

Nadie tiene que explicar nada. El espectador arma la historia solo: **este perro
→ este tatuaje → volvió.**

### Por qué el orden importa

Si el AR va primero, la foto después se lee como aclaración. Si la foto va
primero, el AR se lee como respuesta. Es la misma materia prima y dice cosas
distintas según el orden.

### El beneficio técnico, de regalo

Solo la toma 3 tiene que ser grabación de pantalla, que es lo que limita la
resolución. **Las tomas 1 y 2 se graban con la cámara del celular a calidad
completa** — con desenfoque de fondo y buena luz. Dos de tres tomas dejan de
verse a 392 px.

---

## Lo que hace que se vea producido

### La luz — es el problema medido

En la grabación del 16 sep, el brillo bajando por el antebrazo va así:

```
91 → 124 → 143 → 95 → 54 → 157 → 67 → 134 → 182
```

Salta de 54 a 182 en el mismo brazo. **Eso no es iluminación, es lo que había en
el cuarto rebotando**, y es exactamente lo que se lee como "casero". Una toma con
luz tiene un degradado suave, no un zigzag.

- **Una sola fuente, suave, de lado.** Una ventana con cortina a 45° basta.
- **Apaga la luz del techo.** Está peleando con la ventana y por eso el zigzag.
- El brazo a distancia pareja de la fuente durante toda la toma.
- Ni sol duro ni flash: los dos meten sombras que compiten con el contenido.

### La cámara

- **El celular fijo, en un soporte. El que se mueve es el brazo.** Es el cambio
  más grande de todos: cámara quieta con sujeto que se mueve se lee como
  intención; cámara temblando se lee como casual.
- Altura del pecho, no desde arriba.

### El fondo

Liso y oscuro. En la primera grabación salen la mesa, unas sillas y otra
pantalla, y cada objeto compite con lo único que importa. Una pared lisa hace
que la piel y el perro salten.

### La ropa

Manga larga oscura, subida. Enmarca el antebrazo y da contraste con la piel.

### El movimiento, en la toma 3

**Gira la muñeca despacio mientras corre.** El rastreo siguiendo el movimiento es
lo único que un filtro no puede fingir, y es el argumento de toda la sección
"Por qué no es un filtro". Con el brazo quieto parece calcomanía.

Y deja **medio segundo de tatuaje quieto** antes de que empiece a derretirse: ese
medio segundo es lo que prueba que el tatuaje es real.

---

## Lo que NO hay que hacer

- **Nada de música ni locución.** La landing lo reproduce en silencio y en bucle,
  a propósito. Todo el esfuerzo en audio se tira.
- **Nada de filmar la pantalla del celular con otra cámara.** Da muaré y
  reflejos; se ve peor que la grabación de pantalla.
- **Nada de rótulos ni texto encima.** La copy de la landing ya explica; el
  video solo tiene que probar.
- **Nada de efectos en posproducción.** En el momento en que se ve
  cinematográfico, la pregunta del espectador cambia de *"¿eso es real?"* a
  *"eso es CGI"*, y de esa no se regresa.

---

## El reparto del trabajo

**Richard graba:** las tres tomas de arriba, en una sola sesión y con la misma
luz. Mejor de más que de menos — dos o tres intentos de la toma 3, que es la que
depende del rastreo.

**Claude arma:** el corte, los tiempos, el color, la compresión y el póster; lo
deja en `public/media/demo.mp4` y lo conecta.

**Ojo con el rótulo.** Si el video se edita —y este se va a editar—, el texto que
va debajo no puede decir "sin editar". Hoy dice *"Grabado con un teléfono, sobre
un tatuaje real"*, que sigue siendo cierto con tres tomas. Si alguna vez se usa
un video generado en lugar de una grabación, `VIDEO_ES_GRABACION` va en `false`.

---

## El defecto conocido que sigue ahí

`zero-nace.mp4` y `zero-concha.mp4` traen dentro un **charco verde bajo las
patas** — sombra de contacto que dibujó el generador con el verde del fondo
oscurecido. El prompt ya se corrigió (`no shadows cast on the background`), pero
esos dos videos **ya están generados con la sombra dentro**.

Para que la toma 3 salga limpia hay que **regenerarlos** con el prompt nuevo, y
eso exige desplegar el worker a Railway primero. Si no da tiempo, se graba con el
charco: a velocidad normal y en un teléfono se lee como plataforma oscura, no
como error.

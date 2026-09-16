# Dónde retomar

> **Actualizado el 16 de septiembre de 2026, al cerrar la sesión.**
>
> Si vienes de otra máquina, primero `SETUP.md`. El contexto del sprint está en
> `SHIPATON.md`; el porqué de cada decisión técnica, en `DECISIONS.md`.
> Tablero visual: https://claude.ai/artifact/4jVEXfBEa4jw43mBHUqxPC
> (editado desde otra sesión el 12 sep — **este archivo manda**).

---

## ⚠️ Lo primero: la fecha ya se venció

**El lanzamiento estaba puesto para el 17 de septiembre. Es mañana, y la v4 no
existe** — sigue en `versionCode` 3, sin compilar ni entregar. La revisión de
Play tarda cerca de un día, así que el 17 ya no es alcanzable con el producto
completo.

**Hay una decisión de Richard pendiente desde el 15 y no ha respondido.** No
darla por tomada. Las opciones que quedan:

- **Mover el lanzamiento al 19-20.** La quincena sigue en el bolsillo y da
  margen real. Es lo recomendado.
- **Lanzar el 17 con la v3**, que no puede cobrar ni generar. Sería lanzar un
  producto distinto al que anuncia la landing.

El cierre del concurso es el **30 de septiembre**, así que aún hay espacio —
pero cada día sin cobrar es un día que no cuenta para la métrica del premio.

---

## El estado real, verificado el 16 sep

| | |
|---|---|
| App en Play | ✅ v3 desde el 8 sep · `versionCode` 3 |
| inkar.app | ✅ 200 |
| Worker `/health` + analizador | ✅ vivo |
| Worker `/generar` | ⚠️ **503** — Railway no tiene las llaves de generación |
| Higgsfield Cloud | ✅ **con saldo**, generación probada y funcionando |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ **falta** — es lo único que bloquea probar el worker |
| Repo | ✅ todo commiteado y empujado |

**La base sigue en cero.** Nada del núcleo se ha ejercitado por el camino de la
app:

- **0** filas en `generaciones` — el worker nunca ha corrido una
- **0** compras · **0** estudios · **0** tatuajes con video
- **1** en la lista de espera (Richard **no ha compartido la landing**; no es
  falta de interés)

---

## Lo que SÍ se probó el 16 sep: el motor de video funciona

Cuatro generaciones reales contra Higgsfield, **sin pasar por el worker** (por
eso `generaciones` sigue en 0). Detalle en `DECISIONS.md`.

**El croma aguanta todo.** Fondo plano en todos los casos, desviación 1.2 a 2.3.
Incluso **con la cámara orbitando**, que era el riesgo real — basta pedir
`no shadows cast on the background` en el prompt. Eso libera el prompt:
movimiento de cámara, luz volumétrica y estética 3D son compatibles.

**El arco de acción sale bien con 10 segundos.** El perro mira la concha en el
suelo, se echa, la agarra con las patas y se la come, con acercamiento de
cámara. Vertical 9:16.

**Costos reales** (vía `POST /estimate<ruta>`, gratis, antes de cada envío):

| | |
|---|---|
| 6 s | $0.28 |
| **10 s** | **$0.467** — más barato por segundo, no hay razón para quedarse en 6 |
| Imagen (`popcorn`) | $0.09 |
| Gastado el 16 sep | $1.21 en cuatro generaciones |

Contra $25 por crédito de usuario, generar cuesta **~2% del neto**.

### La limitación que define el producto

**`image-to-video` hereda el estilo de la imagen de entrada.** De una caricatura
sale animación de caricatura por más que el prompt pida fotorrealismo. Y no hay
cómo convertir estilo con este plan: `nano-banana` da `model_not_found`, toda la
familia `reve` da `423 model_blocked`, y `popcorn` conserva el estilo de la
referencia.

**No es límite del motor: es cómo debe funcionar.** El cliente sube su foto
real y de ahí sale video real. Lo que estaba mal era la imagen de prueba —
`brand/video/zero-croma.mp4` resultó ser una **ilustración plana**, no un render
3D. Para validar realismo hace falta **una foto real de Zero**.

---

## Listo para que Richard grabe la landing

`demo=zero-concha` pone el video generado sobre su tatuaje real de la huella.
**No necesita la app, ni el worker, ni créditos** — corre en el navegador del
celular:

```
inkar.app/scan?demo=zero-concha
```

`demo=zero` se conservó con la pieza anterior, para comparar las dos sobre la
misma piel. La escala del nuevo bajó a **0.9** porque el video es vertical y
`videoLayer` calcula el alto desde el ancho (con 1.4 tapaba medio brazo). Si al
verlo queda grande o chico, es un número en `targetLoader.js`.

**Lo que decide si la toma sirve:** el tatuaje de la huella rastrea al **16%**,
extremo bajo de lo aceptable. Luz lateral suave, sin flash, cámara cerca y
movimiento lento.

---

## Lo primero, en orden

1. **Decidir la fecha de lanzamiento.** Bloquea todo lo demás.
2. **`SUPABASE_SERVICE_ROLE_KEY`** en `worker/.env`. Es lo único que impide
   probar el worker completo.
3. **Probar el camino por el WORKER** — la generación contra Higgsfield ya está
   verificada; falta lo que la rodea: reserva de crédito con cerrojo, copia a
   nuestro Storage, asignación al tatuaje y reembolso ante fallo. Se corre en
   local con el JWT de la cuenta del revisor, sin teléfono.
4. **Productos en Play** y Offering en RevenueCat.
5. **Compilar v4** (`versionCode` 4), verificar con grep que la llave de
   RevenueCat quedó horneada, entregar a Play.
6. **Probar en el teléfono** lo único que lo exige: la compra por Play.

---

## Esperando de Richard

| | |
|---|---|
| **Decidir la fecha de lanzamiento** | Pendiente desde el 15 sep |
| **`SUPABASE_SERVICE_ROLE_KEY`** | Settings → API → service_role (NO la anon) |
| **Las 4 variables en Railway** | `/generar` responde 503. Ver `worker/DEPLOY.md` |
| **Grabar el video del tatuaje** | Con `demo=zero-concha`, para la landing |
| **Una foto REAL de Zero** | Desbloquea la prueba de realismo |
| **Productos en Play** | `creditos_primero`, `creditos_1`, `creditos_3`, `creditos_5` → Monetizar con Play → Productos → **Productos únicos** |
| **Offering en RevenueCat** | Sin ella `getOfferings()` devuelve vacío sin error |
| **Pegar la ficha nueva** | `brand/textos-ficha.md`, dos idiomas |
| **Corregir la declaración de datos** | "Fotos" pasa a **compartido** (Higgsfield es tercero real) + **historial de compras** |
| **Verificación de identidad de desarrollador** | ⚠️ Vence el **30 sep**. Si no, Google retira la app |
| **Respaldo de la llave de firma** | ⬜ `~/inkar-release.jks` existe en una sola máquina. Ver `SETUP.md` |
| **Compartir la landing** | La lista tiene 1 persona porque no se ha movido |

---

## Decisiones ABIERTAS — no darlas por tomadas

**1. La fecha de lanzamiento.** Ver arriba.

**2. La oferta de la lista de espera.** Richard propuso "50% en el primer
tatuaje" para quien se registre. Problema: **el primer crédito a $12.50 ya es el
precio de todos**, así que a la lista no le daría nada, y presentar el precio
normal como descuento exclusivo se lee como descuento inventado. Propuesta:
**primer video gratis para la lista**, por código promocional topado
(`codigos_promo.usos_max` ya existe).

**3. La comisión de estudios fundadores.** Richard propuso "30% por un año". Lo
construido es **los primeros 20, permanente** (`cupo_fundadores()` = 20). Se
recomendó conservarlo: "primeros 20" urge y "un año" no, y al mes 13 habría que
bajarle la comisión a alguien con quien se construyó un año de relación.
Propuesta intermedia: **"30% para los primeros 20 que entren antes del
lanzamiento", permanente.**

**4. Publicar el precio en la landing.** El costo ya se conoce, así que se puede
decidir. Recomendación: el mensaje que instala es "el primero va por nuestra
cuenta"; el dinero se habla después de que vean el producto.

**5. Cambios propuestos a la landing:** la fecha en el héroe —hoy no aparece por
ningún lado—, la oferta de la lista, la fecha límite de estudios, y **una
segunda invitación al final**: el formulario está arriba, y al terminar las
cuatro secciones que de verdad venden no hay dónde apuntarse.

**6. Ajustar el texto de la espera.** Las generaciones tardaron entre **115 y
240 segundos** y `GeneracionStatus` promete "de 1 a 3 minutos". Se queda corto
justo en la primera impresión. Propuesta: **"de 2 a 5 minutos"**.

**7. Subir la duración por defecto a 10 s.** `HIGGSFIELD_DURACION` está en 6. Los
10 s dan un arco de acción completo y salen más baratos por segundo.

**8. Interruptor de degradación:** que la app deje de ofrecer "Anima tu
recuerdo" cuando el generador no está disponible. Seguro contra quedarse sin
saldo en plena semana del concurso.

Lenguaje: **"tu primer video"**, no "tu primer tatuaje" — no vendemos tatuajes.

---

## Listo — NO rehacer

- **v3 publicada en Play** (8 sep). Cuenta de servicio de Google Cloud validada.
- **RevenueCat**: proyecto INKAR, credenciales validadas, llave pública de
  Android en `.env` y horneada en el bundle.
- **Analizador vivo en Railway**, conectado a la activación (migración 007).
- **Generación de video**: worker `/generar`, tabla `generaciones`, reserva con
  cerrojo, reembolso automático y reanudación tras reinicio (migración 009).
  **La parte de Higgsfield está probada**; lo que la rodea, no.
- **`worker/modelos.js`**: disponibilidad **y costo real** de cada modelo, gratis.
- **Flujo de compra**, canje de códigos, primer crédito a mitad de precio,
  estudios con atribución permanente (migración 008). `SHIPATON` = 1 crédito,
  200 usos.
- **Marca en todas las pantallas**: todo sale de `src/components/ui/`.
- **Perfil real** (`/profile`) con estado del contenido y liga copiable.
- **Política de privacidad** declara a Higgsfield y las compras.
- **Ficha de Play reescrita** en dos idiomas, con instrucciones del revisor.
- **Landing**: el formulario de arriba ya no intercepta estudios.
- **`SETUP.md`**: cómo montar el proyecto en otra máquina.
- Borrado de cuenta, libro mayor de créditos, capa de video con croma.

---

## Trampas registradas, para no repetirlas

- **El catálogo documentado de Higgsfield NO es el que tu plan habilita.**
  Seedance da 404 y Veo 503 aunque estén en el spec. Antes de cambiar
  `HIGGSFIELD_ENDPOINT`: `cd worker && node --env-file=.env modelos.js`.
- **`modelos.js` NO detecta si hay saldo.** La API valida el cuerpo antes de
  revisar créditos, así que una cuenta vacía también sale "disponible".
- **`POST /estimate<ruta>` da el costo en USD sin generar nada.** No está en el
  `openapi.json`; está en la página de billing. Usarlo siempre antes de gastar.
- **Los perfiles de modelo se escriben desde `openapi.json`, no desde un
  resumen.** La primera versión salió de un resumen y quedó mal.
- **Higgsfield Cloud (API) y el plan Plus del panel son cuentas distintas.**
- **Antes de juzgar una imagen o un video, ábrelo.** Se describió `zero-croma`
  como "render 3D" sin mirarlo; era una ilustración plana, y eso invalidó dos
  rondas de pruebas de realismo.
- **Capacitor empaqueta los assets** (`webDir: dist`): desplegar a Vercel NO
  actualiza la app instalada. Todo cambio que deba llegar al teléfono exige
  build, `versionCode` nuevo y otra revisión.
- **La llave de RevenueCat se hornea al compilar.** Tiene que estar en `.env`
  ANTES del build.
- El `.mind` y el video **deben servirse con su tipo MIME correcto**; si el
  servidor devuelve el index.html, MindAR revienta con un msgpack error que no
  menciona la URL.
- Las rutas del SPA devuelven **200 aunque la página no exista**: verificar con
  navegador, nunca con `curl` a secas.
- Los generadores **no respetan el color de fondo pedido**; la capa de video mide
  el color real. `prompt_optimizer` va en `false` o se pierde el verde.
- Three 0.151 usa `encodings_fragment`, no `colorspace_fragment`.
- El dev server corre en **HTTPS** autofirmado y un navegador automatizado lo
  rechaza. Para revisiones visuales: `npm run build` y servir `dist` por HTTP.
- **Las funciones con `auth.uid()` se prueban con un JWT real por PostgREST**,
  no simulando sesión por SQL. La cuenta del revisor (`prueba@inkar.app`) abre
  sesión por `POST /auth/v1/token?grant_type=password`.
- Los textos que redacta el **worker** no pasan por el diccionario del cliente.
- **Las capturas del navegador emulado muestran franjas negras** a los lados: es
  el capturador, no la app. Medir el ancho con JS antes de "arreglar" nada.

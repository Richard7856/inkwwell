# Dónde retomar

> **Actualizado el 18 de septiembre de 2026.**
>
> Si vienes de otra máquina, primero `SETUP.md`. El contexto del sprint está en
> `SHIPATON.md`; el porqué de cada decisión técnica, en `DECISIONS.md`.
> Tablero visual: https://claude.ai/artifact/4jVEXfBEa4jw43mBHUqxPC
> (editado desde otra sesión el 12 sep — **este archivo manda**).

---

## ⚠️ Lo primero: la fecha ya se venció

**Ventana vigente (movida el 17 sep): la landing se comparte el viernes 18, la
lista cierra el domingo 20, se lanza el lunes 21.** Richard la recorrió para
tener días de prueba en vez de horas. Los pasos, en orden y con tiempos, están
en **`LANZAMIENTO.md`** — ese archivo es la guía operativa.

**Pero la fecha no es el problema.** La v3 publicada **no puede cobrar** —la
llave de RevenueCat se horneó vacía y no hay pantalla de compra—, así que la
métrica que pondera el concurso (facturación por RevenueCat) está en **cero y
ahí se queda hasta que la v4 esté publicada**. Cada día sin v4 es un día de
facturación imposible contra el 30 de septiembre. La v4 debe entrar a revisión
lo antes físicamente posible; el anuncio puede ir después.

---

## El estado real, verificado el 18 sep (medido, no supuesto)

> La tabla del 16 sep quedó obsoleta en cuatro renglones. Esto se midió hoy
> contra Railway, contra la base y contra el sitio.

| | |
|---|---|
| App en Play | ✅ v3 publicada desde el 8 sep — **no puede cobrar** |
| `versionCode` | ✅ **4** (subido el 18 sep). La v4 todavía no se entrega |
| inkar.app | ✅ 200, con el video y `zero-animado.glb` sirviendo |
| Worker `/health` | ✅ 200, `disponible: true`, `motivo: ok` |
| Llaves en Railway | ✅ **puestas** — ya no responde `no_configurado` |
| **Generación por el camino del worker** | ✅ **PROBADA.** 2 videos generados, guardados en Storage y asignados a su tatuaje |
| Reserva de crédito | ✅ ejercida, incluido el rechazo por saldo insuficiente |
| Reembolso | ✅ **ejecutado de verdad** (el modelo `veo3.1` salió deshabilitado y devolvió el crédito) |
| **Compras** | ❌ **0. El cobro nunca ha corrido completo** |
| Lista de espera | ⚠️ **1** — la landing sigue sin compartirse |
| Repo | ✅ todo commiteado y empujado a `main` |

**El único tramo que nunca ha corrido es el cobro.** Play → RevenueCat →
webhook → `credit_ledger`. Los pasos para probarlo sin comprar están en
`LANZAMIENTO.md` (A5).

**Agujero de seguridad encontrado y cerrado el 18 sep.**
`reembolsar_generacion` y `reservar_credito_generacion` tenían `EXECUTE` para
`anon`, y como son `SECURITY DEFINER` sin `auth.uid()`, cualquiera con la llave
anónima —que viaja pública en el bundle— podía regalarse créditos infinitos.
Migración `010`, aplicada y verificada. Detalle en `DECISIONS.md`.

## Lo que SÍ se probó el 16 sep: el motor de video funciona

Cuatro generaciones reales contra Higgsfield, **sin pasar por el worker**.
Detalle en `DECISIONS.md`. (El 17 sep ya se probó también POR el worker: ver la
tabla de arriba.)

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

> Los pasos 1 y 2 de la lista anterior —recargar Higgsfield, poner las llaves en
> Railway, probar la generación por el worker— **ya están hechos**. Lo que queda:

1. **La llave de RevenueCat en `.env`.** Es lo ÚNICO que se hornea en el bundle,
   y es el error que ya se cometió una vez: la v3 publicada no puede cobrar por
   esto.
2. **Productos en Play** (los cuatro IDs exactos) y **Offering marcada Current**
   en RevenueCat.
3. **Redesplegar el webhook** — tiene un cambio sin publicar, y ahora
   `supabase/config.toml` fija `verify_jwt = false` para que el redespliegue no
   lo rompa.
4. **Probar el cobro sin comprar**: RevenueCat → Integrations → Webhooks → Send
   test event. Debe contestar 200 `producto desconocido`. Es el único tramo del
   producto que nunca ha corrido.
5. **Compilar la v4**, verificar con grep que la llave quedó horneada, entregar.
6. **En el teléfono**, lo único que exige teléfono: comprar de verdad y generar
   desde la app.

> **El paso 5 no depende de los productos de Play.** Los productos y la Offering
> se leen en vivo; el bundle solo hornea la llave. Y si el generador se cayera,
> la app deja de ofrecer "Anima tu recuerdo" en vez de mandar al usuario a
> chocar. Esperar a tenerlo todo antes de compilar cuesta días de revisión que
> no se recuperan.

---

## Decisiones ABIERTAS — no darlas por tomadas

**1. Publicar el precio en la landing.** Sigue sin publicarse, y es deliberado:
el mensaje que instala es "el primero va por nuestra cuenta"; la conversación
del dinero va después de que vean el producto. Revisar después del lanzamiento,
con datos de conversión.

**2. Si el 50% debe ser exclusivo de la lista.** La landing ofrece 50% de
descuento en el primer video. **Ya está construido** —el SKU `creditos_primero`,
regla en `ha_comprado()`, migración 008— pero se le ofrece a cualquiera que
nunca haya comprado, no solo a quien se apuntó. Por eso la copy enuncia los dos
hechos por separado y no dice "apúntate y llévate el 50%": sería prometer una
exclusividad que el producto no aplica.

Para volverlo exclusivo de verdad hay una sola vía: restringir `creditos_primero`
a quien esté en `waitlist`. Es cambio de reglas de negocio, no de copy, y sube el
precio de entrada de $12.50 a $25 para todo el que llegue sin apuntarse — malo
para la conversión del día del lanzamiento. Sin decidir.

Lenguaje: **"tu primer video"**, no "tu primer tatuaje" — no vendemos tatuajes.

---

## Decisiones CERRADAS en la sesión del 16 sep

- **Ventana del lanzamiento:** landing el viernes 18, lista cierra el domingo
  20, lanzamiento el lunes 21 (movida el 17 sep). Guía en `LANZAMIENTO.md`.
- **Interruptor de degradación: construido.** Ver `DECISIONS.md` [2026-09-16].
  Ya no es una propuesta. Incluye el caso de llave revocada (401/403).
- **Oferta de la lista: 50% de descuento en el primer video** (Richard, 16 sep,
  antes de compartir). Ventaja que no se había visto: ya está construido
  (`creditos_primero`), mientras que "gratis" exigía crear un código promocional
  antes del viernes. Ver `DECISIONS.md` para cómo se redactó sin prometer una
  exclusividad que el producto no aplica.
- **Estudios fundadores:** se quedan con el cupo de 20, permanente, **sin fecha
  límite**. El cupo es la restricción real; una fecha habría sido urgencia
  inventada encima de una verdadera.
- **Landing:** fecha en el héroe, oferta con vencimiento y segunda invitación al
  final. Construido y verificado en navegador.

---

## Bloqueado por Richard

> **Los pasos en orden, con tiempos y comandos, están en `LANZAMIENTO.md`.**
> Esta tabla es el índice.

| | |
|---|---|
| **Recargar Higgsfield Cloud** | ~$10 USD. Es una cuenta distinta del plan Plus |
| **`SUPABASE_SERVICE_ROLE_KEY`** | Settings → API → service_role (NO la anon). Va en `worker/.env` y en Railway |
| **Las 4 variables de generación en Railway** | `/generar` responde 503 hoy. Detalle en `worker/DEPLOY.md` |
| **Productos en Play** | `creditos_primero`, `creditos_1`, `creditos_3`, `creditos_5`. Menú: Monetizar con Play → Productos → **Productos únicos** |
| **Offering en RevenueCat** | Sin ella `getOfferings()` devuelve vacío sin error |
| **Pegar la ficha nueva** | `brand/textos-ficha.md`, los dos idiomas |
| **Corregir la declaración de datos en Play** | "Fotos" pasa a **compartido** (Higgsfield es tercero real) y se agrega **historial de compras** |
| **Verificación de identidad de desarrollador** | ⚠️ Vence el **30 sep**, el mismo día que el concurso. Si no, Google retira la app — y con ella la entrega. **No es trámite, es riesgo existencial: hacerlo esta semana** |
| **Respaldo de la llave de firma** | ⬜ `~/inkar-release.jks` existe en una sola máquina. Ver `SETUP.md` |
| **Compartir la landing** | La lista tiene 1 persona porque no se ha movido |
| **Borrar la rama muerta de agosto** | `claude/retomar-proyecto-contexto-u3o686`. Una sesión en la nube no puede (403 del proxy). Ver abajo |
| **Meter `CLAUDE.md` al repo** | Vive en la carpeta padre, fuera del repo. Las sesiones en la nube (Claude Code web) solo clonan el repo, así que **arrancan sin el contexto general del producto** y con referencias rotas. Ver abajo |

---

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

## Ramas: todo va a `main` (decidido el 17 sep)

**Producción se despliega desde `main`.** Cualquier trabajo que no llegue ahí
es invisible, aunque esté commiteado y empujado.

**Todas las sesiones commitean a `main` directamente.** Richard dio permiso
explícito el 17 de septiembre. Antes de cada push: `git pull --rebase origin
main` o un merge; si dos sesiones empujan a la vez, git rechaza la segunda y
esa hace pull y reintenta. No se pierde nada.

**Por qué se cambió.** El 16 y 17 de septiembre hubo dos sesiones en paralelo:
una commiteaba directo a `main` y la otra a `claude/exciting-hamilton-j3quzt`,
porque su instrucción le prohibía empujar a `main` sin permiso. Resultado: el
trabajo de la segunda se quedó fuera de producción **dos veces** sin que nadie
lo notara —la landing en vivo siguió mostrando la copy anterior al giro a video
y sin el video de Zero— hasta que Richard lo vio. Y una vez fue peor: se
promovió a producción la vista previa de esa rama, que era anterior al trabajo
de AR, y **los demos dejaron de funcionar** (sus videos devolvían `index.html`).

**Los conflictos nunca han sido de código.** Las sesiones trabajan en
territorios distintos por naturaleza —AR y worker de un lado, landing y
documentos del otro— y los tres merges hechos hasta ahora solo chocaron en
`DECISIONS.md`, `PROXIMA-SESION.md` y `SHIPATON.md`. Como las dos partes
AGREGAN entradas al final, resolver es conservar los dos lados. En
`PROXIMA-SESION.md` y `SHIPATON.md`, cuando hay contradicción, **gana la
decisión ya tomada por Richard** sobre la recomendación que la otra sesión
escribió sin saberla.

**No se abren PR.** Se commitea y se empuja.

**Rama muerta, no la mergees:** `claude/retomar-proyecto-contexto-u3o686`
(10 ago 2026, punta `ef2d231`) es un intento anterior con **historia
independiente** —otra raíz, sin ancestro común—, paquete `com.inkwell.ar`, sin
worker, sin analizador, sin créditos y sin generación de video. Mergearla
borraría ~11.500 líneas del proyecto vivo.

**Sigue existiendo en el remoto.** Se intentó borrar el 16 sep desde una sesión
en la nube y el proxy lo rechazó con 403: ese entorno no puede borrar
referencias. **Bórrala tú** desde GitHub → Branches, o desde tu máquina con
`git push origin --delete claude/retomar-proyecto-contexto-u3o686`. Si alguna
vez hiciera falta recuperarla, la punta es `ef2d231` y se restaura con
`git push origin ef2d231:refs/heads/rescate-agosto`.

---

## Trampas registradas, para no repetirlas

- **El catálogo documentado de Higgsfield NO es el que tu plan habilita.**
  Seedance da 404 y Veo 503 aunque estén en el spec. Antes de cambiar
  `HIGGSFIELD_ENDPOINT`: `cd worker && node --env-file=.env modelos.js`.
- **`modelos.js` NO detecta si hay saldo.** La API valida el cuerpo antes de
  revisar créditos, así que una cuenta vacía también sale "disponible". Solo un
  envío real lo confirma (`403 not_enough_credits`). Una versión anterior del
  script prometía detectarlo y era falso. Por eso el interruptor de degradación
  **reacciona a un envío fallido** en vez de sondear.
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
- **En una sesión en la nube, `npm ci` instala sin devDependencies** porque
  `canvas` (nativo, vía `mind-ar`) falla al compilar y aborta el paso. Se
  resuelve con `npm ci --include=dev --ignore-scripts`. Para levantar el
  **worker** sí hace falta canvas de verdad:
  `apt-get update && apt-get install -y libpango1.0-dev libjpeg-dev libgif-dev`
  y luego `npm rebuild canvas`.

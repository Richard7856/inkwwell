# Dónde retomar

> **Actualizado el 16 de septiembre de 2026.**
>
> Si vienes de otra máquina, primero `SETUP.md`. El contexto del sprint está en
> `SHIPATON.md`; el porqué de cada decisión técnica, en `DECISIONS.md`.
> Tablero visual: https://claude.ai/artifact/4jVEXfBEa4jw43mBHUqxPC
> (se editó desde otra sesión el 12 sep; puede no coincidir con este archivo —
> **este archivo manda**).

---

## ⚠️ Lo primero que tiene que leer una sesión nueva

**La ventana quedó cerrada el 16 sep: se comparte la landing HOY, la lista
cierra el jueves 18, se lanza el viernes 19.** Los pasos concretos, en orden y
con tiempos, están en **`LANZAMIENTO.md`** — ese archivo es la guía operativa.

**Pero la fecha no es el problema.** La v3 publicada **no puede cobrar** —la
llave de RevenueCat se horneó vacía y no hay pantalla de compra—, así que la
métrica que pondera el concurso (facturación por RevenueCat) está en **cero y
ahí se queda hasta que la v4 esté publicada**. Cada día sin v4 es un día de
facturación imposible contra el 30 de septiembre. La v4 debe entrar a revisión
lo antes físicamente posible; el anuncio puede ir después.

---

## El estado real, verificado el 16 sep (no supuesto)

| | |
|---|---|
| App en Play | ✅ v3 publicada desde el 8 sep — **no puede cobrar** |
| `versionCode` | ⚠️ sigue en **3**. La v4 no existe |
| inkar.app | ✅ 200 (redirige a `www.inkar.app`) |
| Worker `/health` | ✅ 200, analizador vivo |
| Worker `/generar` | ⚠️ **503 `no_configurado`** — Railway no tiene las llaves de generación |
| `SUPABASE_SERVICE_ROLE_KEY` en `worker/.env` | ❌ falta |
| Llaves de Higgsfield en `worker/.env` | ✅ válidas |
| Saldo en Higgsfield Cloud | ❌ sin recargar (al 9 sep: `403 not_enough_credits`) |
| Repo | ✅ todo commiteado y empujado |

**Lo que dice la base — nada del núcleo se ha ejercitado en producción:**

- **0** generaciones de video, jamás
- **0** compras reales
- **0** estudios registrados
- **1** persona en la lista de espera (Richard **no ha compartido la landing**;
  no es falta de interés)
- **5** tatuajes, **3** usuarios

---

## El costo por video ya se conoce (15 sep)

Se encontró `POST /estimate<ruta>`: devuelve créditos **y USD sin generar nada**.
No aparece en el `openapi.json`, está en la página de billing.

| Modelo | Costo por video |
|---|---|
| **MiniMax Hailuo-02 estándar** ← el configurado | **$0.28** |
| MiniMax Hailuo-2.3 fast | $0.19 |
| Kling 2.5 turbo | $0.21 |
| Versiones "pro" | ~$0.49 |
| Kling 2.1 master | $1.40 |

1 crédito de API ≈ $0.0625. **Contra $25 por crédito de usuario, generar cuesta
1-2% del neto: el precio no está limitado por el costo.** Cabe regalar una
regeneración sin despeinarse.

**Suscripción del panel ≠ API.** La app solo usa la API; pagar la suscripción no
alimenta el producto. Evidencia: el 9 sep el panel tenía 12.5 créditos y la API
rechazó un video de 4.476 con `not_enough_credits`. Recomendación dada:
**recargar la API con ~$10 USD** (≈35 videos) y **no** pagar suscripción.
Pendiente además revisar que no se esté cobrando el plan Plus sin usarlo.

---

## Lo primero, en orden

1. **Recargar Higgsfield Cloud** y poner `SUPABASE_SERVICE_ROLE_KEY` en
   `worker/.env` y en Railway.
2. **Probar la generación de punta a punta en local** — sin teléfono: worker +
   JWT real de la cuenta del revisor + su crédito. Es la primera vez que se
   ejecutaría. **Confirma además que el interruptor de degradación se enciende
   de vuelta** al aceptarse el primer envío.
3. **Productos en Play** y Offering en RevenueCat.
4. **Compilar v4** (`versionCode` 4), verificar con grep que la llave de
   RevenueCat quedó horneada, entregar a Play.
5. **Probar en el teléfono** lo único que exige teléfono: la compra por Play y
   la generación desde la app.

> **El paso 4 no depende del 1 ni del 2.** Las llaves de Higgsfield y la
> `service_role` viven en el worker, no en el APK: se pueden arreglar mientras
> Play revisa. Y desde el 16 sep, si el generador no está listo, la app **no
> ofrece** "Anima tu recuerdo" en vez de mandar al usuario a chocar. Esperar a
> tener todo resuelto antes de compilar cuesta días de revisión que no se
> recuperan.

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

- **Ventana del lanzamiento:** comparte el 16, la lista cierra el 18, se lanza
  el 19. Guía operativa en `LANZAMIENTO.md`.
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

## Listo — NO rehacer

- **v3 publicada en Play** (8 sep). Cuenta de servicio de Google Cloud validada.
- **RevenueCat**: proyecto INKAR, credenciales validadas, llave pública de
  Android en `.env` y horneada en el bundle.
- **Analizador vivo en Railway**, conectado a la activación, veredicto guardado
  en `tattoos` (migración 007).
- **Generación de video construida**: worker `/generar`, tabla `generaciones`,
  reserva con cerrojo y reembolso automático, reanudación tras reinicio
  (migración 009). **Sin ejecutar nunca.**
- **Interruptor de degradación** (16 sep): `worker/disponibilidad.js`, el estado
  en `/health`, y la tarjeta apagada en la elección de contenido.
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

## Ramas: una sola línea viva

`main` y la rama de trabajo de cada sesión apuntan al mismo commit. No hay
nada que reconciliar y **nunca se ha abierto un PR**: las sesiones commitean en
su rama y eso es main.

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
- **Capacitor empaqueta los assets** (`webDir: dist`): desplegar a Vercel NO
  actualiza la app instalada. Todo lo que deba llegar al teléfono exige build,
  `versionCode` nuevo y otra revisión.
- **La llave de RevenueCat se hornea al compilar.** Tiene que estar en `.env`
  ANTES del build; ponerla en Vercel no sirve para Android.
- El `.mind` y el video **deben servirse con su tipo MIME correcto**; si el
  servidor devuelve el index.html, MindAR revienta con un error de msgpack que
  no menciona la URL.
- Las rutas del SPA devuelven **200 aunque la página no exista**: verificar con
  navegador, nunca con `curl` a secas.
- Los generadores de video **no respetan el color de fondo pedido**; la capa de
  video mide el color real. `prompt_optimizer` va en `false` o se pierde el verde.
- Three 0.151 usa `encodings_fragment`, no `colorspace_fragment`.
- El dev server corre en **HTTPS** autofirmado y un navegador automatizado lo
  rechaza. Para revisiones visuales: `npm run build` y servir `dist` por HTTP.
- **Las funciones con `auth.uid()` se prueban con un JWT real por PostgREST**,
  no simulando sesión por SQL. La cuenta del revisor (`prueba@inkar.app`) abre
  sesión por `POST /auth/v1/token?grant_type=password`.
- Los textos que redacta el **worker** no pasan por el diccionario del cliente:
  necesitan un `code` estable o llegan sin traducir.
- **Las capturas del navegador emulado muestran franjas negras** a los lados: es
  el capturador, no la app. Medir el ancho con JS antes de "arreglar" nada.
- **En una sesión en la nube, `npm ci` instala sin devDependencies** porque
  `canvas` (nativo, vía `mind-ar`) falla al compilar y aborta el paso. Se
  resuelve con `npm ci --include=dev --ignore-scripts`. Para levantar el
  **worker** sí hace falta canvas de verdad:
  `apt-get update && apt-get install -y libpango1.0-dev libjpeg-dev libgif-dev`
  y luego `npm rebuild canvas`.

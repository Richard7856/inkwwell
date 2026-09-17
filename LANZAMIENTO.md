# Guía de lanzamiento — lo que tiene que hacer Richard

> **Ventana decidida el 16 de septiembre de 2026.**
>
> | | |
> |---|---|
> | **Hoy 16** | Se comparte la landing. Empieza la cuenta de dos días |
> | **Jueves 18** | Cierra la lista de espera |
> | **Viernes 19** | **Lanzamiento.** La v4 tiene que estar PUBLICADA, no entregada |
>
> Para el estado técnico y las decisiones abiertas, `PROXIMA-SESION.md`.
> Para el porqué de cada decisión, `DECISIONS.md`.

---

## Lo que hay que entender antes de empezar

**La revisión de Play tarda cerca de un día y no se puede apurar.** Si la v4 se
entrega el 18 por la noche, el 19 no hay lanzamiento. Todo lo de abajo está
ordenado para que **el bundle salga hoy**.

**La v3 que está publicada no puede cobrar.** La llave de RevenueCat se horneó
vacía y no hay pantalla de compra. Eso significa que la facturación —la métrica
que pondera el premio del concurso— está en **cero hasta que la v4 esté
publicada**. No es un detalle del lanzamiento: es la entrega del concurso.

**Lo que se hornea al compilar y lo que no.** Es la distinción que decide el
orden de todo:

| Se hornea en el APK (tiene que estar ANTES del build) | Se lee en vivo (se puede arreglar después) |
|---|---|
| `VITE_REVENUECAT_ANDROID_KEY` | Productos en Play |
| `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` | La Offering de RevenueCat |
| `VITE_COMPILER_URL` | Variables del worker en Railway |
| `VITE_PUBLIC_URL` | El saldo de Higgsfield |

**Por eso el bloque A no espera al B.** Recargar Higgsfield y configurar Railway
no cambian una sola línea del bundle. Si los haces primero, pierdes el día de
revisión de Play para nada.

---

## Bloque A — hoy, y en este orden (≈2 h)

Esto es lo único que bloquea el bundle.

### A1. Productos en Play  ·  ~20 min

Play Console → tu app → **Monetizar con Play → Productos → Productos únicos**
(NO suscripciones).

| ID del producto | Créditos | Qué es |
|---|---|---|
| `creditos_primero` | 1 | Primer crédito a mitad de precio. Solo se ofrece a quien nunca ha comprado |
| `creditos_1` | 1 | Precio normal |
| `creditos_3` | 3 | |
| `creditos_5` | 5 | |

⚠️ **Los IDs tienen que ser exactamente esos.** Están escritos en
`supabase/functions/revenuecat-webhook/index.ts` y en `src/pages/Creditos.jsx`:
un producto con otro ID cobra y **no acredita nada**.

Cada producto hay que **activarlo**, no solo crearlo.

### A2. RevenueCat  ·  ~20 min

1. **Products** → importar o dar de alta los cuatro IDs de arriba.
2. **Offerings** → crear una y marcarla **Current**, con los cuatro paquetes.

   ⚠️ Este es el paso que se olvida y falla en silencio: si los productos
   existen pero no están en una Offering, `getOfferings()` devuelve una lista
   **vacía sin ningún error**. La pantalla de créditos sale en blanco y parece
   un bug de la app.

3. **Integrations → Webhooks**:
   - URL: `https://duzfvyfhsvhavptuxehi.supabase.co/functions/v1/revenuecat-webhook`
   - Authorization header: el mismo valor que tengas en el secreto
     `REVENUECAT_WEBHOOK_SECRET` de Supabase.

   La función ya está desplegada y activa (v3). Si el secreto no coincide,
   **la compra cobra y el crédito nunca llega**.

### A3. Compilar y entregar la v4  ·  ~40 min

```bash
# 1. Subir el versionCode — Play rechaza dos versiones con el mismo número
#    android/app/build.gradle:  versionCode 3  →  versionCode 4

# 2. Confirmar que el .env tiene la llave ANTES de compilar
grep REVENUECAT .env          # el valor debe empezar con goog_

# 3. Construir solo el frontend y COMPROBAR antes de gastar el build de Gradle
npm run build
grep -c goog_ dist/assets/*.js
```

**Si todas las líneas dan `0`, la llave no se horneó — que es exactamente lo que
pasó en la v3.** Revisa el `.env` y repite; no sigas. Al menos un archivo tiene
que dar 1 o más.

```bash
# 4. Ahora sí, el bundle firmado
npm run aab
```

Play Console → **Producción → Crear versión** → subir `inkar.aab`.

> **Entrega hoy aunque el generador todavía no funcione.** Desde el 16 de
> septiembre, si el worker no puede generar, la app **deja de ofrecer** "Anima
> tu recuerdo" y muestra el catálogo: nadie paga por algo que no va a llegar.
> Ese seguro existe justamente para que la v4 no tenga que esperar al bloque B.

### A4. Ficha y declaración de datos  ·  ~20 min

Se puede hacer mientras Play revisa el bundle.

- **Ficha**: pegar `brand/textos-ficha.md`, los dos idiomas. La publicada
  describe el producto anterior ("eliges un modelo 3D del catálogo").
- **Declaración de datos** — dos correcciones obligatorias:
  - **Fotos** pasa de *no compartido* a **compartido**. Higgsfield es un tercero
    real y la foto del recuerdo sale a su infraestructura.
  - Agregar **historial de compras**. En la v3 se omitió a propósito porque la
    app no podía cobrar; ahora sí puede.

  Declararlo mal en cualquiera de las dos direcciones es declaración falsa y es
  causa de retiro.

---

## Bloque B — mientras Play revisa (≈1 h)

Nada de esto toca el bundle. Se puede hacer el 17 o el 18.

### B1. Recargar Higgsfield Cloud

~$10 USD ≈ 35 videos. Generar cuesta **$0.28** con el modelo configurado, contra
$25 por crédito de usuario: entre 1% y 2% del neto.

⚠️ **Higgsfield Cloud (la API) y el plan Plus del panel son cuentas distintas.**
Pagar la suscripción del panel **no** alimenta el producto: la app solo usa la
API. El 9 de septiembre el panel tenía 12.5 créditos y la API rechazó un video
con `not_enough_credits`. De paso: revisa que no te estén cobrando el Plus sin
usarlo.

### B2. Variables del worker en Railway

Railway → tu servicio → **Variables**:

| Variable | Dónde se consigue |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role**, NO la anónima |
| `HIGGSFIELD_KEY_ID` | Higgsfield Cloud → API keys |
| `HIGGSFIELD_KEY_SECRET` | Higgsfield Cloud → API keys |

Comprobar que quedó (debe responder `"disponible": true`):

```bash
curl -s https://inkwwell-production.up.railway.app/health
```

Hoy responde `"motivo": "no_configurado"`.

### B3. La primera generación de la historia

**Nunca se ha generado un video. Cero, jamás.** Todo ese camino está escrito
contra la documentación, no contra una corrida real. Antes de que lo estrene un
cliente que pagó:

```bash
cd worker
node --env-file=.env generar-cli.js              # revisa y estima, NO gasta
node --env-file=.env generar-cli.js --generar    # envía uno de verdad (~$0.28)
```

Abre el archivo que deja en `/tmp/inkar-prueba.mp4`: **el fondo tiene que salir
verde y plano.** La capa de AR mide ese color para recortar; si sale con paisaje
o con texto, el problema es el prompt y se arregla sin recompilar nada.

---

## Bloque C — el 19, antes de anunciar (≈30 min)

1. **Confirmar que la v4 dice PUBLICADA**, no "en revisión". Publicada ≠
   entregada, y es la palabra que exige el concurso.
2. **Comprar de verdad desde el teléfono.** Es lo único que no se puede probar
   de otra forma. Verificar que el crédito aparece en el perfil: eso prueba que
   el webhook está bien conectado.
3. **Generar un video desde la app**, de punta a punta.
4. Recién entonces, anunciar.

---

## Aparte y urgente — no es del lanzamiento

**La verificación de identidad de desarrollador vence el 30 de septiembre**, el
mismo día que cierra el concurso. Si Google retira la app ese día, no hay
entrega: el requisito del concurso es estar *publicada*.

El trámite puede tardar días y no depende de ti una vez enviado. **Hazlo esta
semana, no el 29.** Play Console → Configuración → Identidad del desarrollador.

**Respalda la llave de firma.** `~/inkar-release.jks` existe en una sola
máquina. Con Play App Signing perderla no es irreversible —se le pide a Google
que la restablezca— pero el trámite tarda días, y días es lo que no hay.

---

## Lo que NO tienes que hacer

Para que no gastes tiempo en cosas que ya están:

- La función del webhook **ya está desplegada** en Supabase y activa.
- Las migraciones de base **ya están aplicadas**: créditos, estudios, promos,
  generaciones.
- El código promocional **`SHIPATON`** ya existe: 1 crédito, 200 usos. Es lo que
  usa el revisor de Play para probar sin pagar.
- La política de privacidad **ya declara** a Higgsfield y las compras.
- El worker de compilación **ya está vivo** en Railway y el analizador responde.

---

## Si algo sale mal, empieza por aquí

| Síntoma | Casi siempre es |
|---|---|
| La pantalla de créditos sale vacía, sin error | Faltó marcar la Offering como **Current** en RevenueCat |
| La compra cobra pero el crédito no llega | El `Authorization` del webhook no coincide con `REVENUECAT_WEBHOOK_SECRET` |
| La app no ofrece "Anima tu recuerdo" | El worker no puede generar. `curl .../health` y mira `generacion.motivo` |
| `/generar` responde 503 | Faltan variables en Railway (B2) |
| Un video sale con paisaje en vez de fondo verde | El prompt, no el código. Se arregla sin recompilar |
| Play rechaza el bundle por versión | No subiste el `versionCode` |
| La app instalada no muestra los cambios | Capacitor empaqueta los assets: desplegar a Vercel **no** actualiza la app. Exige build, `versionCode` nuevo y otra revisión |

# Guía para subir la v4

> **Reescrita el viernes 18 de septiembre de 2026.** La versión anterior
> describía un estado de hace dos días que ya no es cierto en cuatro renglones:
> daba el worker por no configurado, la generación por nunca ejecutada y
> `versionCode` en 3. Todo lo de abajo está **medido hoy**, no supuesto.
>
> | | |
> |---|---|
> | **Viernes 18** (hoy) | Se construye lo que falta. Se comparte la landing |
> | **Sábado 19** | **Último día útil para entregar el bundle** si se quiere publicar el lunes |
> | **Domingo 20** | Cierra la oferta de la lista |
> | **Lunes 21** | **Lanzamiento.** La v4 tiene que estar PUBLICADA, no entregada |
>
> La revisión de Play tarda cerca de un día y no se apura. Entregar el domingo
> es apostar; el lunes ya no alcanza.

---

## Estado verificado hoy

| | | Cómo se comprobó |
|---|---|---|
| Worker `/health` | ✅ 200, `disponible: true` | `curl` a Railway |
| Llaves en Railway | ✅ puestas | el `/health` dice `motivo: ok`, no `no_configurado` |
| **Generación por el worker** | ✅ **PROBADA de punta a punta** | 4 filas en `generaciones`: 2 en `lista` **con video guardado**, 1 rechazada por saldo, 1 **reembolsada** |
| Libro mayor de créditos | ✅ reserva, rechazo y reembolso ejecutados | pares `consumo`/`reembolso` reales en `credit_ledger` |
| Buckets de Storage | ✅ `videos`, `mind-files`, `tattoo-images`, públicos | consulta a `storage.buckets` |
| Webhook de cobro | ✅ desplegado y alcanzable, secreto funcionando, `verify_jwt` apagado | POST sin secreto → 401 con **nuestro** JSON, no el de la plataforma |
| Sitio | ✅ 200, video y modelo 3D sirviendo | `curl` a `www.inkar.app` |
| `versionCode` | ✅ **4** | subido hoy |
| **Compras** | ❌ **0. El cobro nunca se ha ejercido** | `credit_ledger` no tiene una sola fila con motivo `compra` |
| Lista de espera | ⚠️ **1 persona** | la landing sigue sin compartirse |

**Lo que esto cambia respecto a la guía anterior:** el bloque que se llamaba
"mientras Play revisa" —recargar Higgsfield, configurar Railway, probar la
primera generación— **ya está hecho**. El motor de video funciona por el camino
de la app, con dinero real y con reembolso real.

**Lo que queda sin probar es el cobro, y ahora es lo único.** Cero compras
significa que el camino Play → RevenueCat → webhook → crédito nunca ha corrido
completo. Es la métrica que pondera el concurso y el único tramo donde un fallo
se ve así: el cliente paga, el crédito no llega, y nadie recibe un error.

---

## Lo que se construyó hoy (ya está en `main`)

### 1. Se cerró un agujero de créditos infinitos  ·  `supabase/migrations/010`

`reembolsar_generacion` es `SECURITY DEFINER`, recibe `p_user` como parámetro y
**no revisa `auth.uid()`** — correcto, porque la llama el worker en nombre de
otro. Lo que estaba mal es que además tenía `EXECUTE` para `anon`, el permiso
por omisión de Supabase. La llave anónima viaja pública en el bundle, así que
cualquiera podía pedir:

```
POST /rest/v1/rpc/reembolsar_generacion
{"p_user":"<cualquier usuario>","p_generacion":"<uuid al azar>"}
```

y quedarse con **+1 crédito**, repitiendo con un UUID nuevo cada vez. Su gemela
`reservar_credito_generacion` permitía lo contrario: vaciarle el saldo a otro.

**Ya está aplicado a producción y verificado**: `anon` y `authenticated`
perdieron el permiso, `service_role` lo conserva, y se comprobó que el worker
sigue pudiendo llamarlas sin escribir nada. Las funciones que sí usa la app
—`saldo_creditos`, `consumir_creditos`, `canjear_codigo`— leen `auth.uid()` y
se quedaron abiertas, que es lo correcto.

Para revertir, si hiciera falta: `grant execute on function
public.reembolsar_generacion(uuid,uuid) to anon, authenticated;`

### 2. `supabase/config.toml`, que no existía

`verify_jwt = false` vivía **solo en el estado desplegado**. El día que alguien
corriera `supabase functions deploy revenuecat-webhook` sin ese archivo, la
función volvería al valor por omisión y la plataforma rechazaría a RevenueCat
con 401 **antes** de ejecutar el código. Desde la app no se vería nada: la
compra se cobra en Play igual y el crédito nunca llega.

### 3. El webhook marca el precio de entrada repetido

`creditos_primero` (mitad de precio) se esconde **solo en el cliente**. Ni Play
ni RevenueCat saben limitar un producto único por usuario, así que un cliente
modificado podría comprarlo otra vez. No se rechaza —la persona pagó— pero
queda marcado en `detalle.primero_repetido` y gritado en los registros, para
poder distinguir "pasó una vez" de "está pasando".

⚠️ **Este cambio necesita redespliegue** (paso A4). Lo demás ya está vivo.

### 4. Contexto y limpieza

`CLAUDE.md` en el repo (las sesiones en la nube arrancaban sin contexto del
producto), `README.md` de verdad en lugar de la plantilla de Vite, y un error
falso de ESLint menos. Quedan **4 avisos** de `set-state-in-effect`: no son
fallos y arreglarlos cambia comportamiento — no se tocan antes de lanzar.

---

## Bloque A — lo que bloquea el bundle

### A1. La llave de RevenueCat en `.env`  ·  2 min  ·  **es lo único que se hornea**

```bash
grep REVENUECAT .env       # tiene que empezar con goog_
```

Si no está, la v4 nace sin poder cobrar igual que la v3. **Este es el error que
ya se cometió una vez.**

### A2. Productos en Play  ·  ~20 min

Play Console → **Monetizar con Play → Productos → Productos únicos** (NO
suscripciones).

| ID del producto | Créditos |
|---|---|
| `creditos_primero` | 1 — precio de entrada, mitad de precio |
| `creditos_1` | 1 |
| `creditos_3` | 3 |
| `creditos_5` | 5 |

⚠️ Los IDs tienen que ser **exactamente** esos: están escritos en
`supabase/functions/revenuecat-webhook/index.ts` y en `src/pages/Creditos.jsx`.
Otro ID cobra y no acredita nada. Y hay que **activarlos**, no solo crearlos.

### A3. RevenueCat  ·  ~20 min

1. **Products** → dar de alta los cuatro IDs.
2. **Offerings** → crear una, meter los cuatro paquetes, marcarla **Current**.

   Sin esto `getOfferings()` devuelve vacío **sin ningún error**. La app ya lo
   maneja —muestra "Todavía no hay paquetes a la venta" en vez de una pantalla
   en blanco— pero nadie puede comprar.

3. **Integrations → Webhooks**:
   - URL: `https://duzfvyfhsvhavptuxehi.supabase.co/functions/v1/revenuecat-webhook`
   - Authorization: el mismo valor que el secreto `REVENUECAT_WEBHOOK_SECRET`
     de Supabase.

### A4. Redesplegar el webhook  ·  2 min

```bash
supabase functions deploy revenuecat-webhook
```

Con `supabase/config.toml` en el repo, el CLI ya manda `verify_jwt = false`. Si
tu CLI es viejo y no lo lee, agrega `--no-verify-jwt`.

**Comprueba que quedó bien antes de seguir** — sin secreto tiene que contestar
nuestro JSON, no el de la plataforma:

```bash
curl -s -X POST -H "Content-Type: application/json" -d '{"event":{"type":"TEST"}}' \
  https://duzfvyfhsvhavptuxehi.supabase.co/functions/v1/revenuecat-webhook
```

Debe responder exactamente `{"error":"No autorizado"}`. Si responde otra cosa
—sobre todo si menciona JWT— el `verify_jwt` quedó encendido y **las compras no
acreditarían**.

### A5. Probar el cobro SIN comprar  ·  5 min  ·  **no te lo saltes**

Es el único tramo que nunca ha corrido. RevenueCat lo puede ejercer solo:

**Integrations → Webhooks → Send test event.**

Va a llegar con un `product_id` de ejemplo que no es ninguno de los nuestros, y
eso es justo lo que se quiere: la respuesta debe ser **200** con
`{"ignorado":"producto desconocido"}`. Eso prueba la URL, el secreto y el
`verify_jwt` **sin acreditar nada**. Si sale 401, el Authorization no coincide.

### A6. Construir y entregar  ·  ~40 min

```bash
npm run build
grep -c goog_ dist/assets/*.js
```

**Si todas las líneas dan `0`, la llave no se horneó — vuelve a A1 y no sigas.**
Al menos un archivo tiene que dar 1 o más.

```bash
npm run aab
```

Play Console → **Producción → Crear versión** → subir `inkar.aab`.

> `versionCode` ya está en 4. Si entregas dos veces el mismo día, súbelo otra vez.

### A7. Ficha y declaración de datos  ·  ~20 min  ·  se puede hacer mientras revisan

- **Ficha**: pegar `brand/textos-ficha.md`, los dos idiomas. La publicada
  describe el producto anterior ("eliges un modelo 3D del catálogo").
- **Declaración de datos**, dos correcciones obligatorias:
  - **Fotos** pasa de *no compartido* a **compartido** — Higgsfield es un
    tercero real y la foto sale a su infraestructura.
  - Agregar **historial de compras**. En la v3 se omitió porque la app no podía
    cobrar; ahora sí puede.

  Declararlo mal en cualquiera de las dos direcciones es declaración falsa y es
  causa de retiro.

---

## Bloque B — el 20 o el 21, con la v4 publicada

1. **Confirmar que dice PUBLICADA**, no "en revisión". El concurso exige
   publicada, y no es lo mismo que entregada.
2. **Comprar de verdad desde el teléfono.** Es lo único que no se puede probar
   de otra forma. Verificar que el crédito aparece en el perfil: eso, y solo
   eso, prueba que Play → RevenueCat → webhook → `credit_ledger` está completo.
3. **Generar un video desde la app**, de punta a punta. El worker ya lo hizo
   dos veces, pero nunca disparado desde un teléfono.
4. Recién entonces, anunciar.

---

## Aparte, y más urgente que el lanzamiento

**La verificación de identidad de desarrollador vence el miércoles 30 de
septiembre**, el mismo día que cierra el concurso. Si Google retira la app ese
día no hay entrega, porque el requisito es estar *publicada*. El trámite tarda
días y no depende de ti una vez enviado. Play Console → Configuración →
Identidad del desarrollador. **Hoy, no el 29.**

**Respalda `~/inkar-release.jks`.** Existe en una sola máquina. Con Play App
Signing perderla no es irreversible, pero el trámite tarda días — y días es lo
que no hay.

**Comparte la landing.** La lista tiene 1 persona, y no es por falta de interés:
nadie la ha visto. La oferta de la lista vence el domingo 20 según la propia
landing; si se comparte el domingo, la oferta nace vencida.

**Borra la rama muerta** `claude/retomar-proyecto-contexto-u3o686`. Una sesión
en la nube no puede (403 del proxy). Desde GitHub → Branches, o
`git push origin --delete claude/retomar-proyecto-contexto-u3o686`.

---

## Si algo sale mal

| Síntoma | Casi siempre es |
|---|---|
| "Todavía no hay paquetes a la venta" | Faltó marcar la Offering como **Current** (A3) |
| La compra cobra pero el crédito no llega | El `Authorization` del webhook no coincide, **o** `verify_jwt` quedó encendido al redesplegar (A4) |
| El webhook responde algo que menciona JWT | `verify_jwt` encendido. Es el fallo más silencioso de todos |
| La app no ofrece "Anima tu recuerdo" | El worker no puede generar. `curl .../health` y mira `generacion.motivo` |
| Un video sale con paisaje en vez de fondo verde | El prompt, no el código. Se arregla sin recompilar |
| Play rechaza el bundle por versión | `versionCode` repetido |
| La app instalada no muestra los cambios | Capacitor empaqueta `dist/`: desplegar a Vercel **no** actualiza la app. Exige build, `versionCode` nuevo y otra revisión |
| Un usuario tiene más créditos de los que compró | Revisa `credit_ledger` por motivo `reembolso` con referencias que no correspondan a una generación suya. El agujero se cerró hoy, pero conviene mirar el histórico |

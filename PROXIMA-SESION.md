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

**El lanzamiento estaba planeado para el 17 de septiembre y la v4 no existe.**

Sigue en `versionCode` 3, sin compilar ni entregar. La revisión de Play tarda
cerca de un día. **Hay una decisión pendiente de Richard y nada avanza sin
ella:** o arranca hoy mismo el desbloqueo completo, o se mueve la fecha al
18-19 (la quincena sigue en el bolsillo y da un día de colchón).

**No dar por hecho que eligió.** Se le planteó el 15 sep y no respondió.

---

## El estado real, verificado (no supuesto)

| | |
|---|---|
| App en Play | ✅ v3 publicada desde el 8 sep |
| inkar.app | ✅ responde 200 |
| Worker `/health` | ✅ 200, analizador vivo |
| Worker `/generar` | ⚠️ **503 `no_configurado`** — Railway no tiene las llaves de generación |
| `SUPABASE_SERVICE_ROLE_KEY` en `worker/.env` | ❌ falta |
| Llaves de Higgsfield en `worker/.env` | ✅ válidas |
| Saldo en Higgsfield Cloud | ✅ **recargado el 16 sep** — primera generación real exitosa |
| Repo | ✅ todo commiteado y empujado |

**Lo que dice la base.** Ojo con leer el cero de generaciones: el 16 sep sí se
generó un video real, pero **directo contra Higgsfield, sin pasar por el
worker**, así que no dejó fila en `generaciones`. El camino de la app sigue sin
ejercitarse.

- **0** filas en `generaciones` — el worker nunca ha corrido una
- **1** generación real contra Higgsfield (16 sep): 240 s, croma correcto
- **0** compras reales
- **0** estudios registrados
- **1** persona en la lista de espera (Richard **no ha compartido la landing**;
  no es falta de interés)
- **5** tatuajes, **0** medidos por el analizador, **0** con video

---

## El costo por video ya se conoce

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
**La API ya está recargada** (16 sep) y el primer envío real fue aceptado.

---

## Lo primero, en orden

1. **Decidir la fecha de lanzamiento** (ver arriba). Bloquea todo lo demás.
2. **Poner `SUPABASE_SERVICE_ROLE_KEY`** en `worker/.env`. Es lo único que
   bloquea la prueba del worker.
3. **Probar el camino completo por el WORKER** — la generación contra Higgsfield
   ya se probó el 16 sep y funciona (240 s, fondo verde plano, croma correcto,
   ver `DECISIONS.md`). Lo que falta es lo que rodea: reserva de crédito con
   cerrojo, copia a nuestro Storage, asignación al tatuaje y reembolso ante
   fallo. Necesita la `service_role`.
4. **Productos en Play** y Offering en RevenueCat.
5. **Compilar v4** (`versionCode` 4), verificar con grep que la llave de
   RevenueCat quedó horneada, entregar a Play.
6. **Probar en el teléfono** lo único que exige teléfono: la compra por Play y
   la generación desde la app.

---

## Decisiones ABIERTAS — no darlas por tomadas

**1. La fecha de lanzamiento.** 17 (original) contra 18-19 (recomendado, con
colchón). Sin respuesta.

**2. La oferta de la lista de espera.** Richard propuso "50% de descuento en el
primer tatuaje" para quien se registre. Problema: **el primer crédito a $12.50
ya es el precio de todos**, así que a la lista no le daría nada, y presentar el
precio normal como descuento exclusivo se lee como descuento inventado.
Propuesta: **primer video gratis para la lista**, por código promocional topado
(`codigos_promo.usos_max` ya existe). Sin respuesta.

**3. La comisión de estudios fundadores.** Richard propuso "30% por un año". Lo
construido es **los primeros 20, permanente** (`cupo_fundadores()` = 20). Se
recomendó conservarlo: "primeros 20" urge y "un año" no, y al mes 13 habría que
bajarle la comisión a alguien con quien se construyó un año de relación.
Propuesta intermedia: **"30% para los primeros 20 que entren antes del
lanzamiento", permanente.** Sin respuesta.

**4. Publicar el precio en la landing.** Ahora que el costo se conoce, ya se
puede decidir. Recomendación previa: el mensaje que instala es "el primero va
por nuestra cuenta"; la conversación del dinero va después de que vean el
producto.

**5. Cambios propuestos a la landing** (pendientes): la fecha en el héroe —hoy
no aparece por ningún lado—, la oferta de la lista, la fecha límite de estudios,
y **una segunda invitación al final**: el formulario está arriba, y al terminar
las cuatro secciones que de verdad venden no hay dónde apuntarse.

**6. Ajustar el texto de la espera.** La generación real tardó **240 segundos** y
`GeneracionStatus` dice "suele tardar de 1 a 3 minutos". Se queda corto justo en
la primera impresión. Propuesta: **"de 2 a 5 minutos"**. Cambio de una línea,
sin decidir.

**7. Interruptor de degradación** (propuesto, no construido): que la app deje de
ofrecer "Anima tu recuerdo" cuando el generador no está disponible. Seguro
contra quedarse sin saldo en plena semana del concurso.

Lenguaje: **"tu primer video"**, no "tu primer tatuaje" — no vendemos tatuajes.

---

## Bloqueado por Richard

| | |
|---|---|
| **`SUPABASE_SERVICE_ROLE_KEY`** | Settings → API → service_role (NO la anon). Va en `worker/.env` y en Railway |
| **Las 4 variables de generación en Railway** | `/generar` responde 503 hoy. Detalle en `worker/DEPLOY.md` |
| **Productos en Play** | `creditos_primero`, `creditos_1`, `creditos_3`, `creditos_5`. Menú: Monetizar con Play → Productos → **Productos únicos** |
| **Offering en RevenueCat** | Sin ella `getOfferings()` devuelve vacío sin error |
| **Pegar la ficha nueva** | `brand/textos-ficha.md`, los dos idiomas |
| **Corregir la declaración de datos en Play** | "Fotos" pasa a **compartido** (Higgsfield es tercero real) y se agrega **historial de compras** |
| **Verificación de identidad de desarrollador** | ⚠️ Vence el **30 sep**, el mismo día que el concurso. Si no, Google retira la app |
| **Respaldo de la llave de firma** | ⬜ `~/inkar-release.jks` existe en una sola máquina. Ver `SETUP.md` |
| **Compartir la landing** | La lista tiene 1 persona porque no se ha movido |

---

## Listo — NO rehacer

- **v3 publicada en Play** (8 sep). Cuenta de servicio de Google Cloud validada.
- **RevenueCat**: proyecto INKAR, credenciales validadas, llave pública de
  Android en `.env` y horneada en el bundle.
- **Analizador vivo en Railway**, conectado a la activación, veredicto guardado
  en `tattoos` (migración 007).
- **Generación de video construida**: worker `/generar`, tabla `generaciones`,
  reserva con cerrojo y reembolso automático, reanudación tras reinicio
  (migración 009). **La parte de Higgsfield está probada** (16 sep, ver
  `DECISIONS.md`); lo que rodea —crédito, Storage, asignación, reembolso— no.
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
  revisar créditos, así que una cuenta vacía también sale "disponible". Solo un
  envío real lo confirma (`403 not_enough_credits`). Una versión anterior del
  script prometía detectarlo y era falso.
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

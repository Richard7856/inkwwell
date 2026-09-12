# Dónde retomar

> **Actualizado el 12 de septiembre de 2026.** Reescrito completo: la versión
> anterior acumulaba parches y mandaba a perseguir cosas ya resueltas (decía que
> la cuenta de servicio "sigue sin arrancar" cuando estaba validada).
>
> Si vienes de otra máquina, primero `SETUP.md`. Contexto del sprint en
> `SHIPATON.md`; el porqué de cada decisión técnica en `DECISIONS.md`.

---

## La fecha que ordena todo: lanzamiento público el 17 de septiembre

**La app está publicada desde el 8 sep, pero no está lanzada.** Son dos cosas
distintas y la diferencia es deliberada (decisión de Richard):

- Publicada en Play = requisito del concurso, cumplido el día 2.
- **Lanzada = cuando se anuncia y se empuja**, en un día que Richard tenga libre
  para atender lo que falle.

**Por qué el 17:** es después de la quincena del 15, cuando la gente tiene
dinero. Se evitó el 15-16 a propósito — son el Grito y la Independencia: hay
dinero y tiempo libre, pero la atención está con la familia, no en instalar
apps.

**Por qué la landing sigue diciendo "avísame":** la lista de espera junta
demanda antes, para que la gente aparte dinero. No es un resto viejo, es la
herramienta del plan.

**Los estudios no esperan a la quincena.** Son negocios, no consumidores
esperando su pago: se registran desde ya, y cada uno llega con cartera propia.

### ⚠️ La cuenta que aprieta

**La v4 tiene que estar PUBLICADA antes del 17.** La revisión de Play tardó ~1
día. Hay que **entregarla a más tardar el 14-15**. Hoy es 12.

---

## Lo primero, en orden

1. **Probar la generación de video de punta a punta.** Es el producto y nunca
   se ha ejecutado con llaves reales. Necesita saldo en Higgsfield Cloud y la
   `service_role` de Supabase en `worker/.env`. Con eso se corre en local, sin
   teléfono: worker + token real de la cuenta del revisor + su crédito.
   Ahí sale **el costo real por video**, el último número que falta para
   cerrar precios.
2. **Productos en Play Console** — ver "Bloqueado por Richard".
3. **Compilar v4** (`versionCode` 4), verificar con grep que la llave de
   RevenueCat quedó dentro, **entregar a Play**.
4. **Probar en el teléfono** lo que no se puede probar sin él: la compra por
   Play y la generación desde la app. El canje, `ha_comprado` y la atribución
   ya se probaron con sesión real por PostgREST (9 sep).

---

## Decisiones ABIERTAS — no están resueltas

No las tomes como decididas. Quedaron propuestas el 9-12 sep sin respuesta final.

**1. La oferta de la lista de espera.**
Richard propuso "50% de descuento en el primer tatuaje" para quien se registre.
Problema: **el primer crédito a $12.50 ya es el precio de todos**, sin
registrarse. Ofrecerlo a la lista no le da nada, y presentar el precio normal
como descuento exclusivo se lee como descuento inventado (PROFECO).
Propuesta: **primer video gratis para la lista**, por código promocional topado
(`codigos_promo.usos_max` ya existe). Pendiente.

**2. La comisión de estudios fundadores.**
Richard propuso "30% por un año en vez de 20%". Lo construido es distinto:
**los primeros 20 estudios, permanente** (`cupo_fundadores()` devuelve 20). Se
recomendó conservarlo — "primeros 20" urge y "un año" no; y al mes 13 habría
que bajarle la comisión a alguien con quien se construyó un año de relación.
Propuesta intermedia: **"30% para los primeros 20 que entren antes del 17 de
septiembre", permanente.** Pendiente.

**3. Publicar el precio en la landing.** Recomendación: **todavía no**, hasta
medir el costo por video. Subir un precio anunciado es peor que no anunciarlo.

**4. Cambios propuestos a la landing** (pendientes de aprobar):
- La fecha del 17 en el héroe — hoy no aparece por ningún lado.
- La oferta de la lista (punto 1).
- La fecha límite para estudios (punto 2).
- **Una segunda invitación al final.** El formulario está arriba; después
  vienen las cuatro secciones que de verdad venden, y al terminarlas no hay
  dónde apuntarse.

**5. Interruptor de degradación** (propuesto, no construido): que el worker
sepa si el generador está disponible y la app deje de ofrecer "Anima tu
recuerdo" cuando no puede cumplirlo. Seguro contra quedarse sin saldo en plena
semana del concurso.

Lenguaje: **"tu primer video"**, no "tu primer tatuaje" — no vendemos tatuajes.

---

## Bloqueado por Richard

| | Estado |
|---|---|
| Saldo en **Higgsfield Cloud** | Sin saldo al 9 sep (`403 not_enough_credits`). Es una cuenta distinta del plan Plus del panel |
| `SUPABASE_SERVICE_ROLE_KEY` | Falta. Va en `worker/.env` y en Railway |
| Las 4 variables de generación en **Railway** | Sin confirmar. Detalle en `worker/DEPLOY.md` |
| Productos en Play: `creditos_primero`, `creditos_1`, `creditos_3`, `creditos_5` | Sin crear. Menú: Monetizar con Play → Productos → **Productos únicos** |
| Productos dados de alta en RevenueCat **y metidos en una Offering** | Sin Offering, `getOfferings()` devuelve vacío sin error |
| Pegar la ficha nueva (`brand/textos-ficha.md`) | Sin confirmar |
| **Corregir la declaración de datos** en Play | "Fotos" pasa a **compartido** (Higgsfield es tercero real) y se agrega **historial de compras** |
| **Verificación de identidad de desarrollador** | ⚠️ Vence el **30 sep**, el mismo día que el concurso. Si no, Google retira la app |
| **Respaldo de la llave de firma** | ⬜ Solo existe en una máquina. Ver `SETUP.md` |

---

## Listo — NO rehacer

- **v3 publicada en Play** (8 sep). Cuenta de servicio de Google Cloud validada.
- **RevenueCat**: proyecto INKAR, credenciales validadas, llave pública de
  Android en `.env` y horneada en el bundle.
- **Analizador vivo en Railway**, conectado a la activación, veredicto guardado
  en `tattoos` (migración 007).
- **Generación de video construida** (9 sep): worker `/generar`, tabla
  `generaciones`, reserva con cerrojo y reembolso automático, reanudación tras
  reinicio (migración 009). Sin probar con llaves reales.
- **Modelo por defecto: MiniMax Hailuo-02 estándar.** Seedance y Veo NO están
  disponibles en esta cuenta. `worker/modelos.js` dice cuáles sí, sin gastar.
- **Flujo de compra**, canje de códigos, primer crédito a mitad de precio,
  estudios con atribución permanente (migración 008). `SHIPATON` = 1 crédito,
  200 usos.
- **Marca en todas las pantallas**: todo sale de `src/components/ui/`.
  `<Boton>` con variantes primario / secundario / peligro / enlace.
- **Perfil real** (`/profile`): tatuajes con estado y liga copiable.
- **Política de privacidad** declara a Higgsfield y las compras (9 sep).
- **Ficha de Play reescrita** en dos idiomas, con instrucciones del revisor.
- **Landing**: el formulario de arriba ya no intercepta estudios (12 sep).
- Borrado de cuenta, libro mayor de créditos, capa de video con croma.

---

## Trampas registradas, para no repetirlas

- **El catálogo documentado de Higgsfield NO es el que tu plan habilita.**
  Seedance da 404 y Veo 503 aunque estén en el spec. Antes de cambiar
  `HIGGSFIELD_ENDPOINT`: `cd worker && node --env-file=.env modelos.js`.
- **Los perfiles de modelo se escriben desde `openapi.json`, no desde un
  resumen.** La primera versión se escribió de un resumen y salió mal.
- **Higgsfield Cloud (API) y el plan Plus del panel son cuentas distintas.**
  Las llaves no gastan los créditos del panel.
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
- **Las capturas del navegador emulado muestran franjas negras** a los lados:
  es el capturador, no la app. Medir el ancho con JS antes de "arreglar" nada.

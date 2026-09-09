# Dónde retomar

> Escrito al cerrar la sesión del 7 de septiembre de 2026.
> Para el contexto completo ver `SHIPATON.md` y `DECISIONS.md`.

## Lo primero, en orden

1. **Catálogo con video desde la base.** Hoy `demo=zero` tiene las rutas fijas en
   `targetLoader.js`. Falta que `tattoos` acepte `video_url` y que el
   `DesignPicker` ofrezca piezas de video. Es lo que convierte el demo en
   producto.

2. **Perfil, mis tatuajes y liga compartible.** Cierra el loop de crecimiento.
   La infraestructura ya existe (`share_slug`, `getMyTattoos`, `ensureProfile`),
   falta la fusión de `.mind` en el worker, escribir `users.mind_url`, asignar
   `target_index` y la ruta `/u/:slug`.

## Lo primero: probar en el teléfono lo que se construyó a ciegas

Todo lo del 8 sep se verificó en navegador y en la base, pero **nada del cobro
se ha ejecutado con una sesión real en Android**. En cuanto existan los
productos en Play y la Offering en RevenueCat:

1. Compilar versionCode 4 (`.env` ya tiene la llave; verificar con grep antes
   de subir), instalar, entrar.
2. `/creditos`: canjear `SHIPATON` → el saldo sube a 1. Debe aparecer el
   paquete "Solo tu primera vez" a 12.50.
3. Comprar `creditos_primero` con una tarjeta de prueba de Play → el saldo sube
   y el paquete de entrada desaparece.
4. Activar un tatuaje con un código de estudio puesto → `users.estudio_id`
   queda escrito.
5. **Generar un video**: en la activación elegir "Anima tu recuerdo", subir la
   foto de Zero y una historia. Debe aparecer la espera, y en 1-3 min el video
   sobre el tatuaje al escanear. Si falla, el crédito debe volver solo (ver
   `credit_ledger`, motivo `reembolso`).

Si algo de eso falla, es el primer bug del cobro y va antes que cualquier otra cosa.

## Bloqueado por Richard

- **Variables del worker en Railway** (Variables): `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` (la de servicio, NO la anónima),
  `HIGGSFIELD_KEY_ID`, `HIGGSFIELD_KEY_SECRET`. Sin ellas `/generar` responde
  503 `no_configurado` y todo lo demás del worker sigue igual. Detalle en
  `worker/DEPLOY.md`.
- **El costo real por video en la API pública.** Los $0.60 cotizados eran del
  catálogo del panel (MiniMax), que la API no expone. Se sabe al hacer la
  primera generación real; el endpoint se cambia por `HIGGSFIELD_ENDPOINT`.

- **Redesplegar el worker en Railway.** El analizador ya está conectado al flujo
  de activación, pero las métricas las produce el worker: hasta que el
  contenedor tenga el código nuevo, el cliente recibe métricas nulas, las trata
  como "no medido" y deja pasar sin advertir. No falla nada a la vista — la
  función simplemente no existe. Es un `git push` y esperar el build.
- **Cuenta de servicio de Google Cloud** — tarda ~36h y sigue sin arrancar.
  Bloquea TODO el cobro. Es lo más urgente de su lado.
- Productos de créditos en Play Console, y sus identificadores exactos.
- La llave pública de RevenueCat → `VITE_REVENUECAT_ANDROID_KEY`.
- Resultado de la revisión de Play.
- Créditos de Higgsfield (quedan 12.5; un video del modelo bueno cuesta 22.5).
- **La prueba de Higgsfield cobra sola al tercer día** si no se cancela.

## Cosas que ya están listas y NO hay que rehacer

- Analizador conectado al flujo: compila y mide antes de elegir diseño, advierte
  sin bloquear, y guarda el veredicto en `tattoos` (migración 007, ya aplicada).
- Marca en la app (9 sep): todo botón, tarjeta, spinner y cabecera sale de
  `src/components/ui/`. No volver a escribir `bg-white text-black rounded-full`
  a mano: es `<Boton>`. `Profile.jsx` sigue siendo un esqueleto (v5).
- Esquema de precio y canal decidido y escrito en DECISIONS.md (8 sep). No
  reabrir sin datos: la primera transacción real es el dato que falta.
- Estudios, atribución y códigos promo: migración 008, `lib/estudios.js`,
  `lib/promo.js`, formulario en la landing, `?estudio=` en cualquier ruta.
- Código `SHIPATON` (1 crédito, 200 usos) ya existe en `codigos_promo`. Va en
  el envío de Devpost.

- Borrado de cuenta, política de privacidad, ambas desplegadas y probadas.
- Créditos: libro mayor, consumo con cerrojo, webhook. Las tres propiedades de
  seguridad verificadas contra producción.
- Capa de video 2D con recorte de croma, probada sobre piel real.
- Identidad de marca completa y generador de assets (`scripts/generar-marca.py`).
- Landing bilingüe con lista de espera, funcionando en producción.
- Textos de la ficha de Play en los dos idiomas (`brand/textos-ficha.md`).

## Trampas registradas, para no repetirlas

- El `.mind` y el video **deben servirse con su tipo MIME correcto**; si el
  servidor devuelve el index.html, MindAR revienta con un error de msgpack que no
  menciona la URL.
- Las rutas del SPA devuelven **200 aunque la página no exista**: verificar con
  navegador, nunca con `curl` a secas.
- Los generadores de video **no respetan el color de fondo pedido**.
- Three 0.151 usa `encodings_fragment`, no `colorspace_fragment`.
- `versionCode` sube en cada entrega a Play.
- El dev server corre en **HTTPS** con certificado autofirmado: un navegador
  automatizado lo rechaza. Para revisiones visuales, `npm run build` y servir
  `dist` por HTTP (la configuración `dist-http` de `.claude/launch.json`).
- **No se puede simular sesión desde `execute_sql`** contra funciones
  `security definer`: `set_config('request.jwt.claim.sub', …)` se ve a nivel
  del bloque pero NO dentro de la función — falla incluso `consumir_creditos`,
  que está probada en producción. Las funciones con `auth.uid()` se prueban
  con sesión real, no por SQL.
- Los textos que redacta el **worker** no pasan por el diccionario del cliente.
  Todo texto de cara al usuario que nazca ahí necesita un `code` estable, o
  llega en español a un usuario en inglés.

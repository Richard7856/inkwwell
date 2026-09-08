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

## Bloqueado por Richard

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
- Los textos que redacta el **worker** no pasan por el diccionario del cliente.
  Todo texto de cara al usuario que nazca ahí necesita un `code` estable, o
  llega en español a un usuario en inglés.

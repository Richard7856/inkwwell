# Inkwell AR — Decisiones Técnicas

## [2026-04-12] MindAR instalado con --ignore-scripts
**Context:** `mind-ar` npm package trae `canvas` (node-canvas) como dependencia transitiva. Canvas requiere compilación nativa (pkg-config, pixman) que falla en macOS sin deps de sistema.
**Decision:** Instalar con `npm install mind-ar --ignore-scripts` para saltar la compilación nativa.
**Alternatives considered:** CDN directo (pierde tree-shaking y versionado), instalar deps de sistema con brew (innecesario para el frontend).
**Risks/Limitations:** Si en Phase 2 se necesita el compiler en el mismo repo (monorepo), habrá que instalar las deps nativas o mantener el worker como servicio separado (que es el plan de todos modos).
**Improvement opportunities:** Ninguna — el worker de compilación corre en Railway con Docker donde canvas se instala limpio.

## [2026-04-12] Supabase client condicional (null si no hay env vars)
**Context:** Phase 1 no necesita Supabase — el demo es 100% estático con assets hardcodeados.
**Decision:** El cliente se crea solo si `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` existen. Si no, `supabase` es `null` y los hooks retornan datos estáticos.
**Alternatives considered:** Mock de Supabase (overhead innecesario), siempre requerir env vars (bloquea development sin backend).
**Risks/Limitations:** Cada hook que usa Supabase debe checar `if (!supabase) return`. No es riesgo real — el patrón es explícito.
**Improvement opportunities:** En Phase 2 cuando Supabase sea obligatorio, remover el condicional.

## [2026-04-12] HTTPS con @vitejs/plugin-basic-ssl en dev
**Context:** `getUserMedia` (acceso a cámara) está bloqueado en HTTP en todos los browsers modernos excepto localhost.
**Decision:** Plugin `basic-ssl` de Vite genera un cert self-signed automático. Suficiente para dev/demo.
**Alternatives considered:** mkcert (requiere instalación extra), localhost-only (no permite testing desde otro device en la misma red).
**Risks/Limitations:** Chrome muestra warning de cert no confiado — el usuario debe hacer click en "Avanzado > Continuar".
**Improvement opportunities:** Usar mkcert para un cert confiado si se vuelve fricción en demos.

## [2026-04-12] Three.js pinned a v0.151.0 por compatibilidad con MindAR
**Context:** MindAR v1.2.5 importa `sRGBEncoding` y `outputEncoding` de Three.js, que fueron removidos en v0.152.0.
**Decision:** Pinear `three@0.151.0`. Intentamos un shim alias en Vite pero rompe imports de sub-paths (`three/addons/*`).
**Alternatives considered:** Shim via Vite alias (rompe sub-paths), fork MindAR (mantenimiento innecesario), parchar manualmente el .prod.js (frágil).
**Risks/Limitations:** Three.js 0.151 no tiene features recientes, pero para rendering de GLBs con AnimationMixer es más que suficiente. MindAR trae su propio Three.js internamente.
**Improvement opportunities:** Cuando MindAR publique una versión compatible con Three.js moderno, actualizar ambos.

## [2026-04-12] Captura de foto con input capture="environment" en vez de getUserMedia
**Context:** El flujo de activación necesita capturar una foto del tatuaje. Hay dos opciones: `getUserMedia` con canvas (custom camera UI) o `<input capture="environment">` (cámara nativa del OS).
**Decision:** Input nativo con `capture="environment"`. Abre la cámara trasera del OS directamente.
**Alternatives considered:** getUserMedia con stream + canvas snapshot (más código, más bugs en Safari, permisos duplicados con el ARViewer que ya usa getUserMedia). Librería como react-webcam (dependencia innecesaria para una foto estática).
**Risks/Limitations:** En desktop el atributo `capture` se ignora — se abre el file picker normal (aceptable, desktop no es el target). En algunos Android viejos puede abrir la app de cámara en vez de inline.
**Improvement opportunities:** Si se necesita overlay/guía visual durante la captura, migrar a getUserMedia con canvas.

## [2026-04-12] Upload inmediato a Supabase Storage después de captura
**Context:** La foto se puede subir en dos momentos: inmediatamente después de capturar, o al final del flujo junto con la selección de diseño.
**Decision:** Upload inmediato — la foto se sube a Supabase Storage apenas pasa validación, antes de elegir diseño.
**Alternatives considered:** Upload diferido al final (el usuario espera más al confirmar, peor UX). Upload en background durante selección de diseño (más complejo, edge cases si cambia de foto).
**Risks/Limitations:** Si el usuario cancela el flujo después de subir, queda una imagen huérfana en Storage. Aceptable — un cleanup job periódico puede resolverlo en Phase 2.
**Improvement opportunities:** Agregar cleanup de imágenes huérfanas. Agregar compresión client-side antes de upload si las fotos pesan mucho.

## [2026-04-14] canvas requiere dependencias nativas de sistema en macOS
**Context:** El worker de compilación usa `OfflineCompiler` de MindAR que internamente depende del package `canvas` (node-canvas) para renderizar imágenes. En macOS, `canvas` no tiene binarios precompilados para Node v22 arm64 — necesita compilarse desde fuente.
**Decision:** Instalar las dependencias de sistema via Homebrew antes de `npm install` en `worker/`: `brew install pkg-config cairo pango libpng giflib librsvg pixman`.
**Alternatives considered:** `--ignore-scripts` (funciona para el frontend donde `canvas` no se usa, pero rompe el worker que sí necesita `loadImage`). Usar `sharp` en lugar de `canvas` (requeriría modificar el código del OfflineCompiler — no viable). Usar `jimp` (puro JS, sin deps nativas — pero OfflineCompiler requiere un objeto compatible con canvas context, no un buffer raw).
**Risks/Limitations:** En Railway/Docker estas deps se instalan via `apk add` en el Dockerfile — ya está incluido. En macOS del developer, el brew install es un paso manual de setup documentado.
**Improvement opportunities:** Agregar un script `worker/setup.sh` que detecte el OS y corra el brew install automáticamente.

## [2026-04-14] RLS permisivo en Phase 1 (sin auth)
**Context:** Sin auth, los inserts a la tabla `tattoos` desde el cliente con anon key fallaban porque Supabase habilita RLS por defecto en nuevas tablas sin policies definidas.
**Decision:** Crear policies permisivas (`using (true)`) para SELECT e INSERT en `tattoos`. Las policies son explícitas e intencionales — es mejor que deshabilitar RLS completamente.
**Alternatives considered:** Deshabilitar RLS (`alter table tattoos disable row level security`) — funciona pero es una mala práctica que se olvida de re-habilitar en Phase 2. Service role key en el frontend — expone credenciales privilegiadas al cliente, inaceptable.
**Risks/Limitations:** Cualquier persona con la anon key puede insertar tatuajes. Aceptable para Phase 1 — el demo no tiene datos sensibles.
**Improvement opportunities:** En Phase 2 con auth, cambiar policies a `auth.uid() = user_id` para que cada usuario solo vea y modifique sus propios tatuajes.

## [2026-08-09] APK con Capacitor (WebView) en vez de React Native
**Context:** Se quiere distribuir la app como APK nativo. Tres caminos posibles: envolver el build web en Capacitor, reescribir en React Native + ViroReact (tracking nativo con ARCore), o Unity + AR Foundation.
**Decision:** Capacitor. El código web actual se empaqueta tal cual en un WebView Chromium — MindAR, Three.js y Supabase corren sin modificación. Un solo codebase sirve web y APK.
**Alternatives considered:** React Native + ViroReact — el premio real es que ARCore acepta la imagen del tatuaje en runtime (`AugmentedImageDatabase.addImage()`, ~30ms), lo que ELIMINA el worker de compilación, el `.mind`, Railway/ngrok y la espera de 15-30s al activar; además ARCore hace SLAM y el modelo queda anclado al mundo aunque el tatuaje salga de cuadro. Se descartó por ahora: es una reescritura completa (Tailwind→NativeWind, React Router→React Navigation) de 4-8 semanas, obliga a mantener dos codebases (la web es indispensable, ver riesgo abajo) y ARCore solo corre en ~400 modelos certificados con Android 7+, contra MindAR que corre en cualquier cosa con cámara y WebGL. Unity + AR Foundation — mejor calidad pero rewrite total en C#, desproporcionado.
**Risks/Limitations:** Capacitor NO mejora la calidad del AR en absoluto: es el mismo MindAR sobre el mismo motor Chromium, con el mismo jitter y el mismo worker de `.mind`. Lo que sí resuelve es distribución (Play Store, ícono, sin barra de URL) y fricción de permisos. **Riesgo de producto:** el Flujo B (alguien escanea el tatuaje de otro) NO puede vivir solo en el APK — pedirle a un desconocido que instale una app para ver tu tatuaje mata el flujo viral. La web tiene que seguir desplegada pase lo que pase; el APK es para el DUEÑO del tatuaje.
**Improvement opportunities:** Si el tracking resulta ser el cuello de botella real, la ruta es un spike de RN+Viro (ya soporta animaciones GLB completas: esqueletales, morph targets y skinning) antes de comprometer las semanas de reescritura. Alternativa intermedia: plugin nativo de ARCore lanzado como Activity desde Capacitor, conservando la UI web — se descartó porque implica Kotlin + renderizado GLB con SceneView/Filament, y si vas a escribir ARCore de todos modos, Viro te lo da hecho en JSX.

## [2026-08-09] Decoder de Draco self-hosted en /public/draco
**Context:** `useThreeScene` apuntaba `DRACOLoader.setDecoderPath()` al CDN de gstatic. Funciona en web, pero un APK que depende de un CDN externo para renderizar su contenido principal falla con conexión mala o si el CDN está bloqueado.
**Decision:** Copiar los 3 archivos del decoder (`draco_decoder.js`, `draco_decoder.wasm`, `draco_wasm_wrapper.js`) de `three/examples/jsm/libs/draco/gltf/` a `public/draco/` y apuntar el loader a `/draco/`. Se empaquetan dentro del APK vía `npx cap sync`.
**Alternatives considered:** Mantener el CDN (el usuario percibe el fallo como "la app no sirve", no como "no hay internet"). Descargar y cachear el decoder al primer arranque (complejidad de cache invalidation sin beneficio real — son 750KB).
**Risks/Limitations:** +750KB al bundle y al APK. Los archivos están copiados a mano: **si se actualiza la versión de `three` hay que re-copiarlos**, porque el decoder debe ser compatible con el `DRACOLoader` de esa versión. No hay nada automatizado que lo detecte.
**Improvement opportunities:** Un script `postinstall` que copie los archivos desde `node_modules` automáticamente eliminaría el riesgo de desincronización. Se puede quitar `draco_decoder.js` (501KB, solo es el fallback para browsers sin WebAssembly) si el peso del APK llega a importar.

## [2026-08-09] Picker de cámara nativo en APK, `<input>` en web
**Context:** `PhotoUpload` usaba `<input type="file" capture="environment">`. Dentro de un WebView eso depende de `onShowFileChooser`, cuyo comportamiento varía entre fabricantes de Android — en varios el atributo `capture` se ignora y abre el explorador de archivos, o el chooser regresa sin resultado.
**Decision:** Bifurcar por plataforma en `src/lib/native.js`. En APK se usa `@capacitor/camera`; en web se conserva el `<input>` original. Toda la ramificación vive en ese único archivo — el resto de la app importa funciones y no sabe en qué plataforma corre.
**Alternatives considered:** Usar el plugin también en web — requiere cargar `@ionic/pwa-elements` para el modal en navegador, una dependencia extra para reemplazar algo que ya funciona bien. Usar solo `<input>` en ambas — es exactamente el comportamiento frágil que queremos evitar.
**Risks/Limitations:** Dos caminos de código para la misma función, así que un bug de captura puede reproducirse en una plataforma y no en la otra. Se mitiga manteniendo la validación (800x800) y el manejo de errores compartidos aguas abajo.
**Improvement opportunities:** Si se agrega iOS, `native.js` es el único archivo a revisar. `resultType: Uri` en vez de `Base64` es deliberado — Base64 de una foto de 12MP son ~8MB de string en memoria del WebView, suficiente para tirar la app en gama media.

## [2026-08-09] VITE_PUBLIC_URL para construir links compartibles
**Context:** `Activate` construía el link de escaneo con `window.location.origin`. Dentro del WebView de Capacitor el origen es `https://localhost`, un origen interno de la app. El botón "Copiar link" habría funcionado perfectamente y copiado un link que NADIE puede abrir — el flujo viral roto solo en el APK, y en silencio.
**Decision:** Nueva variable `VITE_PUBLIC_URL` con el dominio de producción, horneada en el build. `buildScanUrl()` en `src/lib/native.js` la usa; si no está definida cae a `window.location.origin` (para que dev y los previews de Vercel funcionen sin configurar nada) y loguea un `console.error` fuerte cuando el build es nativo.
**Alternatives considered:** Hardcodear el dominio en el código (rompe los previews de Vercel y el desarrollo local). Detectar el origen en runtime consultando al backend (una llamada de red para algo que se sabe en build time).
**Risks/Limitations:** Es una variable más que se puede olvidar de configurar. El fallback evita el crash pero no evita el link malo — por eso el `console.error` explícito. **Un build de APK sin esta variable genera links inservibles.**
**Improvement opportunities:** Fallar el build (no solo avisar) cuando se compila para nativo sin `VITE_PUBLIC_URL`.

## [2026-08-09] Proyecto `android/` commiteado al repo
**Context:** Capacitor genera `android/` como un proyecto nativo completo. Hay dos escuelas: commitearlo, o regenerarlo en cada máquina con `npx cap add android`.
**Decision:** Commitearlo. El `AndroidManifest.xml` lleva cambios nuestros que se perderían al regenerar: permiso `CAMERA`, `uses-feature` de cámara e intent-filter de App Links. Son ~53 archivos y 1.4MB, casi todo iconos y splash.
**Alternatives considered:** Regenerar y aplicar los cambios con un script de post-procesado (frágil, y un `cap add` accidental borra el trabajo en silencio).
**Risks/Limitations:** El `.gitignore` que genera Capacitor deja los keystores SIN ignorar (`#*.jks` comentado). **Se descomentó a propósito** — quien tenga el keystore puede publicar actualizaciones falsas en Play Store, y si se pierde no hay forma de volver a firmar la misma app. El build web copiado a `app/src/main/assets/public/` sí está ignorado, así que no se duplica el bundle en el repo.
**Improvement opportunities:** Ninguna pendiente. El keystore de release debe vivir en un gestor de secretos, nunca en el repo.

## [2026-08-09] App Links y botón físico de atrás
**Context:** Dos comportamientos que un APK necesita y que la web no: (1) que un link compartido abra la app en vez del navegador, (2) que el botón físico de atrás no cierre la app desde cualquier pantalla — el default de Capacitor es salir siempre, lo que se siente roto a media captura de foto.
**Decision:** Hook `useNativeShell` montado en `App.jsx`. Escucha `appUrlOpen` y navega con React Router (sin recarga completa); intercepta `backButton` para hacer `navigate(-1)` en rutas internas y `exitApp()` solo en la raíz. En web sale en el primer `if` y nunca registra listeners.
**Alternatives considered:** Manejar el deep link con una recarga completa a la URL (pierde el estado de la app y se ve como un arranque en frío).
**Risks/Limitations:** **Los App Links NO funcionan todavía.** El intent-filter en `AndroidManifest.xml` tiene un host placeholder (`inkwell-ar.vercel.app`) que hay que reemplazar por el dominio real. Y `autoVerify` requiere además servir `/.well-known/assetlinks.json` desde ese dominio con la huella SHA-256 del certificado de firma (`keytool -list -v -keystore <tu.keystore> -alias <alias>`, o la que muestra Play Console si usas App Signing). Sin ese archivo la verificación falla en silencio y el link sigue abriendo el navegador.
**Improvement opportunities:** Generar `assetlinks.json` y servirlo desde `public/.well-known/` en Vercel, una vez que exista el keystore de release.

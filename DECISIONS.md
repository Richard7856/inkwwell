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

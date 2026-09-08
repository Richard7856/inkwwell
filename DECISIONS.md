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

## [2026-09-02] Analizador de calidad de image target
**Context:** Se planteó "entrenar el tracker" como siguiente paso. MindAR no entrena nada — extrae descriptores visuales de forma determinista. Si un tatuaje no tiene puntos de interés suficientes, ningún parámetro de runtime lo arregla. Hacía falta poder medir la calidad de un target ANTES de activarlo.

**Decision:** Nuevo módulo `worker/analyzer.js` + endpoint `POST /analyze` + CLI `analyze-cli.js` para lotes. Mide tres ejes independientes sobre la salida del OfflineCompiler:
- `matchingData` → puntos de detección por nivel de escala (reconocer el tatuaje desde cero)
- `trackingData` → puntos de seguimiento frame a frame (estabilidad del 3D)
- Distribución espacial en grilla 3x3 sobre el keyframe de mayor escala

El veredicto lo determina la métrica MÁS DÉBIL, no el promedio: un target con 900 puntos concentrados en una esquina falla igual que uno con 80 bien repartidos. Promediar escondería el problema.

**Alternatives considered:**
- Umbral único sobre conteo total de puntos: descartado, esconde el problema de concentración espacial.
- Entrenar un clasificador ML sobre fotos etiquetadas: descartado, no hay dataset y el problema no lo requiere — las métricas de CV son directamente interpretables.

**Risks/Limitations:**
- Los umbrales son heurísticas iniciales, NO están calibrados contra comportamiento real en cámara. Requieren un lote de 15-20 tatuajes reales medidos contra si trackean bien o no.
- `computeMaxTrackingFeatures()` replica constantes internas de mind-ar (TEMPLATE_SIZE=6, occSize=min/10). Si se actualiza mind-ar hay que verificarlas.
- `/analyze` compila completo (10-30s) y descarta el .mind. Para el flujo "analizar y luego activar" conviene reutilizar ese buffer y no compilar dos veces.

**Improvement opportunities:**
- Calibrar umbrales con datos reales y registrar el dataset.
- Reutilizar el .mind entre analyze y compile.
- Exponer el analizador en el UI de activación con feedback visual (heatmap de zonas débiles sobre la foto).

## [2026-09-06] Worker de compilación desplegado en Railway
**Context:** El worker corría local expuesto por ngrok. La URL cambia en cada reinicio, y como se compila DENTRO del bundle (`VITE_COMPILER_URL`), cada cambio obligaba a actualizar `.env`, Vercel y regenerar el APK. Pasó tres veces en un día. Para un demo a inversores era riesgo inaceptable: si ngrok cae cinco minutos antes, no hay demo.

**Decision:** Railway con Dockerfile multi-etapa. URL fija: `inkwwell-production.up.railway.app`. Root Directory del servicio apuntando a `worker/`.

**Alternatives considered:**
- *ngrok con dominio reservado (~$8/mes):* da URL fija pero sigue dependiendo de la Mac encendida. No resuelve el problema real.
- *Vercel Edge Function:* imposible. El worker usa `canvas` (módulo nativo de C) y consume CPU sostenida 10-30s — lo contrario del perfil serverless.
- *Dockerfile de una sola etapa:* obliga a elegir entre imagen de ~1GB con toolchain, o apostar a que exista binario precompilado de `canvas` para la arquitectura destino. Dos etapas evita la apuesta.

**Risks/Limitations:**
- **Railway inyecta `PORT=8080`** ignorando el `EXPOSE 3001` del Dockerfile. El target port en Networking debe ser 8080. Con 3001 da 502 "Application failed to respond" mientras los logs muestran el servidor sano — el síntoma engaña.
- No se pudo hacer smoke test local de la imagen (Docker Hub inalcanzable desde la Mac ese día). Se mitigó con el build de dos etapas, que funciona compile o no compile. Verificado después contra el deploy real: `/analyze` compiló 1000×1000 en 9.5s con resultados idénticos a los locales.
- Cold start: si el servicio duerme, la primera petición paga arranque de contenedor además de la compilación.

**Improvement opportunities:**
- Reutilizar el `.mind` entre `/analyze` y `/compile` — hoy el flujo "analizar y luego activar" compilaría dos veces.
- Rate limiting: los endpoints están abiertos sin auth. Aceptable en Phase 1, no en producción.

## [2026-09-07] Multi-tatuaje: un perfil, varios tatuajes en una sesión
**Context:** El escaneo requería un link por tatuaje (`?tattoo=<uuid>`), atajo de Phase 1 que contradecía el Flujo B del CLAUDE.md ("MindAR reconoce la imagen → consulta Supabase") y mataba la viralidad: para ver un tatuaje había que recibir su link específico.

**Decision:** Un `.mind` contiene varios image targets, uno por tatuaje de la persona. Cada target tiene su ancla y su modelo 3D. Un solo link por PERSONA, no por tatuaje.

**Verificado antes de construir:**
- Los `.mind` se fusionan sin recompilar: son msgpack `{v, dataList}` con entradas autocontenidas. Probado con dos archivos reales (517KB + 553KB → 1070KB, 2 targets íntegros). Agregar un tatuaje costará compilar solo ese (~11s), no la colección.
- Calidad medida con el analizador: huella 2308 puntos de detección / 16% de tracking; esqueleto 2516 / 20%. Ambos ACEPTABLE. Contradijo la intuición de que el tatuaje más detallado sería más difícil — es al revés, el detalle fino alimenta la extracción de features.
- **Validado en dispositivo:** los dos tatuajes se rastrean SIMULTÁNEAMENTE, cada uno con su modelo, sin confundirse entre sí.

**Alternatives considered:**
- *Un `.mind` global con todos los tatuajes:* descartado por peso. ~875KB por tatuaje: 100 tatuajes serían ~87MB de descarga.
- *Reconocimiento en la nube (frame → servidor → identifica → descarga ese `.mind`):* es la arquitectura correcta para escalar sin links, pero requiere índice de búsqueda por similitud. Se difiere.
- *Filtrado por geolocalización* (idea del founder): reduce el espacio de búsqueda a usuarios cercanos, lo que vuelve tratable el reconocimiento en la nube. Es el puente natural entre el nivel 1 y el 3.

**Risks/Limitations:**
- `maxTrack` limitado a 2 simultáneos: cada target rastreado cuesta trabajo por frame y en gama media afecta fps.
- Con dos tatuajes visibles a la vez, los botones muestran las animaciones del último detectado. Ambiguo pero no roto; hace falta un selector cuando haya varios activos.
- El peso del `.mind` crece linealmente: ~875KB por tatuaje. Alrededor de 8-10 tatuajes la descarga se vuelve pesada en datos móviles.

**Improvement opportunities:**
- Selector visual cuando hay varios tatuajes rastreados a la vez.
- Carga diferida del modelo: hoy se cargan todos al iniciar; con muchos tatuajes convendría cargar el modelo al detectar su target.

## [2026-09-07] Borrado de cuenta: Edge Function, y por qué NO borra siempre la identidad
**Context:** Google Play no aprueba una app con cuentas si no ofrece dos caminos de borrado: uno dentro de la app y una dirección web pública donde cualquiera pueda pedirlo **sin instalar nada**. Sin esto no hay publicación, y sin publicación no hay concurso.

**Decision:** Una Edge Function de Supabase (`eliminar-cuenta`) y una sola pantalla (`/eliminar-cuenta`) que sirve a los dos caminos. La función borra al **dueño del token de sesión**, nunca a un correo recibido en la petición; quien llega por web sin la app se identifica con el mismo código de 6 dígitos del login.

**El hallazgo que cambió el diseño:** este proyecto de Supabase está compartido con otra aplicación (la de `spaces`/`projects`/`tasks`), que cuelga su tabla `profiles` del mismo `auth.users`. Se verificó contra la base: hoy los **2 únicos usuarios de `auth.users` son de esa otra app**, y `spaces_owner_id_fkey` es **RESTRICT**, no cascade. Borrar la identidad a ciegas tenía dos finales, ambos malos: destruir la cuenta que esa persona tiene en la otra app sin haberlo pedido, o fallar con un error de llave foránea incomprensible.

Por eso el borrado es en dos niveles: **los datos de Inkwell se borran siempre**; la identidad de acceso solo cuando ninguna otra app la usa. Con cero traslape hoy, el camino normal es el borrado completo.

**Orden de operaciones (no es arbitrario):** las llaves foráneas son `on delete cascade`, pero **los archivos de Storage no cascadean**. Borrar las filas primero destruiría las URLs y dejaría fotos y descriptores huérfanos y públicos para siempre — una fuga permanente disfrazada de borrado exitoso. Secuencia: leer URLs → borrar archivos → borrar filas → borrar identidad. Si el borrado de archivos falla, se aborta **sin tocar las filas**, para que un reintento aún pueda localizarlos.

**Alternatives considered:**
- *Endpoint en el worker de Railway:* descartado. Ya tiene endpoints abiertos sin auth (riesgo registrado en este mismo documento); darle la llave de servicio ampliaría el radio de daño de algo ya expuesto.
- *Confiar solo en `verify_jwt` de la pasarela:* descartado y **comprobado como insuficiente**. La pasarela acepta la llave anónima —que va pública en el bundle— como JWT válido. Verificado contra el despliegue real: con la llave anónima como token la petición **llega** a la función y solo la muere el `getUser()` explícito (HTTP 401).
- *Borrado diferido con periodo de gracia de 30 días:* descartado por ahora. Play acepta el borrado inmediato, y el diferido exige un trabajo programado que hoy no existe.
- *Separar los proyectos de Supabase:* es el arreglo de fondo, pero es una migración completa a 23 días del cierre. Se difiere.

**Risks/Limitations:**
- **El camino feliz no está probado de extremo a extremo.** No hay llave de servicio local para fabricar una sesión, y hoy existen 0 cuentas de Inkwell. Lo verificado es el rechazo de credenciales inválidas (4 casos) y el preflight CORS. Falta que una persona real active un tatuaje y lo borre.
- Los 5 tatuajes existentes tienen `user_id` nulo (previos al login): nadie es su dueño y **nadie puede borrarlos** por este camino. Son datos de prueba del founder; la política transitoria de RLS que permite el nulo debe retirarse.
- Mientras el traslape con la otra app no sea cero, algunas cuentas quedarán en borrado parcial. Es correcto, pero hay que sostener la explicación si un revisor pregunta.
- La política de privacidad afirma cosas verificables en el código (la cámara no sube frames, Railway no guarda la foto). Si eso cambia, **la política miente**: hay una nota en el encabezado del archivo pidiendo revisarla al tocar esas rutas.

**Improvement opportunities:**
- Separar los proyectos de Supabase y eliminar el borrado en dos niveles.
- Registro de borrados (fecha y alcance, sin datos personales) para poder responder a un reclamo.
- Retirar la rama de `user_id` nulo en las políticas de RLS y limpiar los 5 tatuajes huérfanos.

## [2026-09-07] Cambio de marca a InkAR y renombre del paquete
**Context:** Ya existía en Play Store una app llamada Inkwell en el mismo nicho de tatuajes. Se adoptó el dominio `inkar.app` y el correo `contacto@inkar.app`.

**Decision:** El nombre visible pasa a **InkAR** y el identificador del paquete de `ar.inkwell.app` a **`app.inkar`** (dominio invertido).

**Por qué el renombre del paquete tenía que ser AHORA:** el `applicationId` queda congelado en el momento de publicar y no se puede cambiar nunca más — cambiarlo después obliga a publicar una app distinta, perdiendo instalaciones y reseñas. Como la app aún no se publica, esta era la única ventana. Dejar "inkwell" dentro del identificador, además, sería evidencia incómoda si el conflicto de nombre escalara a un reclamo de marca.

Alcance del renombre: paquete Java (`MainActivity`), `namespace` y `applicationId` de Gradle, `strings.xml`, `capacitor.config.json`, título y descripción del HTML, textos visibles, y el correo de contacto en la política de privacidad y en la Edge Function. El valor `solo_inkwell` que la función devuelve al cliente pasó a `solo_inkar` en ambos lados. **No** se renombraron el directorio del proyecto, el repositorio ni el proyecto de Vercel: son internos y renombrarlos rompe rutas y despliegues sin beneficio.

**Risks/Limitations:**
- El APK instalado en los dispositivos de prueba tiene el paquete viejo: no se actualiza, se instala **al lado**. Hay que desinstalar el anterior a mano.
- El dominio `inkar.app` todavía no está conectado en Vercel. Las URLs legales que se registren en Play Console deben ser las definitivas: registrar las de `inkwwell.vercel.app` obligaría a volver a pasar por revisión al cambiarlas.

## [2026-09-07] SDK de RevenueCat instalado ANTES del primer bundle
**Context:** Google Play no habilita la creación de productos de compra hasta que se sube un bundle que ya incluya la librería de facturación. Instalar el SDK después del primer envío habría costado un ciclo completo de recompilar y volver a subir, dentro del bloque más apretado del sprint.

**Decision:** `@revenuecat/purchases-capacitor@13.5.0` instalado y sincronizado antes de generar el primer AAB. **Verificado contra un build real**, no supuesto: el manifiesto fusionado (`processDebugMainManifest`) declara `com.android.vending.BILLING` y el paquete `app.inkar`. El manifiesto propio del plugin viene vacío — el permiso llega por fusión desde la librería de facturación transitiva, así que leer el plugin no bastaba para confirmarlo.

**Decisiones de diseño en `src/lib/billing.js`:**
- **No-op en navegador.** El plugin es un puente a código Android y revienta en web. La web es justo donde vive el circuito de crecimiento (abrir la liga de un tatuaje sin instalar nada); que el cobro tumbara esa pantalla rompería lo viral del producto por una función que esa persona no va a usar.
- **`appUserID` = id de Supabase.** Sin él RevenueCat inventa un identificador anónimo por instalación y las compras quedan atadas al teléfono, no a la persona: al cambiar de celular se perderían los créditos y no habría forma de reconciliarlos con Supabase.
- **Nunca lanza.** Un fallo de cobro no puede impedir que la app abra; se registra en consola y el cobro queda inhabilitado.

**Alternatives considered:**
- *Instalarlo en el Bloque 2, junto con el paywall:* descartado por el orden de Play descrito arriba.
- *Cobro web con Stripe en vez de in-app:* la decisión de cobrar todo por RevenueCat sigue en pie. RevenueCat también factura por web, y el patrocinio de Stripe abre una categoría de premio para el funnel web-a-app; se revisará cuando el motor de video esté conectado, no antes.

**Risks/Limitations:**
- **Sin probar de extremo a extremo.** Falta la llave `VITE_REVENUECAT_ANDROID_KEY`, que no existe hasta crear el proyecto en RevenueCat. Lo verificado es que el permiso entra al bundle y que la web no se rompe.
- La cuenta de servicio de Google Cloud que RevenueCat necesita **tarda hasta ~36 horas** en propagar permisos. Es el trámite más lento de la cadena y hay que arrancarlo el día que se cree la app en Play Console.

## [2026-09-07] Identidad visual: generador en vez de PNGs a mano
**Context:** El icono y el splash eran los genéricos de Capacitor. Son 20+ archivos en 5 densidades; hechos a mano, cualquier ajuste obliga a rehacerlos uno por uno y basta olvidar una densidad para que un teléfono muestre el icono viejo.

**Decision:** Una sola fuente en `brand/icono.svg` y un generador (`scripts/generar-marca.py`) que produce icono adaptativo, icono legado, versión redonda, los 512×512 de la ficha de Play, los splash en ambas orientaciones y el favicon web.

**Marca:** gota de tinta (el tatuaje) enmarcada por dos corchetes de visor (la cámara que la reconoce). Violeta `#6D28D9` sobre el negro `#0B0B0F` de la app.

**Lo que se descartó al probarlo, no antes:** una primera versión tenía muescas cuadradas mordiendo el borde de la gota para sugerir lo digital. Renderizada a 48px leen como suciedad, no como pixelado, y el corchete inferior chocaba con la gota. A ese tamaño cada forma extra resta legibilidad en vez de sumar significado. La gota se encogió para que los corchetes respiren.

**Verificado, no supuesto:**
- El dibujo vive dentro del círculo seguro de 66dp: se simularon las tres máscaras reales de lanzador (círculo, squircle, cuadrado) y ninguna recorta contenido.
- El 512 de la ficha salió en RGB sin canal alfa — Play rechaza iconos con transparencia.
- El bundle firmado contiene los 15 PNG de icono en las 5 densidades, con los tamaños correctos.

**Risks/Limitations:**
- El generador depende de `rsvg-convert` (`brew install librsvg`). En una máquina sin él, falla en vez de producir assets malos, que es lo correcto.
- El splash no lleva texto a propósito: depender de una fuente del sistema haría que el resultado cambie según la máquina que lo genere.
- `OU=InkAr` (con r minúscula) quedó en el certificado de firma. Campo cosmético que nadie ve; no justifica rehacer la llave.

## [2026-09-07] Contraseña como segunda vía de acceso
**Context:** El login era solo código de 6 dígitos por correo. Dos huecos: no hay credenciales fijas que entregarle al revisor de Google Play —que rechaza la app si no logra entrar— ni a los jueces del concurso; y el servicio de correo integrado de Supabase está topado a unos pocos envíos por hora y documentado como "solo para pruebas", así que un tope alcanzado durante una demo deja a todos fuera.

**Decision:** Se agrega correo + contraseña **sin quitar** el código. El código sigue siendo la vía por defecto porque es mejor para el usuario real (nada que inventar ni recordar); la contraseña es la vía que no depende de que un correo llegue.

**Alternatives considered:**
- *Reemplazar el código por contraseña:* descartado. Tirarìa código que ya funciona y le agregaría fricción al usuario que sí importa — el tatuado en un estudio.
- *Cuenta de prueba con código fijo:* imposible, el OTP se genera por envío.
- *Conectar SMTP propio (Resend) y quedarse solo con el código:* resuelve el tope de envíos pero no las credenciales fijas para el revisor. Sigue pendiente y conviene igual.

**Verificado contra el proyecto real:** alta con contraseña (abre sesión inmediata porque la confirmación de correo está desactivada), reingreso, rechazo con contraseña incorrecta, y borrado de cuenta con esa sesión. Las cuentas de prueba se eliminaron después.

## [2026-09-07] El resguardo del borrado estaba mal razonado
**Context:** El borrado de cuenta preguntaba si EXISTE una fila en `public.profiles` para decidir si eliminar la identidad de acceso, suponiendo que esa fila significaba "esta persona también usa la otra app".

**El error:** esa app tiene un disparador `on_auth_user_created` → `handle_new_user` que crea la fila de `profiles` para **todo** usuario nuevo, incluidos los que solo vienen de InkAR. Con esa comprobación **ningún usuario habría podido borrar su identidad jamás**: pedía borrar su cuenta, la app respondía que sí, y su login seguía funcionando. Exactamente lo que Google Play exige que no ocurra.

**Cómo se detectó:** probando el borrado de punta a punta con una cuenta recién creada. La lectura del código no lo revelaba — el resguardo se ve razonable hasta que se observa que `profiles` y `auth.users` tienen el mismo número de filas.

**Decision:** la pregunta correcta no es si existe el perfil, sino si la persona tiene **actividad** en la otra app. Es una app de espacios: sin pertenecer a uno no se puede hacer nada allá. Se consulta `space_members` y `spaces`.

Además, si el borrado de la identidad falla de todos modos (por ejemplo si esa app agrega mañana una tabla con RESTRICT), se degrada a borrado parcial y se le dice al usuario qué sí se borró, en vez de devolver un error crudo que lo dejaría creyendo que no se borró nada.

**Risks/Limitations:**
- La comprobación depende de tablas de OTRA aplicación. Si esa app se reestructura, este resguardo puede quedar obsoleto en silencio. El arreglo de fondo sigue siendo separar los proyectos de Supabase.
- Un usuario invitado a un espacio que nunca aceptó podría quedar clasificado como "usuario real" de la otra app y recibir borrado parcial. Es el lado seguro del error.

## [2026-09-07] Landing pública con lista de espera
**Context:** El bundle quedó en revisión de Play. Mientras Google responde, no hay nada que capture demanda — y el premio mayor del Shipaton pondera crecimiento post-lanzamiento, que se construye antes de lanzar, no después.

**Decision:** Landing en `inkar.app` con un solo objetivo: recoger correos. Un formulario, visible antes de tener que desplazarse.

**Por qué la landing y la app comparten la ruta `/`:** Capacitor arranca siempre en `/` y cambiarlo exige configuración nativa. Si `/` fuera la landing, quien ya instaló la app abriría cada vez una página de marketing pidiéndole el correo que ya dio; si la landing viviera en otra ruta, quien llega de una búsqueda o del cartel de un estudio caería en la app sin contexto. `App.jsx` decide con `Capacitor.isNativePlatform()`: navegador → landing, app → inicio.

**Cambios a la tabla `waitlist`** (existía de un concepto anterior, vacía):
- **Índice único sobre `lower(email)`.** Sin él la misma persona se inscribe varias veces y el tamaño de la lista deja de significar algo. Se eligió `lower()` y no un unique simple porque la prueba con el mismo correo en distinta capitalización sí colaba un duplicado.
- **Columna `perfil`** (`persona` | `artista`). Los estudios son el CANAL de distribución, no un segmento más: 15 estudios valen más que 200 personas sueltas porque cada uno trae su cartera. Sin la columna habría que adivinar quién es quién leyendo correos.
- **Columna `ciudad`**, pedida solo a estudios: para una persona es fricción sin propósito, pero decide en qué plaza arrancar el canal.

**Sobre el acceso:** existe política de INSERT público y **ninguna de SELECT**, deliberadamente. Verificado contra producción: leyendo `/rest/v1/waitlist` con la llave anónima del bundle devuelve `[]`. La lista se consulta desde el panel o con llave de servicio.

**Verificado de punta a punta:** alta correcta (correo, perfil, ciudad, origen), alta repetida con distinta capitalización devuelve "ya estabas" en vez de un error, y ambos idiomas. La fila de prueba se eliminó.

**Risks/Limitations:**
- El correo del duplicado se responde con éxito. Es deliberado —el usuario hizo lo correcto— pero significa que la landing no distingue entre "te acabas de inscribir" y "ya estabas" en las métricas del cliente.
- No hay confirmación por correo: la lista puede acumular direcciones inválidas. Aceptable para una lista de espera; no lo sería para enviar el lanzamiento sin verificar antes.
- El contenido de la landing vive en dos objetos por idioma dentro del componente. Si crece mucho conviene moverlo a archivos aparte.

## [2026-09-07] Demo público con marcador universal
**Context:** La landing tiene que convencer a gente que nunca oyó del producto, y nadie que llega tiene un tatuaje activado. Los jueces del concurso tampoco tienen tatuajes. Sin un demo, conocer InkAR depende de que alguien te lo cuente — y un video no demuestra que funcione.

**Decision:** Una imagen-marcador que cualquiera puede abrir en otra pantalla o imprimir, con su `.mind` precompilado servido desde `/public`. Ruta `/demo` con las instrucciones, y `/scan?demo=marcador` para el visor. Resuelve a la vez el demo de la landing y el riesgo crítico del sprint ("los jueces no tienen tatuajes").

**Por qué en otra pantalla o impreso:** casi todo el mundo llega desde el teléfono, y un teléfono no puede apuntarse a sí mismo. La única salida es separar la imagen del visor.

**El marcador se eligió midiendo, no opinando.** Se generaron cuatro candidatos y se pasaron por el `/analyze` del worker:

| Candidato | Veredicto | Detección | Seguimiento |
|---|---|---|---|
| Ornamental | BUENO | 3502 | 75 (31%) |
| Geométrico + dotwork | ACEPTABLE | 4279 | 51 (21%) |
| Orgánico | ACEPTABLE | 3563 | 47 (19%) |
| **Mandala de gotas (elegido)** | **BUENO** | **3440** | **81 (33%)** |

Contradijo la intuición: el geométrico tiene MÁS puntos de detección y rastrea peor. Los puntos de detección no predicen el seguimiento. Como referencia, los tatuajes reales con los que se validó el sistema midieron 16% y 20% y funcionan bien, así que 33% da margen.

El elegido usa la gota de la marca como motivo ornamental repetido: la densidad que exige el rastreo ES el ornamento, en vez de ruido encima de una figura. Lleva los corchetes de visor en esquinas opuestas, que además de marca aportan la asimetría que un dibujo radial necesita para que MindAR no confunda orientaciones.

**Por qué el `.mind` va en `/public` y no en Storage:** son 694KB que así viajan dentro del APK y hacen que el demo funcione sin red. En Storage habría una petición más que puede fallar justo en el momento en que alguien decide si el producto le interesa.

**El demo va ANTES del formulario en la landing.** Quien no conoce el producto no entrega su correo por una descripción; lo entrega después de ver que funciona. Pedirlo primero convierte la página en un peaje.

**Risks/Limitations:**
- **Sin probar con cámara real.** Lo verificado es la calidad medida del marcador y que los tres archivos se sirven con el tipo correcto (un `.mind` que devuelva HTML de 404 revienta MindAR con un error de msgpack ilegible). Falta apuntarle un teléfono.
- El marcador impreso en papel mate rastrea mejor que en pantalla: el brillo y el refresco de un monitor le quitan puntos. Hay que decirlo si alguien reporta que le cuesta.
- El `.mind` suma 694KB al bundle web y al APK.

## [2026-09-07] Adopción de la identidad de marca del tablero
**Context:** Llegó un tablero de identidad de InkAR con paleta, tipografía, símbolo (una K a pincel), elementos gráficos y voz. La identidad previa era la que se improvisó al hacer el icono: violeta `#6D28D9` y una gota de tinta.

**Decision:** Se adopta lo que se puede reproducir con fidelidad y se aplaza lo que no.

**Adoptado:** paleta como tokens en `@theme` (`tinta` #000000, `realidad` #8B5CF6, `claridad` #F7F7F7, `tecnologia` #6B6B6B), Montserrat para títulos e Inter para cuerpo, y la voz — "Historias que siguen vivas", "Más que tinta. Otra realidad.", "Escanea. Descubre. Revive.". Los tokens se nombran por su PAPEL y no por su color, para que un ajuste de paleta no obligue a tocar cada componente.

**Aplazado y luego resuelto: el símbolo de la K.** El primer envío de archivos no daba la talla:
- `INKAR_K_imagotipo.svg` es un autotrazado —su propio README lo admite— y renderizado se lee como una mancha astillada, no como el trazo del tablero.
- El PNG es un recorte del tablero a 120×182 con fragmentos de elementos vecinos en el borde y fondo gris en vez de transparencia. El icono adaptativo necesita 432×432 limpios.
- `INKAR_K_imagotipo.svg` y `INKAR_trazos_tinta.svg` son **el mismo archivo**: los trazos sueltos no llegaron.

Se pidió el archivo bueno y llegó: `INKAR_K.svg`, 1254×1254 con ~180 trazos vectoriales que conservan la textura del pincel y las salpicaduras. **La K ya es la marca en todos lados**: icono adaptativo (fondo `#F7F7F7`, K negra), splash (K blanca sobre el negro de la app), favicon y encabezado de la landing.

Detalles de implementación:
- El arte no está centrado en su propio viewBox, así que el generador **recorta al alfa y centra por código** en vez de calcular a mano un desplazamiento que cambiaría con cada versión del asset.
- Todo el arte —salpicaduras incluidas— se encierra en el 60% del lienzo: el lanzador solo garantiza el círculo central de 66 de 108dp, y una salpicadura cortada por la máscara no se lee como estilo sino como un error de dibujo. Verificado contra las tres máscaras (círculo, squircle, cuadrado).
- La K blanca se obtiene recoloreando con el alfa como máscara: la textura del pincel vive en el alfa, así que pintar encima la conserva entera.
- En la landing va como imagen y no como SVG en línea: son ~180 trazos que engordarían el HTML de cada página, mientras que un archivo se guarda en caché una vez.

**Fondo claro y no negro** para el icono: la K negra sobre claro se distingue entre iconos que hoy son casi todos oscuros, y es la variante principal del tablero.

**El nombre no cambia.** El tablero muestra "INKAR" en mayúsculas; eso es tratamiento tipográfico (clase `.marca`), no un cambio de nombre. En la tienda y en el sistema la app se sigue llamando InkAR, que es lo que está en revisión — cambiarlo obligaría a editar la ficha y sacar versión nueva sin ganancia.

**La app sigue siendo oscura** aunque el tablero sea claro: el AR se mira sobre video de cámara, y una interfaz clara encima compite con la imagen y lava el contraste del 3D.

**Sobre las fuentes:** se cargan desde Google Fonts con `preconnect` desde el HTML, no con `@import` en el CSS. En CSS los `@import` deben preceder a toda regla y colocado tras `@theme` el navegador lo ignora en silencio — pasó en el primer intento. Verificado que cargan de verdad y no caen al respaldo: Montserrat mide 132px donde el sistema mide 117px.

**Risks/Limitations:**
- Las fuentes dependen de la red en el primer pintado dentro del APK. Se acepta porque la app ya no funciona sin red, y `display=swap` evita que el texto quede invisible.
- El marcador del demo usa la gota como motivo. Cuando entre la K habrá que decidir si se rehace — implica recompilar el `.mind` y volver a medir el rastreo.

## [2026-09-07] Tema claro en marketing, oscuro en el visor
**Context:** El tablero de marca es mayormente claro —papel y tinta— y el estilo que buscan los estudios de tatuaje va por ahí. La app venía toda oscura por herencia del visor AR.

**Decision:** Tema por pantalla. Landing y demo en claro (`#F7F7F7` sobre `#000000`); el visor AR se queda oscuro.

**Por qué el visor NO puede ser claro:** el 3D se dibuja SOBRE el video de la cámara. Una interfaz clara encima compite con la imagen y lava el contraste del modelo, que es justo lo que hay que hacer resaltar. No es preferencia estética, es legibilidad del producto.

**Por qué se marca `<html>` y no un contenedor:** el color de fondo del documento asoma al rebotar el scroll y detrás de las barras del sistema. Pintar solo un div deja franjas del color equivocado en los bordes, que es donde más se nota. El hook restaura el tema anterior al desmontar — sin eso, volver de la landing al visor dejaba el fondo claro debajo de la cámara. Verificado navegando en ambas direcciones.

**El botón principal es negro, no violeta.** El tablero usa el violeta como acento, no como color de acción; en un diseño de papel y tinta, el negro es el que manda y el violeta gana fuerza justamente por ser escaso.

**La textura de fondo es la propia K** a gran escala, sangrada por el borde y al 6% de opacidad. Los trazos de tinta sueltos del tablero nunca llegaron —el archivo entregado era la K duplicada— y usar el asset real en vez de inventar un pincel mantiene la coherencia del trazo.

**Risks/Limitations:**
- El resto de la app (activación, perfil, borrado de cuenta, privacidad) sigue en oscuro. Es mezcla deliberada por ahora, pero si se decide llevar todo a claro hay que convertir esas pantallas: usan clases de tema oscuro (`text-white`, `bg-white/5`) que no se adaptan solas.
- El `data-tema` vive en el DOM y no en estado de React. Es correcto para algo que afecta al documento entero, pero significa que un componente no puede reaccionar al tema sin leerlo del DOM.

## [2026-09-07] El demo en vivo sale de la landing; entra video
**Context:** La landing ofrecía probar el AR con un marcador universal. Pero la app no se ha liberado, el AR no está probado con cámara real, y quien llegue de una campaña sería el primero en toparse con un fallo. Las primeras reseñas de una app pesan de forma desproporcionada.

**Decision:** Se retira el enlace al demo de la landing y en su lugar va un video grabado, generado con Higgsfield. **La ruta `/demo` se conserva viva pero sin promocionar**: el marcador y su `.mind` siguen siendo la respuesta al riesgo "los jueces no tienen tatuajes", solo que se muestra cuando esté probado y no antes.

**El video va por variable de entorno** (`VITE_VIDEO_DEMO`), no incrustado: se publica sin tocar el bundle, y mientras no exista la sección simplemente no se dibuja. Un reproductor vacío o roto en la primera pantalla hace más daño que no tener video — sugiere que el producto tampoco funciona.

## [2026-09-07] Reescritura del texto de la landing
**Context:** La versión anterior afirmaba "historias que siguen vivas" sin sostenerlo en ningún lado, y nunca contestaba qué hace la app ni por qué debería importarle a alguien. Descrita así, es indistinguible de un filtro.

**Decision:** Se estructura alrededor de las preguntas que un desconocido se hace, en ese orden:
1. **¿Qué es?** — reconoce el tatuaje con la cámara y le sobrepone 3D; no lo modifica ni lo tapa, lo usa como llave.
2. **¿Por qué "segunda vida"?** — casi nadie se tatúa por decorarse; te tatúas al perro que murió, la letra de tu abuela. Ese recuerdo se queda en la piel pero se queda quieto. Lo que revive no es el tatuaje: es el recuerdo que representa.
3. **¿Cómo funciona?** — tres pasos.
4. **¿A dónde va?** — hoy catálogo, mañana la animación de TU perro desde una foto y una frase. Conecta con la hipótesis del modelo de negocio: la gente paga por animar su recuerdo, no por un 3D genérico.
5. **¿Por qué no es un filtro?** — el activador es la piel y no la cara, cualquiera lo ve sin instalar, y es permanente.

El video y la explicación van ANTES del formulario. Quien no conoce el producto no entrega su correo por una descripción.

## [2026-09-07] Trazos de tinta y ajuste del logotipo
**Context:** Llegaron los tres trazos de tinta que faltaban del tablero, en PNG de 1536×1024 con transparencia real. Hasta entonces la textura de fondo era la propia K estirada, que se notaba repetida.

**Decision:** Los trazos se guardan como **máscaras CSS en modo LA** (luminancia 0 + el alfa original) y se colorean con `background-color`.

**El error que costó una iteración:** primero se guardó solo el canal alfa como escala de grises. La máscara CSS de una imagen rasterizada recorta por **alfa**, no por luminancia — y una imagen en escala de grises es opaca en todo el rectángulo, así que la máscara no recortaba nada y el trazo salía como un bloque gris sólido. LA conserva el alfa (que es lo que recorta) y descarta los tres canales de color, que no aportan porque la tinta es negra en todos lados.

Resultado: 390KB los tres, contra 1.2MB en RGBA. Y como el color sale del CSS, el mismo archivo sirve sobre fondo claro y sobre oscuro sin duplicar assets.

**Van a opacidad 0.10-0.13** porque viven detrás del texto. A plena intensidad compiten con lo que hay que leer. Se verifica también que no capturen clics (`pointer-events: none`) y que el contenedor recorte lo que sangra, o la página haría scroll horizontal en móvil.

**Logotipo: se descarta la composición tipográfica.** Se llegó a armar dibujando "IN" y "AR" en Montserrat alrededor de la K, con Montserrat versionada en el repo para que el resultado no dependiera de qué tuviera instalado quien corriera el script. Funcionaba, pero después llegó `brand/logo.png` — el logotipo original aprobado, 2172×724 con transparencia real — que trae el triángulo dentro de la A y el ajuste fino entre las letras y la K. Ninguna recomposición reproduce eso. Se adopta el original, y se retiran la composición y el archivo de fuente, que quedaron sin uso.

**Risks/Limitations:**
- `mask-image` necesita prefijo `-webkit-` para Safari; van los dos. Si algún navegador ignorara ambos, el trazo se vería como bloque sólido — el mismo síntoma del error anterior.
- Los trazos solo están en la landing. Cuando se lleve el estilo al resto de la app hay que cuidar que no aparezcan sobre el visor AR.

## [2026-09-07] Corrección del copy: el producto no es solo para duelos
**Context:** La versión anterior abría con "casi nadie se tatúa por decorarse" y ejemplificaba solo con pérdidas: el perro que murió, la letra de la abuela. Es una premisa falsa y además excluyente — mucha gente lleva un dragón, una cruz o trabajo geométrico porque le gustó cómo se veía, y el producto les sirve igual.

**Decision:** El eje pasa de *duelo* a **movimiento**. "Un tatuaje es una imagen que no se mueve. Ese es su límite, no su defecto." Y los ejemplos cubren los dos casos en la misma frase: el dragón abre las alas, la cruz se enciende, el perro vuelve a correr. Se cierra explícitamente: "da igual si tu tatuaje guarda una historia o simplemente te gustó cómo se veía".

**Se elimina "el activador es tu piel, no tu cara".** La comparación con los filtros faciales no significaba nada para quien no piensa en filtros como categoría. Se reemplaza por diferencias observables: no vive dentro de una app, está atado al dibujo y no a tu teléfono, y se registra una vez pero se cambia cuando quieras.

**Beneficios segmentados.** Lo que le sirve a un tatuado (entrar antes, créditos) y lo que le sirve a un estudio (programa, material para el local, aparecer en su ciudad) no se parecen. Una lista genérica obliga a cada uno a ignorar la mitad, y la mitad ignorada suele ser la que más pesa. La lista cambia con la selección del formulario.

**Se retira el enlace "¿Ya tienes la app? Activa tu tatuaje"** del pie: la app no se ha liberado, así que le hablaba a un público que no existe y mandaba a una pantalla que quien llega no puede usar.

**Risks/Limitations:**
- Los beneficios son **promesas de negocio**, no texto de relleno: créditos de lanzamiento sin costo, material impreso para estudios, y aparecer en un directorio por ciudad. Ese directorio **no existe todavía**. Si alguno no se va a cumplir, hay que quitarlo de la landing antes de mandar tráfico.

## [2026-09-07] Video de la landing: concepto generado, como puente
**Context:** La landing necesitaba un video que mostrara la idea. Había dos candidatos.

**El video real de 2022 se descartó**, y no solo por la antigüedad:
- Lleva **la interfaz de otra plataforma superpuesta** ("Encuentra la imagen", "Sigue moviendo el teléfono de un lado al otro"). Publicarlo sería enseñar la interfaz de otra herramienta como si fuera InkAR.
- El contenido es un gato **plano en 2D**, no 3D. No solo no representa a dónde va el producto: **subestima lo que la app ya hace hoy**, que corre modelos con esqueleto y animaciones reales.
- 288×640, compresión de WhatsApp. Borroso en cualquier pantalla actual.

**Decision:** Se publica un video generado con IA (Higgsfield, seedance_2_0, 720×1280, 5s) como **puente**, con rótulo explícito: "Representación del concepto, generada con IA. No es una grabación de la app". El título dejó de ser "Míralo funcionando" — prometía algo que el video no entrega.

Antes del rótulo honesto, la landing decía "Grabado con la app real, sin montaje". Con un video generado, esa frase habría sido **falsa en una página pública**.

**Detalles:** recomprimido de 2014KB a 462KB (77% menos) porque el archivo también acaba dentro del APK aunque la app nunca muestre la landing. Lleva póster, porque sin él el reproductor muestra un rectángulo negro que se lee como elemento roto. La ruta se puede sobrescribir con `VITE_VIDEO_DEMO` para apuntar a la grabación real cuando exista, sin tocar código.

**Retirado el mismo día.** El resultado quedó fotorrealista —dragón con luz volumétrica, estética de VFX de cine— y eso **no se parece a lo que renderiza el motor**: modelos con esqueleto en Three.js sobre la piel, con estética de asset de videojuego. El rótulo aclaraba que era una ilustración, pero aun así fija una expectativa que el producto no puede cumplir, y quien llegue después a la app la va a comparar contra ese dragón.

La conclusión operativa: **es mejor no tener video que tener uno que promete de más**. La sección vuelve a no dibujarse mientras `VITE_VIDEO_DEMO` esté vacía, y el archivo se sacó de `public/` para no viajar dentro del APK sin usarse. Queda en `brand/video/` como referencia.

**Lo aprendido para el próximo intento:** si se vuelve a generar un puente, tiene que imitar la estética real del motor (3D estilizado, no fotorrealismo), o no vale la pena.

**Nota técnica:** un primer intento fue rechazado por el filtro de contenido (`nsfw`) por el énfasis en piel desnuda. No cobró créditos. Se reformuló situando la escena en un estudio y con manga arremangada.

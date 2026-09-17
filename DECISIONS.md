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
**Context:** El escaneo requería un link por tatuaje (`?tattoo=<uuid>`), atajo de Phase 1 que contradecía el Flujo B del `CLAUDE.md` (que vive en la carpeta padre, fuera del repo) ("MindAR reconoce la imagen → consulta Supabase") y mataba la viralidad: para ver un tatuaje había que recibir su link específico.

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

## [2026-09-07] Giro: el contenido pasa de 3D a video 2D
**Context:** El catálogo eran modelos GLB con animación esquelética. Se probó el camino del 3D personalizado generando el modelo del perro del founder desde un video suyo, para ver si era viable a escala.

**Lo que costó UN solo modelo:**
- Un video que casualmente existía, de hace años
- Análisis de nitidez de 167 cuadros para elegir 3 vistas complementarias
- 30 créditos de generación
- **4.5 MB**, cuando el límite del propio proyecto es 3 MB
- **Cero animación** — y animar un cuadrúpedo es justo la parte difícil: la biblioteca de rigging es humanoide y deforma a los no bípedos

El modelo salió reconocible, así que el problema no es la calidad: es que ese costo se repite **por cada cliente**. Es exactamente el cuello de botella humano de días que el modelo de negocio ya describía, ahora medido.

**Decision:** El contenido que se muestra sobre el tatuaje pasa a ser **video 2D animado**. El 3D se mueve de producto a **promesa** — dos modelos de escaparate para el motor de negocio, producidos cuando llegue la máquina nueva.

**Por qué el 2D escala y el 3D no:**
- **El tatuador ya es ilustrador.** Animar su propio diseño está dentro de lo que sabe hacer; un modelo 3D riggeado no. El canal se convierte en la fábrica.
- El costo marginal por cliente son créditos de generación, que **escalan con el ingreso** en vez de con la infraestructura.
- Archivos mucho más chicos que un GLB texturizado.
- Otro estudio (Flores Negras) ya lo hace con ilustraciones 2D animadas: el mercado acepta el formato.

Técnicamente cambia menos de lo que parece, y ya estaba previsto: `SHIPATON.md` listaba "video anclado al target (textura de video sobre plano)" en el Bloque 2. MindAR, el tracking, el perfil y los créditos no se tocan.

## [2026-09-07] Audio y música: por qué no son el mismo problema
**Context:** Se planteó agregar audio de recuerdo y música al contenido.

**La música NO se puede generar con las herramientas disponibles.** La herramienta de audio lo declara: *"solo genera voz: no puede generar música ni efectos de sonido para uso general"*. Los modelos de música existentes están reservados a otra tubería y no deben usarse sueltos.

**La trampa de licencias con música de biblioteca:** casi todas las licencias comerciales cubren usar la música *en el contenido propio*. Aquí los usuarios **adjuntarían música a su propio contenido, que además se comparte públicamente** — eso es sublicenciar, y la mayoría de las bibliotecas lo prohíben expresamente. Usar Epidemic Sound o Artlist en su nivel estándar no cubre este caso; hace falta un nivel de licencia para plataformas con contenido de usuario.

**Decision:** El primer audio es **el que graba el propio usuario**. Cero exposición legal, y para un producto de recuerdos la voz de alguien vale más que una pista de biblioteca. La música curada queda para después, y cuando toque hay que contratar el nivel de licencia correcto — no el estándar.

**Sobre clonar voces:** la herramienta lo permite, y para "la voz de tu abuela" es emocionalmente potentísimo. Pero clonar la voz de una persona real exige su consentimiento, y con personas fallecidas el terreno legal varía por jurisdicción. Si se abre esa puerta, debe ser con consentimiento explícito y documentado, no como una función más del catálogo.

## [2026-09-07] Capa de video 2D sobre el target
**Context:** Con el giro a contenido 2D, el visor tenía que aprender a mostrar video anclado al tatuaje, no solo modelos GLB.

**Decision:** `videoLayer.js` monta un plano con textura de video sobre el ancla de MindAR. El GLB se conserva: `useThreeScene` despacha según el target traiga `videoUrl` o `glbUrl`.

**El problema real era la transparencia.** El contenido tiene que aparecer sobre la piel, no dentro de un rectángulo opaco — un recuadro encima del tatuaje arruina el efecto entero. Y el video con canal alfa **no es portable**: WebM/VP9 lleva alfa pero Safari no lo reproduce; HEVC con alfa solo corre en Safari. Publicar ambos significa producir y alojar cada pieza dos veces.

**Solución: recorte de croma en el sombreador.** Un solo archivo, todos los navegadores. Se compara en crominancia y no en brillo — incluir la luminancia recortaría zonas iluminadas del dibujo que tuvieran algo de verde.

**El detalle que sí se veía mal:** recortar el alfa no basta. Los píxeles del borde sobreviven al recorte pero siguen teñidos de verde, porque la compresión mezcla dibujo y fondo en el contorno. **Verificado visualmente: había un halo verde alrededor de cada figura.** Se agregó desderrame —limitar el canal del croma a lo que justifican los otros dos— y el borde quedó limpio.

**Verde y no negro ni blanco** como color de fondo: es el más lejano a los tonos de piel y de tinta. Un fondo negro se comería las sombras del dibujo; uno blanco, sus brillos.

**El video se reproduce solo mientras su target está a la vista**, y se reinicia al aparecer. Si corriera desde la carga, quien por fin apunta al tatuaje encontraría la animación a la mitad — y mientras tanto se gastaría batería decodificando cuadros que nadie ve.

**Cómo se prueba sin cámara:** `/preview?video=<url>` monta la MISMA capa sobre un grupo suelto. Reusarla y no escribir una versión de prueba es el punto: lo que se revisa ahí es exactamente el sombreador que corre sobre la piel.

**Risks/Limitations:**
- **Sin probar con cámara real.** Lo verificado es el sombreador, el recorte, el desderrame y el ciclo de reproducción, con un video de prueba generado a propósito. Falta apuntar un teléfono a un tatuaje.
- El contenido debe producirse sobre verde puro. Si un dibujo tiene verde propio, se recortará: para esos casos hay que cambiar el color de croma por pieza, que el material ya admite como uniforme.
- El audio queda pendiente: el video va silenciado porque los navegadores móviles no autoreproducen con sonido. Activarlo exige un gesto del usuario.

## [2026-09-07] El recorte de croma falló por un error de secuencia, no de color
**Context:** La capa de video mostraba el fondo verde a media opacidad y todo el video oscurecido. Parecían dos fallas distintas —"el recorte no funciona" y "los colores salen mal"— y llevaron a buscar en gestión de color: espacios sRGB contra lineal, la pieza `colorspace_fragment` (que además no existe en Three 0.151, ahí se llama `encodings_fragment`), y la codificación de salida del sombreador.

**Ninguna de esas era la causa.** El color de fondo se detectaba en el evento `loadedmetadata`, cuando el video ya conoce sus medidas pero **todavía no tiene ningún cuadro decodificado**. Dibujarlo en un lienzo en ese momento devuelve negro.

Medido en la propia página: `[0,0,0]` en `loadedmetadata` contra `[100,180,78]` con un cuadro real.

Con el croma en negro, el fondo verde no quedaba fuera del umbral sino **a media distancia**: alfa ≈ 0.4. Por eso no desaparecía del todo ni se quedaba intacto, y por eso el conjunto se veía apagado. **Un solo error producía los dos síntomas.**

**Decision:** la detección se hace en `loadeddata`, que sí garantiza un cuadro. Se documenta en el propio archivo porque el modo de fallar es engañoso y llevaría al mismo callejón.

**Lo que sí quedó claro del camino:** los generadores de video **no respetan el color de fondo que se les pide**. Se pidió `#00FF00` y salió `[105,195,80]`, pero con una desviación de 1.5 — plano como una pared. Por eso la capa mide el color real en vez de asumirlo: asumir verde puro no habría recortado nada.

**Verificado:** el fondo desaparece por completo, los colores del sujeto salen correctos y el borde queda limpio, con una pieza generada de verdad y no con un video sintético.

## [2026-09-07] El desderrame manchaba al sujeto: solo va en el borde
**Context:** Primera prueba del video 2D sobre piel real, con el tatuaje de la huella del founder. El recorte funcionó —sin recuadro verde, borde limpio, el contenido anclado y siguiendo el brazo— pero el pecho crema del perro salió con manchas grises.

**Se descartó la compresión primero, midiendo:** el cuadro original y el recomprimido para web difieren en 0.5 de media, y la desviación de la zona del pecho es idéntica (76.7 contra 76.9). El video de origen estaba limpio.

**La causa era el desderrame**, que se aplicaba a TODOS los píxeles. En un crema o un blanco cálido el canal verde apenas supera el promedio de los otros dos, así que la corrección se lo bajaba y la zona quedaba grisácea.

**Decision:** el desderrame se pondera por `1 - alfa`. La contaminación real solo existe donde el fondo se mezcla con el dibujo, es decir donde el alfa es parcial; en el interior opaco el factor cae a cero y el color no se toca.

## [2026-09-07] Validado sobre piel: el tatuaje de la huella rastrea al límite
**Context:** Al probar sobre el tatuaje real cuesta que enganche.

**No es solo la luz.** El propio historial ya lo tenía medido: la huella da **2308 puntos de detección y 16% de seguimiento**; el esqueleto, 2516 y 20%. El marcador generado para el demo da 33% — el doble que la huella.

O sea, ese tatuaje está en el extremo bajo de lo ACEPTABLE, y con poca luz se cae. **Esto es el argumento concreto para conectar el analizador al flujo de activación**, que sigue pendiente del Bloque 1: si al founder le cuesta con 16%, un cliente con un tatuaje peor pide reembolso. Vale más rechazar una foto antes de cobrar que devolver el dinero después.

## [2026-09-07] El analizador entra al flujo, pero antes del diseño y sin bloquear
**Context:** El analizador existía desde el día 1 y solo se usaba por CLI. La entrada anterior dejó el argumento concreto para conectarlo: la huella rastrea al 16% y cuesta engancharla, así que un cliente con un tatuaje peor pide reembolso.

**Lo que resultó ser el problema real:** no era medir, era *cuándo*. El flujo iba `foto → subir → elegir diseño → compilar`. Compilar es el único momento en que se puede medir —las métricas salen de los descriptores que produce esa misma compilación—, así que el veredicto llegaba **después** del compromiso del usuario. Con diseños de pago eso es cobrar antes de saber si el tatuaje funciona.

**Decision:** la compilación se mueve al paso de la foto. `foto → compilar y medir → (veredicto) → elegir diseño → guardar`.

**Lo que abarató el cambio:** `analyzeTattooImage()` ya devolvía `{ metrics, mindBuffer }` de una sola compilación. Medir es contar arrays que la compilación ya produjo, no una segunda pasada. Así que `/compile-stream` emite las métricas junto al `done` y **no agrega ni un segundo de espera**: son los mismos ~11s, corridos un paso antes. Encadenar `/analyze` y luego `/compile` habría costado el doble para llegar al mismo binario.

**Advierte, no bloquea** (decisión de Richard). Con 'malo' el botón cómodo es repetir la foto y "Activar de todos modos" queda discreto; con 'aceptable' se invierte. Razón: los umbrales son heurísticas sin calibrar —lo dice el encabezado de `analyzer.js`—, y bloquear con umbrales equivocados deja al usuario sin producto y sin recurso, que es peor que un reembolso. El tatuaje del propio founder cae en 'aceptable' por poco: una pared ahí espantaría a la mayoría de los tatuajes reales.

**Alternativas consideradas:** bloquear en 'malo' (protege del reembolso pero apuesta a que los umbrales ya están bien, sin datos que lo sostengan); medir en silencio sin mostrar nada (no protege de nada, solo prepara el terreno).

**Lo que convierte esto en datos:** migración 007. Se guarda `quality_metrics` completo como jsonb —no columnas sueltas, porque todavía no sabemos qué métrica es predictiva: los puntos de detección ya se descartaron como predictor— y sobre todo `quality_overridden`, que marca los casos donde el analizador dijo "malo" y el humano no estuvo de acuerdo. Si esos tatuajes después funcionan, los umbrales castigan de más; si generan quejas, están bien puestos. Sin esa columna cada activación tira el dato a la basura.

**Un hallazgo secundario, y no menor:** al ver el veredicto en pantalla salieron dos textos que eran invisibles mientras el analizador solo escupía a una terminal. Decía **"el 3D va a vibrar"** —el contenido dejó de ser 3D el mismo día— y usaba **"tracking"/"trackean"** en texto de cara al cliente. Peor: los motivos y consejos los redacta el worker, así que llegaban en español a una app bilingüe, y los jueces del Shipaton leen inglés. **Decision:** el worker manda un `code` estable junto al texto en español, y el cliente rearma la frase en su idioma con las cifras que ya recibe. El texto del worker queda de respaldo para el CLI y para códigos que la app todavía no conozca.

**Riesgos y límites:**
- Quien abandone en el selector deja una compilación sin usar, y repetir la foto deja la anterior huérfana en Storage. Ambos aceptados a sabiendas: kilobytes contra un reembolso.
- **El worker debe redesplegarse en Railway o la pantalla nunca aparece.** El cliente trata la ausencia de métricas como "no medido" y deja pasar al usuario en silencio — degrada bien, pero la función queda inerte sin que nada falle a la vista.
- Los umbrales siguen sin calibrar. Esto no los arregla: monta el instrumento que permitirá arreglarlos.

**Verificado contra el worker corriendo, no supuesto:** el marcador del demo devuelve 3440 puntos y 33% de seguimiento — idéntico a lo que ya estaba medido por CLI, así que el camino nuevo mide lo mismo. Una foto de trazo fino en una esquina devuelve 'malo' con las cuatro razones y los tres consejos correctos. Las dos pantallas revisadas a 375px en español e inglés.

## [2026-09-08] Precio, canal de estudios y primer crédito a mitad de precio
**Context:** La app se publicó en Play el día 2 del sprint, pero la versión publicada no puede cobrar (llave de RevenueCat vacía, sin flujo de compra). Al construir el cobro había que decidir precio y el esquema del canal de estudios, con una junta con estudios a dos días.

**Decisiones, discutidas como socios y no por consenso fácil:**
- **Un solo precio en todos lados: $25 USD por crédito, 1 crédito = 1 video.** Se descartó tener precio distinto en el estudio y en la app —Richard detectó el conflicto de canal: el cliente descubre el barato, compra ahí, y el estudio queda vendiendo algo que nosotros mismos abaratamos.
- **Primer crédito a $12.50, una sola vez por usuario (`creditos_primero`).** Idea de Richard, mejor que el crédito gratis universal que se había propuesto: con crédito gratis, cada usuario nuevo genera $0 y el estudio que lo trajo ve $0 de comisión en su primera interacción. Con el 50%, hay ingreso y comisión desde el primer toque — y para un concurso medido en facturación, esa diferencia es la métrica.
- **La prueba gratis que exigen las reglas va por código promocional** (`SHIPATON`, 1 crédito, 200 usos), no por crédito universal. Desacopla "los jueces pueden probar" de "todo el mundo empieza gratis".
- **Sin descuento por código de estudio.** Se discutió un 50%: los números no cerraban (comisión 20-30% más descuento 50% dejaba $8 de $25), descontaba a quien ya venía vendido en persona, y el código se propagaría hasta volver $12.50 el precio real. El código es "acredita a tu tatuador", no un cupón.
- **Comisión 20% de lo cobrado, 30% para los primeros 20 estudios. Pago mensual, día 20, mes anterior, neto de reembolsos.** Richard proponía pagar a 3-7 días; Google paga al desarrollador el día 15 del mes siguiente, así que eso habría sido financiar al canal de nuestro bolsillo. Lo predecible genera más confianza que lo rápido.
- **Atribución permanente**: el estudio que trajo al cliente lo conserva; otro código no lo sobreescribe. Evita robar atribuciones.
- **Liquidaciones a mano el primer mes.** Se discutió construir el tablero de pagos ya; se difirió porque con volumen de dos dígitos una hoja de cálculo lo resuelve, y la maquinaria (libro de comisiones, reversión por reembolso, fiscal) no es una tarde. Lo que sí es perecedero es el dato de atribución, y eso sí se captura desde ahora.

**Alternativas descartadas:** crédito gratis universal; doble precio app/estudio; 50% de descuento por referido; retención de 3-7 días; guardar videos reembolsados para marketing o reventa (el valor del video es que es de esa persona — para cualquier otra vale cero, y es dato personal).

**Riesgos:** los tramos 1 / 3 / 5 y los $25 son hipótesis sin una sola transacción detrás; falta el costo real por video (Richard paga el plan de Higgsfield el 9 sep para medirlo). El $12.50 puede anclar bajo la percepción de valor; se mitiga mostrándolo como excepción con el precio real al lado. `registrar_estudio` es llamable sin sesión, igual que la lista de espera: expuesto a altas basura, aceptado por ahora.

**Implementación:** migración 008 (`estudios`, `codigos_promo`, `canjes_promo`, `users.estudio_id`, funciones `registrar_estudio`, `atribuir_estudio`, `canjear_codigo`, `ha_comprado`), `lib/estudios.js`, `lib/promo.js`, captura de `?estudio=` en cualquier ruta, campo "¿Quién te tatuó?" antes del login, canje y primer crédito en `/creditos`, alta de estudios en la landing. Productos en Play: `creditos_primero`, `creditos_1`, `creditos_3`, `creditos_5`.

## [2026-09-09] Generación de video: el producto que faltaba, y dónde vive
**Context:** Al ir a "mejorar la app antes de compilar la v4" se verificó contra el código que **no existía ninguna generación de video**: ni llamada a Higgsfield, ni gasto de créditos, ni columna de video en `tattoos`. El flujo activaba un tatuaje y le colgaba un GLB del catálogo estático; el video 2D vivía solo hardcodeado en `demo=zero`. La app vendía créditos para una función inexistente — problema de política de Play, de reembolsos y de calificación de los jueces. Pasó por delante del rediseño.

**Decision — dónde corre la generación:** en el **worker de Railway**, no en una edge function ni en el cliente.
- La llave de Higgsfield no puede ir en el bundle.
- Una generación tarda minutos y hay que sondear, descargar el video y copiarlo (los archivos de Higgsfield caducan a los 7 días). Una edge function tiene límite de tiempo; el worker es un proceso largo que ya existe y ya se despliega.
- Supabase no tiene `pg_cron`/`pg_net`, así que el sondeo no puede vivir en la base.

**Decision — el orden de las operaciones, y por qué:** verificar JWT → crear fila en `generaciones` → **reservar crédito con cerrojo** → enviar a Higgsfield → **responder 202 con el id** → sondear en segundo plano → copiar a Storage → asignar al tatuaje. Reservar antes de enviar evita gastar dinero del proveedor sin el crédito del usuario; reembolsar cuando el envío o la generación fallan evita que un tropiezo nuestro le cueste al usuario. Responder antes de terminar evita que una red móvil corte una petición de minutos y el cliente no sepa si entró. Al arrancar, el worker reanuda lo que un reinicio dejó a medias.

**Decision — el crédito lo reserva el servidor, con una función solo para `service_role`.** `consumir_creditos()` lee `auth.uid()` y sirve para que el usuario gaste desde la app; aquí gasta el worker en su nombre, sin sesión. `reservar_credito_generacion(p_user, p_generacion)` recibe el id explícito, y por eso mismo NO es llamable por `anon` ni `authenticated`: cualquiera le descontaría a otro. Mismo cerrojo por usuario; idempotente por el índice `(motivo, referencia)` del libro mayor.

**Decision — el tatuaje se guarda ANTES de generar.** El worker escribe el video sobre un tatuaje existente, y si la generación falla el tatuaje queda activado sin contenido: se reintenta sin recompilar. `targetLoader` lee `video_url` y, si no hay ni video ni GLB, lo dice ("todavía no tiene contenido") en vez de pintar un target vacío que parecería un fallo de tracking.

**Hallazgo que corrige una cifra anterior:** los costos por video que se cotizaron por el conector (MiniMax 12 créditos ≈ $0.60) son del **catálogo del panel**, que no es el de la API pública. La API expone Seedance v1 lite/pro, Veo 3.1, Kling y DOP — **no MiniMax**. El costo real por petición de la API aún no se conoce; el endpoint es configurable por variable de entorno (`HIGGSFIELD_ENDPOINT`, por defecto Seedance lite, Veo 3.1 como respaldo) precisamente para cambiarlo sin desplegar cuando se mida.

**Alternativas consideradas:** webhook de Higgsfield en vez de sondeo (existe, `?hf_webhook=`; se deja como mejora — el sondeo desde un proceso largo es más simple de verificar); consumir el crédito desde el cliente antes de llamar al worker (un fallo de red nos haría perder el crédito del usuario); mantener la petición HTTP abierta hasta terminar (se corta en móvil).

**Riesgos:** el flujo completo no se ha ejecutado de punta a punta con llaves reales; la calidad del video de Seedance lite sobre piel es hipótesis; el prompt pide fondo verde pero ningún modelo respeta el color exacto (la capa de video lo mide, ver croma-video-ar); `RecuerdoForm` no reduce la foto y una de 12 MP viaja entera al Storage y a Higgsfield.

**Implementación:** migración 009 (`generaciones`, `tattoos.video_url`, `reservar_credito_generacion`, `reembolsar_generacion`, bucket `videos`), `worker/higgsfield.js`, `worker/generacion.js`, `worker/supabase-admin.js`, `POST /generar`, `lib/generacion.js`, `EleccionContenido`, `RecuerdoForm`, `GeneracionStatus`, y el recableado de `Activate` (compilar → veredicto → **elegir contenido** → recuerdo | catálogo).

## [2026-09-09] El catálogo documentado no es el que la cuenta habilita
**Context:** Con las llaves de Higgsfield ya puestas, se fue a comprobar si la cuenta tenía saldo. La primera petición real —Seedance lite, el modelo que se había configurado por defecto— devolvió `404 model_not_found`.

**Lo que estaba mal, y de dónde vino:** los perfiles de `higgsfield.js` se escribieron desde un **resumen** del OpenAPI, no del archivo. Al bajar el `openapi.json` de verdad, la ruta existía y el cuerpo coincidía campo por campo con el esquema. El 404 no era la petición: **la cuenta no tiene ese modelo**. Peor: el respaldo configurado, Veo 3.1, devuelve `503 model_disabled`. Los dos caminos estaban rotos y ninguno se habría detectado hasta la primera generación de un usuario real.

**El descubrimiento que lo vuelve barato:** la API resuelve el modelo **antes** de validar el cuerpo. Un POST con `{}` distingue disponibilidad sin arrancar nada: `404` no disponible, `503` deshabilitado, `400`/`422` disponible, `403 not_enough_credits` disponible pero sin saldo. Cero costo.

**Decision:** se agrega `worker/modelos.js`, que barre las rutas de imagen-a-video y dice cuáles sirven. Modelo por defecto pasa a `/minimax/hailuo-02/standard/image-to-video`. Los perfiles se reescriben desde el spec real.

**Corrección de una afirmación anterior:** el 9 sep se escribió que "la API pública no expone MiniMax". **Es falso** — expone Hailuo-02 y 2.3, y son justo los que esta cuenta sí puede usar. Aquello salió del mismo resumen de segunda mano.

**Lo que el barrido devolvió (9 sep 2026):** disponibles MiniMax Hailuo-02 (standard y pro), Hailuo-2.3 (fast, standard, pro), Kling 2.1 (standard, pro, master), Kling 2.5-turbo (standard, pro) y Wan 2.5 — once en total. No disponibles: Seedance (lite y pro) y Sora 2. Deshabilitados: Veo 3.1 y Veo 3.1 fast.

**Diferencias de esquema que obligan a un perfil por familia:** MiniMax usa duración en enum de enteros `{6,10}` y resolución `"768P"`; Kling `{5,10}` con `cfg_scale`; Veo la duración como **cadena** `{"4","6","8"}` y exige `generate_audio`. Y **ni MiniMax ni Kling aceptan `aspect_ratio`**: heredan la proporción de la foto de entrada, así que la vertical no se puede dar por hecha en el perfil — sale de lo que suba el usuario.

**`prompt_optimizer: false` en MiniMax.** Por defecto reescribe el prompt, y ahí se pierde la instrucción del fondo verde plano de la que depende todo el recorte de croma. Un prompt literal vale más que uno bonito con fondo de bosque.

**Fallos de cuenta separados de fallos de generación.** `not_enough_credits`, `model_not_found` y `model_disabled` se marcan `esDeCuenta`: el crédito del usuario se devuelve igual, pero en los registros sale "REVISAR LA CUENTA" y al usuario se le dice "no está disponible en este momento, no se te cobró" en vez de insinuarle que su foto estuvo mal.

**Estado del saldo:** `403 not_enough_credits`. Las llaves son válidas (un status de id inexistente devuelve `404`, no `401`) y no se ha podido generar nada todavía. Falta que Richard recargue.

**Verificado, no supuesto:** las llaves NO se filtran al bundle — Vite solo expone lo prefijado con `VITE_`, comprobado con grep contra `dist/`.

## [2026-09-09] La ficha de Play describía otro producto, y la política ocultaba un flujo de datos
**Context:** Bloque C — actualizar la ficha para la v4. Lo que se encontró fue más que texto viejo.

**El problema de fondo:** la ficha publicada dice "Eliges un modelo 3D del catálogo" y es de antes del giro a video. Alguien que instalara por esa descripción encontraría otra app. Pero al revisar apareció algo peor.

**El hueco de cumplimiento:** la política de privacidad **no mencionaba la generación de video ni a Higgsfield**. Desde la v4, la foto del recuerdo y la historia del usuario salen a la infraestructura de un tercero fuera de México, y eso no estaba declarado en ningún lado. Tampoco estaban los créditos ni las compras.

**Decision:** se declara explícitamente, en ambos idiomas, distinguiendo lo que la mayoría de las políticas confunde: **no todas las fotos viajan igual.** La del tatuaje solo va a Railway —en memoria, sin guardarse— y a Supabase. La del **recuerdo** es la única que sale a Higgsfield, y solo cuando el usuario pide una generación. Se añade también la advertencia de que esa foto puede contener la imagen de otra persona ("sube solo fotos que tengas derecho a usar").

**Consecuencia en la declaración de datos de Play:** "Fotos" pasa de *no compartido* a **compartido** —Higgsfield es un tercero real, no un encargado— y se agrega **historial de compras**, que en la v3 se omitió a propósito porque la app entonces no podía cobrar. Declararlo mal en cualquiera de las dos direcciones es declaración falsa.

**Los textos dejan de estar duplicados.** Vivían en `ficha-play.md` y en `textos-ficha.md` a la vez; al girar a video quedó una copia describiendo el producto anterior. Ahora `textos-ficha.md` es la única fuente y `ficha-play.md` remite a ella.

**Lo que se agregó para el revisor:** instrucciones para el código promocional `SHIPATON`. Generar un video cuesta un crédito, y un revisor sin créditos no puede probar la función principal — calificaría lo que se imagina. También la ruta a "Pruébalo sin tatuaje", que es la vía más rápida a ver el AR funcionando sin tener uno.

**Verificado en navegador, en los dos idiomas:** la política renderiza con la vigencia nueva, con Higgsfield en la lista de terceros y con las entradas de la foto del recuerdo y de los créditos.

## [2026-09-16] Interruptor de degradación: la app deja de ofrecer el video cuando no se puede generar
**Context:** El generador puede estar caído por tres motivos distintos y la app no distinguía ninguno: faltan llaves en Railway (hoy mismo, `/generar` responde 503 `no_configurado` en producción), la cuenta de Higgsfield se quedó sin saldo, o el modelo configurado dejó de estar habilitado en el plan. En los tres casos "Anima tu recuerdo" se ofrecía igual: el usuario subía la foto del recuerdo, escribía su historia, y chocaba al final. El crédito vuelve —el worker reembolsa con cerrojo— pero el esfuerzo no, y la impresión que queda es que el producto no sirve.

**El problema que casi se resuelve mal:** la propuesta original era un interruptor contra quedarse sin saldo. Pero un interruptor por configuración **no detecta saldo**: las llaves siguen presentes con la cuenta vacía. Y sondear el saldo es imposible — está registrado como trampa: la API de Higgsfield valida el cuerpo del pedido ANTES de revisar créditos, así que una cuenta vacía responde igual que una llena a cualquier sondeo que no sea una generación real. `modelos.js` prometía detectarlo y era falso.

**Decision:** no predecir, **reaccionar**. El único informe fiable sobre la cuenta es un envío de verdad, y `higgsfield.js` ya separaba "es culpa de nuestra cuenta" (`esDeCuenta`: `not_enough_credits`, `model_not_found`, `model_disabled`) de "esta petición estuvo mal". `worker/disponibilidad.js` recuerda ese fallo y apaga el producto; un envío aceptado lo enciende de vuelta. El primer usuario choca y recupera su crédito; los siguientes ven una pantalla honesta en lugar de la misma pared.

**Por qué el fallo caduca a los 15 minutos:** recargar Higgsfield no reinicia el worker ni avisa a nadie. Sin caducidad, el producto seguiría escondido después de recargar hasta el siguiente despliegue. Pasado el enfriamiento se vuelve a ofrecer y el siguiente envío real decide.

**Por qué en memoria y no en la base:** es una señal operativa de segundos, no un dato del negocio. Reiniciar el worker la borra, y eso es correcto: un despliegue suele ser justamente lo que cambió la configuración.

**Por qué el estado viaja por `/health` y no por una ruta nueva:** las dos combinaciones de versiones sobreviven. Un APK viejo contra el worker nuevo recibe el campo extra y lo ignora; un APK nuevo contra un worker viejo no ve el campo y asume que sí se puede generar. `generacion.motivo` es un **código**, nunca una frase: lo que redacta el worker no pasa por el diccionario del cliente y llegaría sin traducir a un teléfono en inglés.

**Ante la duda, se ofrece.** El sondeo del cliente tiene 4 s de límite y falla abierto: una red móvil que parpadea no es evidencia de que el generador esté mal, y esconder lo que se vende por eso cuesta más que el error que se quiere evitar. Solo se apaga cuando el worker lo afirma. El guardia real está en el worker —rechaza antes de tocar el crédito—, así que apagarlo en la pantalla es cortesía, no seguridad.

**Por qué la tarjeta se queda visible, apagada, en vez de desaparecer:** esconderla dejaría el catálogo como si fuera la oferta completa y el usuario aprendería que InkAR es "modelos 3D gratis", sin saber que se perdió de algo. Se conserva el título, se quita el botón y se dice que vuelve pronto. El motivo NO se le explica: "el proveedor no tiene saldo" es un problema nuestro contado como si fuera suyo. Eso va a los registros del worker, donde ya se grita `⚠️ REVISAR LA CUENTA DE HIGGSFIELD`. Cuando el recuerdo está apagado, el destacado pasa al catálogo — la regla de `Tarjeta` es que solo una cosa por pantalla pide atención.

**Nuevo código de error `no_disponible`**, distinto de `no_configurado`: el primero es "la cuenta falló hace poco", el segundo "faltan variables". La pantalla los trata igual (volver a la elección con la tarjeta apagada) pero los registros no.

**Verificado contra las rutas reales**, worker levantado en local: sin llaves, `/health` reporta `no_configurado` y `/generar` sigue devolviendo 503 con el mismo código que antes (compatible hacia atrás); con llaves, `/health` reporta disponible y `/generar` pasa el guardia y cae en la validación normal. El circuito se probó aparte en 13 casos: apagado por cada motivo de cuenta, encendido por envío aceptado, indiferencia ante fallos del usuario, y caducidad del enfriamiento.

**Limitación conocida:** `BASE` de Higgsfield es una constante, así que el camino completo —envío real rechazado por saldo → circuito apagado— no se puede ejercitar sin la API de verdad. Se probaron por separado las dos mitades que se tocan en ese punto.

## [2026-09-16] Una llave revocada no apagaba el interruptor
**Context:** Al ejercitar el camino de Higgsfield con llaves inválidas apareció un hueco en la clasificación recién construida. `FALLOS_DE_CUENTA` reconocía `not_enough_credits`, `model_not_found` y `model_disabled` —los tres por su `detail`— pero un **401/403 de autenticación** no traía ninguno de esos textos, así que caía en el camino genérico: `esDeCuenta` quedaba en `false`, el interruptor de degradación **no se apagaba**, y cada usuario repetía el mismo choque hasta que alguien mirara los registros.

**Cuándo pasa de verdad:** al rotar las llaves de Higgsfield y dejar Railway con la vieja. Es el escenario más probable de toda la lista, porque es el único que se provoca haciendo algo bien (rotar credenciales).

**Decision:** un 401 o 403 que no traiga un `detail` conocido se clasifica como fallo de cuenta, con motivo `credenciales`. Va **por status y no por `detail`** a propósito: el texto de un error de autenticación no es estable entre versiones de una API y no conviene depender de él.

**Por qué `credenciales` y no `no_configurado`:** `no_configurado` significa "faltan las variables" y se arregla poniéndolas; aquí están puestas y no sirven. La app trata los dos igual —apaga la tarjeta— pero los registros y `/health` los distinguen, que es donde se depura.

**Verificado sin red**, sustituyendo `fetch`: 401 y 403 genéricos se clasifican como de cuenta y apagan el interruptor con motivo `credenciales`; 403 `not_enough_credits` y 404 `model_not_found` siguen clasificándose como antes; 422 y 500 **no** apagan nada, que es lo correcto — un cuerpo mal formado o un tropiezo del proveedor no son problema de la cuenta.

## [2026-09-16] `generar-cli.js`: ejercitar Higgsfield sin Supabase, sin app y sin gastar por accidente
**Context:** La generación está construida desde el 9 de septiembre y nunca se ha ejecutado. Todo lo que hay entre `enviar` y el video descargado está escrito contra el `openapi.json`, no contra una corrida real. Probarlo por la app exige worker + Supabase + JWT + crédito + tatuaje: cinco cosas que pueden fallar antes de llegar a la que importa.

**Decision:** un CLI que corre solo la mitad de Higgsfield —`enviar`, `esperar`, descargar— con las mismas funciones del worker, sin tocar Supabase ni reservar créditos. Si el perfil del cuerpo está mal para el endpoint configurado, se ve aquí en segundos.

**Por qué por omisión no gasta:** un video cuesta ~$0.28 reales. El modo por omisión comprueba llaves, modelo, costo estimado y estado del interruptor sin enviar nada; gastar exige escribir `--generar`. Un script de pruebas que cobra por correrse se corre menos.

**Lo que el CLI aclara a propósito:** el interruptor que muestra es la copia en memoria de ESE proceso, no el del worker en Railway; y cuando sale `no_configurado` dice cuál mitad falta, porque `estadoGeneracion()` también exige Supabase y el script no la necesita. Sin esas dos notas, se sale de ahí con una conclusión equivocada.

## [2026-09-16] La landing dice para cuándo, y vuelve a invitar al final
**Context:** La landing recogía correos sin decir nunca cuándo abría, y el único formulario estaba arriba — antes de las cuatro secciones que de verdad venden. Quien leía la página entera llegaba convencido al pie y no tenía dónde apuntarse: tenía que subir a buscar el formulario, y eso no lo hace casi nadie. Con una ventana de dos días (16 → 18, lanzamiento el 19), las dos cosas costaban conversiones que no se recuperan.

**La fecha, en el héroe.** Pedir el correo sin decir para cuándo es pedir un cheque en blanco, y la fecha es justamente lo que vuelve urgente apuntarse. La oferta va en la misma píldora y no en un banner aparte: "abrimos el 19, apúntate antes del 18" es una sola frase, y separarla haría que se leyeran como dos avisos que compiten.

**Las fechas viven en dos constantes al principio del archivo**, no repartidas por la copy. Esta fecha ya se movió una vez —del 17 al 19— y la revisión de Play puede moverla otra. Importa saber que corregirla es barato: **la landing se sirve desde Vercel, así que cambiar una fecha es un despliegue de segundos**, no un build del APK ni otra revisión. Con huso horario explícito (UTC-6): sin él, `new Date()` de un texto sin huso se interpreta distinto según el navegador y la cuenta saldría corrida un día para alguien en otro país.

**Tres estados y no dos.** El intermedio —oferta cerrada, todavía no abrimos— dura **un segundo** con las fechas de hoy, y aun así se construyó: es la red para el caso que sí puede pasar. Si Play tarda y hay que mover la apertura al 22, la página deja de prometer una oferta vencida **sin dejar de recoger correos**, cambiando una sola constante. Cerrar la lista entera en vez de cerrar solo la oferta habría tirado los correos de esos días.

**La oferta de la lista ya estaba decidida, y no por nosotros.** La landing publicada prometía "créditos de lanzamiento sin costo". La propuesta de "50% de descuento en el primer tatuaje" era **peor que lo ya prometido** —y encima el primer crédito a $12.50 ya es el precio de todos, así que no daba nada exclusivo—. Se conserva la promesa y se vuelve concreta: **"tu primer video va por nuestra cuenta. Sin tarjeta."** De paso corrige el idioma: decía "animar tu primer tatuaje" y no vendemos tatuajes.

**"Entras antes que el público general" se retira.** Con la lista cerrando el 18 y la apertura el 19, entrar "antes" no significaba nada. Se reemplaza por algo verdadero y comprobable: "te escribimos el día que abrimos, antes de que lo anunciemos en público".

**La segunda invitación va ANTES de estudios, no después.** El 9 de septiembre se corrigió que el formulario de arriba interceptara a los tatuadores y les diera una promesa en vez de su código; ponerla después de la caja de estudios repetiría el error al revés, dejando la última palabra de la página en un formulario que no es para ellos. Por la misma razón respeta la regla: si el visitante eligió "tengo estudio", ahí **no** se le pide el correo — se le señala su alta.

**Los estudios se quedan solo con el cupo, sin fecha.** Lo construido son los primeros 20, permanente (`cupo_fundadores()` = 20). Se evaluó sumarle fecha límite y se descartó: el cupo es la restricción real y está en el código; una fecha además habría sido una urgencia inventada encima de una verdadera.

**`source` distingue cuál formulario convirtió** (`landing` contra `landing-final`). La segunda invitación es una apuesta —que quien lee la página entera se convence más que quien ve el formulario antes de entender el producto— y sin la etiqueta no habría forma de saber en dos días si acertó. El costo de averiguarlo es una palabra: `select source, count(*) from waitlist group by source;`

**Verificado en navegador a 390 px, en los dos idiomas**, con el reloj falseado para recorrer los tres estados: oferta vigente, oferta cerrada y ya abiertos. Sin desborde horizontal, sin errores de consola propios (solo Google Fonts, que el proxy TLS del entorno de pruebas rechaza), y las tres formas de la página en su lugar: lista arriba, lista al final, alta de estudio.


## [2026-09-16, misma tarde] La oferta de la lista pasa a 50% de descuento
**Context:** Richard decidió, antes de compartir la landing, que la lista de espera lleve **50% de descuento en el primer video** en lugar de "va por nuestra cuenta". Revierte lo que se había escrito horas antes en este mismo archivo; la entrada anterior se conserva porque registró el razonamiento del momento y borrarla haría ilegible el historial.

**Un argumento a favor que no se había visto:** "gratis" no estaba construido. Exigía crear un código promocional topado antes del viernes —`codigos_promo` existe pero ese código no—, y era trabajo nuevo en una ventana de dos días. **El 50% ya está construido y ya va en la v4**: es el SKU `creditos_primero`, con su regla en `ha_comprado()` (migración 008). La decisión elimina una dependencia del lanzamiento en vez de agregarla.

**El problema que sí hay, y cómo se redactó alrededor:** `creditos_primero` se le ofrece a **cualquiera que nunca haya comprado**, no solo a quien esté en la lista. Así que el descuento es real pero **no es exclusivo de la lista**. Redactarlo como consecuencia de apuntarse —"apúntate y llévate el 50%"— prometería una exclusividad que el producto no aplica, y el primero que compre sin haberse apuntado lo descubre; además, presentar como descuento exclusivo lo que es el precio de todos es exactamente la clase de afirmación que PROFECO trata como descuento falso.

**Decision:** enunciar los dos hechos por separado, ambos verdaderos, sin inventar la relación entre ellos: **"La lista cierra el jueves 18. Tu primer video, con 50% de descuento."** Conserva la urgencia (la lista sí cierra), conserva el descuento (sí es la mitad) y no afirma que uno cause el otro.

**Se dice "video" y no "tatuaje"** aunque la instrucción decía "su primer tatuaje": InkAR no vende tatuajes, y prometer descuento en uno en la página pública generaría gente esperando un precio en un estudio. Es la regla de lenguaje que ya estaba registrada.

**Si se quiere que sea exclusivo de verdad**, hay una sola forma: restringir `creditos_primero` a quien esté en `waitlist`. Es un cambio de reglas de negocio, no de copy, y sube el precio de entrada de $12.50 a $25 para todo el que llegue sin apuntarse — probablemente malo para la conversión del día del lanzamiento. No se hizo; queda anotado como decisión abierta.

**Verificado en navegador a 390 px, en los dos idiomas**, en la píldora del héroe y en la caja de beneficios.

## [2026-09-16] El video de la landing sale de un archivo del repo, y declara qué es
**Context:** El hueco del video en la landing dependía de `VITE_VIDEO_DEMO`, una variable de entorno. Subir el archivo no bastaba: había que ir a Vercel, configurar la variable y redesplegar. Tres pasos y tres lugares donde equivocarse, en una ventana de dos días.

**Decision:** el video sale por omisión de `public/media/demo.mp4`. Se deja el archivo, se commitea, aparece. La variable de entorno sigue funcionando y gana si está puesta, para un video alojado fuera del repo.

**La regla que motivaba lo anterior se conserva, por otra vía.** Un reproductor roto en la primera pantalla hace más daño que no tener video: sugiere que el producto tampoco funciona. Antes eso se evitaba no dibujando la sección sin variable; ahora se dibuja y **`onError` la retira entera** si el archivo no está. Verificado en navegador en los dos sentidos: sin archivo la sección no existe (cero elementos `<video>`); con archivo aparece en su lugar, entre "¿Qué es InkAR?" y el formulario.

**`VIDEO_ES_GRABACION`: hay que declarar qué se está enseñando.** No es un detalle de copy, decide el rótulo impreso debajo. Ya pasó una vez —se publicó un dragón fotorrealista generado con IA y hubo que retirarlo— porque enseñar algo que el motor no produce pone al producto en deuda desde el primer día. Y al revés cuenta igual: rotular "representación del concepto" una grabación real tira a la basura lo único que de verdad convence.

**Por qué esto importa ahora:** `zero-nace.mp4` y `zero-concha.mp4` están en el repo y es tentador ponerlos aquí. **Son la capa de contenido** —lo que se proyecta encima del tatuaje—, no el producto funcionando. Sueltos muestran una animación bonita; no muestran que la app reconozca un tatuaje ni que el contenido se pegue a la piel y la siga. Lo que vende InkAR es el mecanismo, y el mecanismo solo se ve en una grabación de la cámara sobre piel real. Si alguno de esos archivos se usa aquí, `VIDEO_ES_GRABACION` va en `false`.

**`?demo=zero-nace` no es un video y no se puede enlazar desde la landing.** Es la experiencia AR: exige apuntar la cámara al tatuaje real de la huella de Zero. Un visitante que haga clic ve una pantalla de cámara y nada más — peor que no poner nada. Sirve para enseñar en persona, no para una página pública.
## [2026-09-16] La primera generación real: funcionó, y el croma también
**Context:** El motor de video se construyó el 9 sep y nunca se había ejecutado — cero generaciones en la base. Con la API recargada se corrió la primera de punta a punta contra Higgsfield (sin pasar por el worker todavía: falta la `service_role`).

**Resultado, medido:** `completed` en **240 segundos**. Video de **768x768, 5.875 s, 24 fps, 240 KB**. Ni un error.

**Lo que de verdad se estaba probando — el fondo:** el prompt pide verde plano porque de eso depende todo el recorte de `videoLayer.js`. Medido sobre las cuatro esquinas del cuadro 20: color **[96, 206, 67]**, desviación **[2.9, 1.8, 2.1]**. Plano. Y muy cerca del histórico [105, 195, 80], lo que confirma que el comportamiento es estable entre modelos distintos: **ninguno respeta el `#00FF00` que se pide, pero todos devuelven un verde plano**, que es justo lo que la capa necesita porque mide el color real en vez de asumirlo.

**Verificado en la capa real, no solo por números:** el video se sirvió en `/preview?video=` y se cargó (206 Partial Content en la petición del `.mp4`). En pantalla aparece el sujeto sin recuadro verde alrededor. La decisión de medir el color en lugar de asumirlo se valida por segunda vez, ahora con un generador distinto al original.

**Un detalle que hay que tener presente:** la salida es **cuadrada (768x768) porque la entrada era cuadrada**. MiniMax y Kling heredan la proporción de la foto; no aceptan `aspect_ratio`. Con la foto vertical de un teléfono saldría vertical, que es lo que quiere el producto — pero no está garantizado por el perfil, sale de lo que suba el usuario.

**Costo confirmado:** la estimación previa decía $0.28 y el envío se aceptó sin objeción. Con 240 s de espera, el texto de la app ("suele tardar de 1 a 3 minutos") se queda corto: **conviene decir 2 a 5 minutos**, o la pantalla de espera parecerá colgada justo en la primera impresión.

**Lo que sigue sin probarse:** el camino completo por el worker — reserva de crédito con cerrojo, copia a nuestro Storage, asignación al tatuaje y reembolso ante fallo. Todo eso necesita `SUPABASE_SERVICE_ROLE_KEY`.

## [2026-09-16] La cámara en movimiento NO ensucia el croma
**Context:** Richard pidió probar que el video "se vea 3D". Lo que da sensación de volumen en un video plano es el **paralaje**: si la cámara orbita, el cerebro lee profundidad. Se probó con el mismo modelo y la misma foto, cambiando solo el prompt, para que la comparación sirviera.

**El riesgo real que se estaba probando no era estético.** Una cámara que orbita suele arrastrar sombras y degradados al fondo, y todo el recorte de `videoLayer.js` depende de que el verde sea plano. Si se ensuciaba, el efecto 3D quedaba descartado de entrada.

**No se ensució.** Medido en tres momentos del video (cuadros 10, 60 y 120), desviación máxima **1.2 a 1.4** — incluso más plano que el video estático (1.9). Se pidió explícitamente `no shadows cast on the background` en el prompt, y el modelo lo respetó.

**Consecuencia:** el prompt tiene mucha más libertad de la que suponíamos. Movimiento de cámara, iluminación volumétrica y estética de render 3D son compatibles con el croma. La restricción que sí hay que conservar en cada prompt es la del **fondo plano sin sombras**, no la de la cámara quieta.

**Tiempos observados, con varianza alta:** 240 s el primero, **115 s** el segundo. Mismo modelo, misma resolución, misma duración. Cualquier texto de espera tiene que cubrir el peor caso, no el promedio.

**Costo:** $0.28 por video, confirmado por la estimación antes de cada envío. Dos pruebas: $0.56 en total.

**Lo que queda a criterio de producto, no técnico:** el video va anclado plano sobre el tatuaje. Un sujeto que gira sobre ese plano puede leerse como holograma —que es el efecto buscado— o puede romper la sensación de que está pegado a la piel. Eso se juzga viéndolo sobre piel real, no por números.

## [2026-09-16] El video hereda el estilo de la foto de entrada, y eso define el producto
**Context:** Richard pidió que el video "se viera más 3D y realista", con una acción de verdad —el perro agarrando la concha del suelo— y no una animación corta.

**La acción sí se consiguió.** Con la imagen de partida correcta y 10 segundos, el arco quedó completo: el perro mira la concha en el suelo, se echa, la sujeta con las patas y se la come, con un acercamiento lento de cámara. Vertical 9:16 (768x1364), 146 s de generación. El croma aguantó todo el video (desviación 1.8 a 2.3).

**El realismo NO se consiguió, y la causa es estructural:** `image-to-video` **hereda el estilo de la imagen de entrada**. La foto que se estaba usando era un cuadro de `brand/video/zero-croma.mp4`, que resultó ser una **ilustración plana de caricatura** — no un render 3D, como se había supuesto al describirla de lejos. De una caricatura sale animación de caricatura, siempre, sin importar el prompt.

**Se intentó convertirla a foto y no se puede con este plan.** `nano-banana` responde `model_not_found`; toda la familia `reve` responde `423 model_blocked`; `flux-pro/kontext` tampoco está. Sí están `higgsfield-ai/soul/*` ($0.188) y `popcorn/auto` ($0.092). Se probó popcorn con la caricatura como referencia pidiendo explícitamente fotografía: **devolvió otra ilustración**, más detallada y con la concha en el suelo, pero ilustración. Popcorn conserva el estilo de la referencia; es lo que hace.

**Consecuencia para el producto, y es la buena noticia:** esto no es una limitación del motor, es exactamente cómo debe funcionar. **El usuario sube la foto real de su mascota**, y de una foto real sale video realista. El pipeline está bien; lo que estaba mal era la entrada de prueba. Para validar el realismo hace falta una foto real de Zero — que es justo lo que hará cualquier cliente.

**Costos de esta ronda:** imagen $0.09 + video de 10 s $0.47. Total del día con las cuatro generaciones: **$1.21**.

**Dato de precio nuevo:** 10 segundos cuestan $0.467 contra $0.28 de 6 segundos — no es proporcional, sale más barato por segundo. Si el arco de una acción necesita 10 s, el costo sigue siendo ~2% del neto.

## [2026-09-16] Evocación: el contenido sale del tatuaje, y se hace en la GPU
**Context:** A Richard le comentaron que "solo vincular" un video a un tatuaje no impresiona y es fácil de copiar. La propuesta fue que el contenido se vea **salir** del tatuaje. La pregunta era si eso se hornea en el video generado o se anima en la app.

**Decision:** se anima en la app (`ARViewer/evocacion.js`), con los píxeles del propio tatuaje. La secuencia dura ~2 s: una onda enciende las líneas de tinta en violeta de marca, la tinta se desprende en ~700 partículas que suben de la piel, y el contenido se materializa desde el centro con el borde encendido, crece y se despega 0.12 del brazo (paralaje).

**De dónde salen los píxeles del tatuaje:** el `.mind` guarda la foto de cada target en escala de grises (256 px de ancho). MindAR ya la tiene en memoria en `controller.tracker.trackingDataList`, así que no hay descarga extra ni cambio de esquema. `mascaraTinta.js` separa la tinta de la piel comparando cada píxel contra la luz de su zona en dos escalas (6 px para trazos, 36 px para rellenos). La primera versión comparaba contra un nivel de piel global, y la sombra del brazo brillaba como tatuaje.

**Alternatives considered:**
- **Hornearlo en el video generado** ("el perro sale de un dibujo de tinta"): el generador no sabe dónde está el tatuaje real ni desde qué ángulo se mira, así que el efecto se vería pegado. Además cuesta otra generación por cliente y hereda el estilo de la imagen de entrada (ver la entrada anterior).
- **Una animación genérica** (portal, humo): cualquiera la copia en una tarde. Lo que protege es que el efecto dependa del rastreo **y** de la forma exacta de ese tatuaje.

**Hallazgo colateral, corregido:** el recorte de croma tenía un umbral absoluto (0.32) casi igual a la saturación del verde apagado que entrega el generador (~0.31). Resultado: **todo color neutro —el pelaje negro, el pecho blanco— quedaba a alfa ~0.45**, y se veía el tatuaje a través del perro. Esto ya estaba en producción con `demo=zero-concha`. Ahora la distancia se divide entre la saturación del fondo y un neutro vale 1.0 siempre.

**Risks/Limitations:**
- `trackingDataList` no es API pública de MindAR. Si cambia, el visor sigue funcionando pero sin evocación.
- Con `LuminanceFormat` la textura llegaba vacía en WebGL2 sin ningún error. Se usa RGBA.
- **Solo se probó en una página que simula el ancla** (`prueba-evocacion.html`), no con cámara sobre piel. Falta probar en el teléfono: fps en gama media, cómo se ve el violeta sobre piel real y la gracia de 1.5 s ante los parpadeos del rastreo (la huella rastrea al 16%).
- Llega al APK solo con una versión nueva (Capacitor empaqueta `dist`). En la web basta con desplegar.

**Improvement opportunities:** color de tinta por tatuaje; destino de las partículas con la silueta del primer cuadro en vez de una elipse; `?evocacion=0` ya permite grabar el antes y el después.

## [2026-09-16] El video empieza en el tatuaje (y se retira la evocación por GPU)
**Context:** Richard probó la evocación en el teléfono el mismo día y la descartó: "no se ve nada profesional". Además reportó dos fallas: al mover el brazo el contenido se descuadra, y al escanear primero el esqueleto y luego la huella apareció la pantalla verde completa. Compartió como referencia un video donde el dibujo del tatuaje cobra vida desde su propio trazo.

**Decision:** el efecto se hornea en el video generado, pero **anclado al trazo real**:
1. `worker/componer-inicio.js` extrae la tinta de la MISMA foto que se compiló en el `.mind` (`mascara-tinta.js`, que sobrevivió de la evocación) y la pone sobre el verde de croma, a todo lo ancho de un lienzo 768x1364.
2. Hailuo-02 recibe ese dibujo como `image_url` y el primer cuadro del video principal como **`end_image_url`**. Genera la transición: la tinta se vuelve líquida, forma un hoyo, Zero sale brincando y aterriza exactamente donde empieza el video de la concha.
3. `videoLayer` reproduce la intro una vez y cambia al principal en bucle, en el mismo plano. Con `escala: 1`, el cuadro 0 cae encima del tatuaje real.

Resultado de la prueba (`demo=zero-nace`): 6 s, **$0.28**, 110 s de generación. El último cuadro de la intro y el primero de la concha son prácticamente idénticos, y el fondo se mantuvo plano (el verde varía menos de 10 niveles).

**Por qué ahora sí en el video y antes no:** la objeción de la entrada anterior era que el generador no sabe dónde está el tatuaje. Dándole el trazo exacto como primer cuadro y la posición final como último, sí lo sabe. Y la herencia de estilo, que era una limitación, aquí trabaja a favor: de un dibujo de tinta sale una animación de tinta.

**Cómo se descubrió `end_image_url`:** el OpenAPI ya no se sirve en las rutas conocidas. Se mandó a `/estimate` (gratis) un cuerpo con varios nombres candidatos con tipo incorrecto; la API validó y nombró el que existe. Hailuo-02 (standard y pro) usa `end_image_url`; Kling 2.1 pro, `last_image_url`; Hailuo-2.3 y Kling 2.5 lo ignoran.

**Pantalla verde, causa probable:** en el celular `loadeddata` puede llegar sin cuadro decodificado y la medición del croma sale negra. Con el umbral relativo a la saturación que se había agregado ese mismo día, eso apagaba el recorte por completo (antes quedaba a medias). Ahora una medición sin saturación se descarta, se usa un respaldo medido de un video real (no `#00FF00`) y se vuelve a medir al reproducir. **No se reprodujo en el teléfono**; es la explicación que encaja con el código.

**Descuadre al mover el brazo:** `filterBeta` estaba en 0.001, que suaviza tanto que el contenido se queda atrás en cuanto hay movimiento. Pasa a 0.01, y `?beta=` / `?mincf=` permiten calibrarlo en piel sin recompilar.

**Alternatives considered:** conservar la evocación como opción (descartado, Richard no la quiere y sería código muerto; queda en el historial de git, commit 48c205c).

**Risks/Limitations:**
- La foto de entrada DEBE ser la que se compiló. Otra toma del mismo tatuaje no calza.
- Las orillas del brazo con vello pegadas al diseño se cuelan en el dibujo (se ve en la almohadilla izquierda de la huella). `limpiarMascara` quita las líneas sueltas, no las que tocan el tatuaje.
- La deriva del generador dentro de la intro no se controla: si el trazo "se mueve" antes de disolverse, se notará sobre la piel.
- Para el producto hace falta llevar esto al worker: dos generaciones por cliente (intro + recuerdo) o una sola con el recuerdo como cuadro final. Costo sigue en ~2-4% del neto.

**Improvement opportunities:** probar 10 s para una salida más lenta; `hailuo-02/pro` para más calidad; un borde de trazo más limpio si la foto es de estudio.

## [2026-09-16] Contenido tolerante al rastreo: congelar al perderlo e intro de gota
**Context:** Con `zero-nace` en el teléfono, Richard confirmó que se ve mucho mejor, pero que al mover el brazo el rastreo falla mucho. Opciones que puso sobre la mesa: omitir el rastreo, tinta solo en algunas zonas, solo el efecto de la tinta que escurre, o compilar varias fotos del mismo tatuaje.

**Diagnóstico:** MindAR supone un objetivo plano y rígido. El brazo es curvo, la piel se deforma, el movimiento desenfoca, y la huella rastrea al 16%. Ningún ajuste lo deja pegado con el brazo en movimiento rápido; lo que se puede controlar es cuánto SE NOTA la falla.

**Decision:**
1. **Congelar en vez de desaparecer** (`useThreeScene`): el contenido cuelga de un grupo seguidor que copia la matriz del ancla mientras hay rastreo. Al perderlo se queda quieto 600 ms, se desvanece en 400 ms y solo entonces se pausa. Antes, MindAR lo apagaba en el mismo cuadro y se sentía como parpadeo.
2. **Intro de gota** (`componer-inicio.js --modo=gota`, `demo=zero-gota`): el primer cuadro ya no es el dibujo completo sino una gota de tinta en el corazón de la forma más grande del tatuaje (transformada de distancia sobre el relleno cerrado). Con el dibujo completo, un desfase de milímetros se ve como líneas dobles; una gota sobre relleno oscuro lo tolera. Generación: 6 s, $0.28, 117 s.

**Alternatives considered:**
- **Varias fotos del mismo tatuaje:** ayudaría a *detectarlo* con distinta luz y ángulo, no a *seguirlo* en movimiento. Cada foto tiene su propia perspectiva, así que al alternar entre targets el contenido brincaría; evitarlo exige registrar las fotos entre sí. Varios días de trabajo con 14 días al cierre: se pospone.
- **Omitir el rastreo:** sin ancla el contenido deja de ser "del tatuaje", que es el producto.

**Risks/Limitations:**
- El congelado no se ha visto en el teléfono todavía.
- En la intro de gota el charco llega al borde inferior del lienzo entre 2.5 y 3.5 s; en piel puede verse un corte recto.
- Cerca de 4.5 s hay un acercamiento: el modelo lo mete para llegar al tamaño del cuadro final.
- Tres intentos para ubicar la gota: la zona más densa (cayó entre dos almohadillas), densidad ponderada al centro (cayó en la piel del hueco), y el que quedó.

**Improvement opportunities:** pedir en el prompt que el charco no pase de cierto tamaño; un cuadro final más pequeño (el sujeto a la escala del tatuaje) para evitar el acercamiento.

## [2026-09-16] Llave por diferencia: el dibujo quieto de la intro no se pinta
**Context:** Richard descartó la intro de gota ("exagerada, la tinta se sale y se corta en los lados") y eligió `zero-nace`: le encantó cómo escurre la tinta y forma el charco. Lo único problemático era el arranque: el dibujo del video se pinta encima del tatuaje real, y con el rastreo imperfecto se ven líneas dobles.

**Decision:** `videoLayer` captura el primer cuadro de la intro y, en el sombreador, no pinta los píxeles que siguen iguales a él. Mientras el dibujo está quieto se ve el tatuaje REAL; solo aparece la tinta que empieza a moverse. La llave se apaga entre el 40% y el 48% de la intro (2.4-2.8 s en `zero-nace`), cuando el charco ya cubrió el dibujo: sin eso, el pelaje negro del perro sobre una línea del dibujo original contaba como "sin cambio" y quedaba recortado. `introLlave: [ini, fin]` lo ajusta por video.

Probado en la página de simulación con el video corrido a propósito (1.5% del ancho y 1° de giro): a los 0.3 s no hay ninguna línea doble; a 1.3 s la tinta burbujea desde la almohadilla; a 3.2 s Zero sale sólido.

**Alternatives considered:**
- Saltar el primer segundo y hacer un fundido: resuelve el arranque, pero las almohadillas de abajo siguen dibujadas quietas hasta ~2.4 s y el desfase se vería ahí.
- Intro de gota: descartada por Richard; el compositor la conserva como `--modo=gota`, pero el modo por defecto vuelve a ser `trazo`. Se retira `demo=zero-gota` y su video (1.1 MB menos en el APK).

**Risks/Limitations:**
- Cuando la llave se apaga, los trazos de los dedos que el charco no cubrió se ven un instante (poco, y ya derritiéndose).
- La fracción 40-48% está medida sobre UN video. Otra intro con otro ritmo puede necesitar `introLlave`. Para producción conviene calcularla del propio video (cuando la cobertura de tinta deja de crecer).
- Si el primer cuadro no se puede capturar (CORS o cuadro sin decodificar), se reintenta al reproducir; si vuelve a fallar, se muestra el dibujo completo como antes.

## [2026-09-16] "Ya no carga": el video se pintaba negro antes de su primer cuadro
**Context:** Richard reportó que `demo=zero-nace` dejó de cargar en el teléfono. En el navegador de escritorio, con una cámara simulada (un lienzo con la foto compilada, inyectado en `getUserMedia`), MindAR rastreó y apareció un **rectángulo negro** del tamaño del plano encima del tatuaje.

**Causa:** `VideoTexture` de Three 0.151 solo sube un cuadro cuando `requestVideoFrameCallback` avisa. Antes del primer aviso la textura está vacía, el croma la compara contra el verde, la considera "sujeto" y la pinta negra y opaca. Con el rastreo parpadeando y la intro reiniciándose, ese estado puede durar; y hay navegadores móviles que avisan tarde para un `<video>` fuera del documento.

**Decision:** uniforme `listo`: el plano no se pinta hasta que hay un cuadro real de la pieza actual (también evita el destello del último cuadro al reiniciar la intro). Si el navegador no avisa, la app sube el cuadro cuando cambia el tiempo del video.

**Lo que NO funcionó:** subir el cuadro en cada render, además del aviso, hizo que Chrome dejara de mostrar el video de la cámara detrás del lienzo. Por eso la subida manual es solo respaldo.

**Coordinación:** otra sesión (rama `claude/exciting-hamilton-j3quzt`, trabajo de la landing) había desplegado su rama a producción con este código de AR ya integrado. Para no retirar su landing de producción al empujar `main`, se integró esa rama en `main` antes de subir el arreglo. Producción = su landing + este arreglo.

**Cómo probar AR sin teléfono (queda como herramienta):** abrir cualquier ruta del sitio, reemplazar `navigator.mediaDevices.getUserMedia` por `canvas.captureStream()` de un lienzo que dibuja la foto compilada, y navegar a `/scan` con `history.pushState` + `popstate`. Ojo: si el panel del navegador queda oculto, el lienzo deja de dibujar y la "cámara" se ve negra; no es la app.

**Risks/Limitations:** no se reprodujo en el teléfono; es la causa que encaja con lo observado en escritorio.

## [2026-09-17] El charco verde bajo las patas: lo dibuja el generador, no lo deja pasar el croma
**Context:** En la grabación de Richard del 16 sep aparece un charco verde oscuro bajo las patas del perro, sobre la piel. Medido: RGB(24,63,29), verde saturado; cero píxeles verdes en el cuadro de control (tatuaje quieto) y hasta 280 en el pico, presente desde que el sujeto emerge hasta el final. Se grabó a las 18:49 contra el build desplegado a las 18:37, o sea el actual — no era un despliegue viejo.

**El primer diagnóstico fue equivocado y hay que dejarlo escrito.** Se atribuyó a un fallo del recorte de croma. Al abrir el video de intro CRUDO, antes de cualquier recorte, el charco ya está ahí: **lo pintó Hailuo**, como sombra de contacto, con el mismo verde del fondo pero oscurecido.

**Por qué el recorte no lo quita, y por qué hace bien.** `videoLayer` compara en crominancia con el brillo descontado, a propósito: así un neutro (el pelaje negro, el pecho blanco) queda siempre a distancia 1.0 y permanece opaco sin importar qué tan apagado salga el fondo. El efecto secundario es que **un verde oscurecido también se aleja**: reproduciendo la fórmula sobre el cuadro real, el fondo al 50% de brillo mide 0.50 y el fondo al 30% mide 0.70, contra un umbral de 0.45 — los dos quedan opacos. La sombra no es "fondo" para el criterio actual, y el criterio es el correcto: distinguir "verde oscurecido" de "negro" es exactamente la ambigüedad que el umbral relativo existe para evitar.

**Decision: se ataca en el prompt, no en el sombreador.** Se añade `no shadows cast on the background` y `subject does not touch the ground` a `promptDe()`, en el worker. **No requiere recompilar el APK ni otra revisión de Play** — el prompt vive del lado del servidor. Corrige una afirmación previa de esta misma sesión que decía lo contrario.

**Lo que más duele del hallazgo:** la instrucción ya estaba comprobada. La prueba de la órbita de cámara del 16 sep (registrada arriba) dice textualmente "Se pidió explícitamente `no shadows cast on the background` en el prompt, y el modelo lo respetó", y concluye que esa es la restricción a conservar **en cada prompt**. Nunca llegó a `promptDe()`. Un hallazgo documentado y no aplicado vale lo mismo que no haberlo hecho.

**Alternativa evaluada y NO aplicada:** un recorte invariante al brillo —normalizar la crominancia de cada píxel por su propia luminancia antes de comparar—. Se probó sobre el cuadro real: llevaría el fondo oscurecido a distancia 0.00 a cualquier brillo, dejando negro, blanco, gris, naranja y café del sujeto intactos en 1.00. Funciona. No se aplica ahora por tres razones: el prompt ataca la causa y el sombreador solo el síntoma; el sombreador sí va dentro del APK y por tanto cuesta una revisión de Play; y otra sesión está editando `videoLayer.js` en este momento. Queda como defensa en profundidad para cuando haya margen, con la fórmula ya validada.

**Lo que este arreglo NO cambia:** `zero-nace.mp4` y `zero-concha.mp4` ya están generados con la sombra dentro, así que el video de la landing la conserva. Solo las generaciones nuevas salen limpias.

## [2026-09-17] Un solo formulario, al final, y la copy deja de describir el producto anterior
**Context:** Dos problemas que Richard señaló al ver la página publicada. El primero, repetición: había dos formularios —uno arriba, otro al final— y el 50% se mencionaba tres veces (píldora del héroe, caja de beneficios, y otra vez abajo). El segundo, más de fondo: **la copy seguía describiendo el producto anterior al giro a video.**

**El formulario queda uno, y se quita el de arriba.** Es la decisión de Richard y cae bien por dónde queda: quien llega al final ya vio el video, entendió el mecanismo y leyó por qué no es un filtro; el correo se pide con el derecho ganado en vez de de entrada. El costo asumido —quien se convence en los primeros diez segundos tiene que bajar— se compensa con la píldora del héroe, que da la fecha desde arriba, y con una página que no es larga.

**Lo que había que mover con él.** El formulario de abajo era una versión reducida: correo y botón. Al volverse el único tuvo que absorber **la pregunta de quién eres, los beneficios por perfil y la salida a estudios**. Sin eso un tatuador se habría quedado sin camino: el selector es lo que decide si el botón lleva a la lista de espera o a su alta real, y ese fue justamente el error que se corrigió el 9 de septiembre. Verificado en navegador: como persona hay un correo de lista; al elegir "soy tatuador" ese correo desaparece y solo queda el alta de estudio.

**El 50% se dice una sola vez**, en la caja de beneficios, justo donde se decide dar el correo. La píldora del héroe se queda con lo que sí es información —la fecha de apertura y el cierre de la lista— y suelta el descuento.

**La copy describía el producto de antes del giro.** Lo más grave: la sección "A dónde vamos" presentaba la generación de video como **"lo que estamos construyendo"**, justo debajo de un video que acaba de demostrarla funcionando. Eso no es solo texto viejo — subestima el producto delante de la prueba de que existe, y deja el catálogo como la oferta principal cuando es la manera gratuita de probar.

Cambios, en los dos idiomas:
- **"A dónde vamos"** → **"El video es tuyo, no de un catálogo"**, en presente: subes la foto, cuentas qué quieres que pase, la app genera ese video. El catálogo pasa a ser lo que es, la vía gratis para probar.
- **"¿Qué es InkAR?"**: "le sobrepone contenido en 3D" → "le pone encima un video tuyo".
- **Paso 2 de "Cómo funciona"**: "Eliges qué aparece encima · Contenido 3D animado" → "Subes tu recuerdo · Una foto y unas palabras: tu perro, esa persona, ese momento. La app genera el video."
- **Título del video**: "La idea, en movimiento" → **"Así se ve sobre la piel"**. Ya no es una idea: es una grabación.
- **Beneficio**: "lo tomamos en cuenta para el catálogo" → "nos dices qué quieres animar".

**Se retira el etiquetado de origen** (`landing` contra `landing-final`). Existía para saber cuál de los dos formularios convertía; con uno solo la pregunta no existe.
## [2026-09-16] Primera generación por el camino del worker: funciona de punta a punta
**Context:** con la `SUPABASE_SERVICE_ROLE_KEY` en `worker/.env`, por fin se pudo ejercitar lo que rodea a Higgsfield. Worker en local, base real, cuenta del revisor (`prueba@inkar.app`).

**Sesión sin contraseña:** se abrió con `POST /auth/v1/admin/generate_link` (magiclink, con la service_role) y `POST /auth/v1/verify` con el `hashed_token`. Da un JWT real para PostgREST y para el worker sin manejar credenciales en texto. Sirve para cualquier prueba futura con `auth.uid()`.

**Resultados:**
| Caso | Respuesta | Efecto en la base |
|---|---|---|
| Sin sesión | 401 `sin_sesion` | nada |
| Tatuaje ajeno | 404 `tatuaje_invalido` | nada |
| Historia vacía | 400 `historia_invalida` | nada |
| **Generación real** | 202 con id y saldo 0 | `consumo -1` → **lista en 153 s** → video copiado a `videos/generados/` (2.5 MB) → `tattoos.video_url` asignado |
| Sin crédito | 402 `sin_creditos` | queda una fila `fallida` (se crea antes de reservar, por diseño) |
| Proveedor rechaza (Veo deshabilitado) | 502 `proveedor` | `consumo -1` y **`reembolso +1` un segundo después** |
| Siguiente usuario | 503 `no_disponible` | el interruptor cortó antes de tocar la base; `/health` reporta suspensión de 15 min |

El fondo del video generado quedó plano ([96,199,76] en 0.5, 3 y 5.5 s).

**Datos que quedaron en la base, a propósito:** la cuenta del revisor tiene ahora un tatuaje (`15881234-…`, la huella del founder) con video, y 1 crédito (ajuste de prueba reembolsado). Le sirve al revisor de Play para ver el flujo completo.

**Pendientes que salieron de la prueba:**
- El video salió de **10.1 s** aunque el perfil pide 6 (las intros con `end_image_url` sí salieron de 5.9 s). La API no devuelve los parámetros recibidos: **revisar en el billing de Higgsfield si se cobró $0.28 o $0.47.**
- `tattoo-images/pruebas/zero-real-*.jpg` **no es una foto real**: es la ilustración de popcorn. El video salió en caricatura. El realismo sigue sin probar.
- Las variables siguen sin estar en Railway: en producción `/generar` sigue en 503.

## [2026-09-16] Con una foto real sale video realista — pero hay que quitarle el fondo antes
**Context:** Richard compartió una foto real de Zero (celular, 1074x1909, fondo de un cuarto desenfocado). Era la prueba de realismo pendiente desde el 16 sep.

**Hallazgo que cambia el pipeline:** `image-to-video` arranca DESDE la foto, así que conserva su fondo. Las pruebas anteriores salían sobre verde porque la entrada ya era una ilustración sobre verde. Con una foto real de cliente, el fondo del cuarto llegaría al video y el croma no tendría nada que recortar. **El worker necesita quitar el fondo y poner la foto sobre el verde antes de enviarla.**

**Lo que se hizo en la prueba:** recorte con Vision de macOS (`VNGenerateForegroundInstanceMaskRequest`, local y gratis), sujeto sobre `[95,196,77]`, escalado al 68% del ancho de un lienzo 768x1364 con margen (la foto cortaba orejas y patas en el borde). Generado por el worker completo, con la cuenta del revisor: lista en 151 s, 10.1 s de video.

**Resultado:** realista y reconocible como Zero (pelaje, manchas, gesto). Fondo plano ([83-90, 202-204, 66-73] en todo el video). Defectos, todos del prompt: el pan salió enorme y sin costra de concha, el perro se echa sobre él pero no llega a comérselo, y la cara se oscurece en algunos cuadros.

**Decision pendiente para producción:** Vision solo existe en macOS; el worker corre en Linux (Railway). Opciones:
- `rembg` (Python, MIT, modelo u2net ~170 MB en la imagen de Docker): gratis por uso, sube el tamaño y el arranque del contenedor.
- Un servicio externo (remove.bg y similares): simple, pero otro proveedor, otra llave y otro costo por foto.
- `@imgly/background-removal-node`: corre en Node, **pero su licencia es AGPL**, lo que obligaría a publicar el código del worker. Descartado.

**Risks/Limitations:** una foto con varios sujetos (dos perros, una persona con el perro) devuelve varias instancias; la prueba tomó todas. Hay que decidir si se toma la mayor o se pide al usuario una foto con uno solo.

## [2026-09-16] La app pasa a papel y tinta; la composición de marca solo en la carga
**Context:** Richard compartió como referencia una pieza de marca (papel, trazos de tinta en esquinas opuestas, logotipo negro, "HISTORIAS QUE SIGUEN VIVAS" espaciado, guion corto) y pidió que la pantalla de carga se viera así y que toda la app tuviera ese estilo. Al ver la primera versión pidió que los trazos grandes quedaran SOLO en la carga: dentro de la app se cortaban y pasaban por encima del texto.

**Decision:**
- **Tema claro por defecto** (`index.css`). El oscuro queda solo para el visor AR (`useTema('oscuro')` en `Scan`), por la misma razón de siempre: sobre la cámara, una interfaz clara lava el contraste.
- **`PantallaCarga`**: la composición completa. Aparece al abrir (una copia en HTML y CSS en `index.html`, para que se vea antes de que cargue el JavaScript) y durante la generación del video. Los trazos se revelan con `clip-path` como una brocha, y el guion respira como indicador.
- **Dentro de la app**, un solo trazo chico en la esquina superior del inicio, lejos del texto.
- **Primitivos en blanco y negro**: primario = bloque de tinta en mayúsculas espaciadas; secundario = contorno; tarjeta destacada = contorno completo con sombra dura. El violeta queda para el visor AR y la landing (no se tocó: es trabajo de otra sesión).
- **Splash nativo** regenerado con la misma composición en las 11 densidades, y fondo papel en el splash de Android 12+ (que solo muestra el ícono sobre un color).

**Hallazgos:**
- `tinta/03-esquina.png` trae la tinta **recortada en sus propios bordes**: usado cerca de la vista, deja un corte recto. Solo se usan 01 y 02, que están completos.
- Retirar la carga con `transitionend` falla en una pestaña en segundo plano: la transición no corre y la pantalla se quedaba encima de la app. Se retira por temporizador.
- El panel del navegador no repinta cuando la página está oculta: las capturas salían viejas y parecía que los cambios no aplicaban. La composición se diseñó fuera del navegador con ffmpeg, a 390x844.

**Alternatives considered:** llevar los dos trazos grandes a todas las pantallas (primera versión): Richard la descartó por los cortes y porque tapaban texto.

**Risks/Limitations:** el cambio de paleta fue un reemplazo sistemático sobre 14 archivos; las pantallas que solo se ven con sesión (perfil, créditos con saldo, reporte de calidad, generación en curso) no se revisaron visualmente. Llega al teléfono solo con la v4.
## [2026-09-17] Higgsfield contra Meshy para el 3D: no son alternativas
**Context:** Richard quiere probar un Zero en 3D animado y preguntó qué mensualidad conviene, Meshy o Higgsfield.

**El catálogo de Higgsfield ES Meshy, y además otros.** Consultado el catálogo de modelos 3D: `image_to_3d`, `multi_image_to_3d`, `3d_rigging`, `meshy_v6_text_to_3d`, `meshy_v7_image_to_3d`, `meshy_v5_remesh` y `meshy_v5_retexture` vienen todos con `provider_name: "Meshy"`. Encima están SAM 3 de Meta, Tripo H3.1 y Hunyuan3D de Tencent. **Pagar Meshy aparte compra un subconjunto de lo que la cuenta que ya existe puede alcanzar**, y suma una tercera cuenta a un proyecto que ya se quemó una vez por confundir dos (Higgsfield Cloud contra el plan Plus del panel).

**El riesgo real no es el proveedor, es el esqueleto.** La documentación del propio parámetro lo dice: `enable_rigging` monta un **esqueleto humanoide** y "non-bipeds (animals, objects) may rig poorly". Y la biblioteca de 678 animaciones es de bípedo — caminar, correr, saltar, saludar, bailar. Un perro auto-rigeado como humanoide y puesto a hacer `Casual_Walk` sale deforme. **Generar la malla de Zero es lo fácil; animarla es donde esto se cae.**

**El camino que evita el problema, y que ya está en el repo.** `shiba_negro.glb` es un cuadrúpedo **ya rigeado, con 5 animaciones de perro de verdad** (`sitting`, `shake`, `rollover`, `play_dead`) y `alaskan_malamute_dog.glb` trae un galope. Meshy expone `meshy_v5_retexture`, que toma un `model_url` y una imagen de estilo: **se le puede poner el pelaje de Zero a un perro que ya sabe moverse como perro**, conservando rig y clips. Cambia la pregunta de "¿podemos animar una malla nueva?" a "¿podemos vestir una malla que ya se anima?", que es mucho más barata de responder.

**Lo que esto NO resuelve, y hay que decirlo antes de invertir:** el producto que se vende hoy entrega un **video plano**, no un modelo 3D. Si la landing enseña 3D con paralaje real y el cliente recibe un plano, lo nota al primer giro de brazo — la misma deuda del dragón, en la otra dirección. Y un pipeline 3D para clientes es mucho más duro que el de video: foto → malla → rig → animación, con el rig humanoide como cuello de botella para mascotas. **El 3D es una decisión de producto, no de marketing, y no se toma la semana del lanzamiento.**

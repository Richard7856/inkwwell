# Sprint Shipaton 2026

> Documento operativo del sprint. Para el contexto general del producto ver
> `CLAUDE.md`; para el historial de decisiones técnicas, `DECISIONS.md`.

## Lanzamiento público: 17 de septiembre

**Publicada ≠ lanzada.** La v3 está en Play desde el 8 sep (requisito del
concurso, cumplido el día 2). El **lanzamiento** —anunciar y empujar— es el
**17 de septiembre**, decidido por Richard:

- Después de la **quincena del 15**, cuando la gente tiene dinero.
- **No el 15-16**: son el Grito y la Independencia. Hay dinero y tiempo libre,
  pero la atención está en otro lado.
- La **lista de espera** de la landing junta demanda antes, para que la gente
  aparte dinero. Es deliberada.
- **Los estudios se registran desde ya**: no esperan a la quincena.

Consecuencia dura: **la v4 tiene que estar publicada antes del 17.**

## Meta

Competir en el **RevenueCat Shipaton 2026** con InkAR, publicando en Google
Play y consiguiendo los primeros clientes reales.

**Fecha límite: 30 de septiembre de 2026, 11:45pm PDT.**
El sprint arrancó el 7 de septiembre → **23 días**.

## Reglas verificadas

Fuente: https://revenuecat-shipaton-2026.devpost.com/rules (consultado 7 sep 2026)

| Regla | Implicación |
|---|---|
| La app debe estar **PUBLICADA** (no solo enviada) para el 30 de septiembre | Publicar temprano, no el último día |
| SDK de RevenueCat obligatorio para al menos una compra in-app **o web** | Todo el cobro pasa por ahí |
| La primera versión pública debe salir entre el 31 jul y el 30 sep | InkAR nunca se publicó → califica |
| Actualizaciones a apps publicadas ANTES no califican | Las otras apps de Richard no estorban |
| Debe ser accesible desde Estados Unidos, con prueba gratis o código promocional | Los jueces deben poder probarla |
| El premio mayor pondera lanzamiento temprano, crecimiento post-lanzamiento y monetización | **Facturar por RevenueCat es la métrica** |

## Estado actual (7 de septiembre, noche)

> **Publicada en Play el 8 de septiembre**, día 2 del sprint. Con eso queda
> cubierto el requisito más duro del concurso (publicada, no solo enviada,
> dentro de la ventana) y se anota el criterio de lanzar temprano.
>
> **Pero la versión publicada NO puede cobrar.** Verificado abriendo el bundle
> dentro de `inkar.aab`: la llave de RevenueCat quedó **vacía** al hornearse, y
> no hay `purchasePackage` ni pantalla de compra. Como Capacitor empaqueta los
> assets (`webDir: dist`, sin `server.url`), desplegar a Vercel **no** actualiza
> la app instalada. Para que el concurso registre facturación hace falta un
> **versionCode 4** con la llave horneada y el flujo de compra dentro, y por lo
> tanto una **segunda revisión de Play**.

**Verificado funcionando, no supuesto:**
- Escaneo AR con seguimiento de imagen, varios tatuajes por sesión
- **Video 2D anclado al tatuaje real, con recorte de fondo** — probado sobre piel
- Compilación de targets en Railway (~11s)
- Login por código y **por contraseña**; ambos probados contra producción
- **Borrado de cuenta** completo, con las cuatro comprobaciones de seguridad
- **Créditos**: libro mayor, consumo con cerrojo y webhook, los tres probados
- Landing pública bilingüe en inkar.app, con lista de espera funcionando
- Identidad de marca completa: logotipo, símbolo, trazos, paleta, tipografía
- Bundle firmado `app.inkar` **subido a Play y en revisión**

**Construido el 8 sep, sin probar en teléfono:** flujo de compra (`/creditos`),
primer crédito a mitad de precio, códigos promocionales (`SHIPATON` para
jueces), alta de estudios en la landing con su código, atribución permanente
del usuario a su estudio. Migración 008 aplicada, webhook v3 desplegado.

**Marca aplicada a la app el 9 sep:** primitivos en `src/components/ui/`
(`Boton`, `Tarjeta`, `Spinner`, `Encabezado`, `Tinta`, `Logo`), logotipo en
el inicio, acento `realidad` en el botón primario, entrada a "Pruébalo sin
tatuaje" dentro de la app para los jueces.

**Perfil con liga compartible: hecho** (9 sep). Falta la fusión de `.mind`
por usuario para el perfil público `/u/:slug`, que es otra cosa.

**No existe todavía:** catálogo con video desde la base, perfil público por
usuario, versionCode 4 en Play.

## Plan por bloques

### Bloque 1 · Publicar (7–13 sep)

Meta: **app viva en Play antes del día 14**, aunque sea mínima.

| Responsable | Tarea | Estado |
|---|---|---|
| Richard | Generar y **respaldar** la llave de firma | ✅ |
| Richard | Crear la app en Play Console y subir el bundle | ✅ **PUBLICADA** (8 sep, versionCode 3) |
| Richard | Conectar el dominio inkar.app en Vercel | ✅ |
| Richard | Cuenta de servicio de Google Cloud (**~36h, SIN ARRANCAR**) | 🔴 bloquea el cobro |
| Richard | Crear productos de compra en Play Console: `creditos_primero` 12.50, `creditos_1` 25, `creditos_3`, `creditos_5` (USD) | ⬜ **bloquea la v4** |
| Richard | Conectar RevenueCat con esos productos | ⬜ |
| Claude | Icono y splash propios (hoy son los de Capacitor) | ✅ |
| Claude | **Modo "activa cualquier cosa"** para jueces sin tatuaje | 🟡 marcador y ruta /demo listos, sin promocionar hasta probarlo con cámara |
| Claude | Borrado de cuenta (lo exige Play) | ✅ desplegado y probado |
| Claude | Política de privacidad publicada | ✅ inkar.app/privacidad |
| Claude | SDK de RevenueCat en la app, llave horneada, flujo de compra | ✅ falta probar en teléfono |
| Claude | Conectar el analizador al flujo de activación | ✅ advierte antes de elegir diseño; **falta redesplegar el worker** |

### Bloque 2 · Motor de video 2D (14–21 sep)

**Giro del 7 de septiembre: el contenido pasa de 3D a video 2D.** Ver
`DECISIONS.md`. El 3D no se abandona — se mueve de producto a promesa.

| Tarea | Estado |
|---|---|
| Textura de video sobre plano anclado al target | ✅ probado sobre piel real |
| Catálogo que acepte assets de video desde la base | ⬜ **lo siguiente** |
| Generación de video desde foto + historia, vía Higgsfield | ✅ **construida el 9 sep** — worker `/generar`, sin probar con llaves reales |
| Créditos que se consumen por generación | ✅ el worker reserva con cerrojo y reembolsa si falla |
| Perfil con liga compartible (cierra el loop de crecimiento) | ⬜ |
| Actualización publicada en Play | ⬜ |

**Dos modelos 3D como "próximamente"**, no como producto. Se producen cuando
llegue la máquina nueva (~14 sep) y sirven de escaparate del motor de negocio.

**Audio:** primero el que graba el propio usuario — cero problema de derechos y
es lo que da sentido a un recuerdo. La música de biblioteca queda para después,
por el problema de licencias descrito en DECISIONS.md.

**El analizador ya corre en el flujo** (7 sep). Advierte sin bloquear y guarda
el veredicto en `tattoos`; ver `DECISIONS.md`. **No sirve de nada hasta
redesplegar el worker en Railway**: sin eso el cliente recibe métricas nulas,
las trata como "no medido" y deja pasar en silencio.

**Por qué el analizador subió a prioridad:** al probar el video sobre el tatuaje
real de la huella costó que enganchara. No era solo la luz — ese tatuaje mide
**16% de seguimiento**, contra 33% del marcador generado. Está en el extremo bajo
de lo aceptable. Si al founder le cuesta con 16%, un cliente con un tatuaje peor
pide reembolso: rechazar una foto mala antes de cobrar sale mucho más barato que
devolver el dinero después.

### Bloque 3 · Tracción (22–30 sep)

| Tarea | Estado |
|---|---|
| Onboarding para estudios de tatuaje | ⬜ |
| Amigos activando como primeros clientes | ⬜ |
| **Facturación real por RevenueCat** | ⬜ |
| Envío en Devpost + video de demostración | ⬜ |

## Riesgos

| Riesgo | Impacto | Mitigación | Estado |
|---|---|---|---|
| Los jueces no tienen tatuajes | **Crítico** — calificarían un video, no la experiencia | Modo "activa cualquier cosa": MindAR rastrea cualquier imagen, no solo piel | Resuelto en diseño |
| La API de Higgsfield no sirve o es cara | Alto | Alternativa: Veo de Gemini. Menos pulido pero desbloquea | API confirmada, falta probar |
| El video de IA deriva y no calza sobre el tatuaje | Medio | El video es del **recuerdo** (la mascota real), no del dibujo: aparece sobre la piel como portal, no lo reemplaza | Bajo tras replantear |
| Rechazo en la revisión de Play | Alto si pasa tarde | Publicar el día 14, no el 28 | ✅ aprobada el 8 sep, día 2 |
| La segunda revisión (versionCode 4, la que trae el cobro) llega tarde | **Crítico** — sin ella no hay facturación y no hay premio | La primera revisión tardó ~1 día: la cuenta de 2018 tiene revisión rápida. Aun así, entregar el 4 en cuanto exista la llave, no acumular cambios | ⬜ |
| Tatuajes que trackean mal generan reembolsos | Alto para la reputación | El analizador advierte **antes** de elegir diseño; se guarda el veredicto para calibrar | 🟡 hecho en código, pendiente redesplegar el worker |
| Límite de correos de Supabase corta el registro | Medio | SMTP propio (Resend/SendGrid) antes del lanzamiento | ⬜ |
| Perder la llave de subida | Alto | Respaldo en dos lugares distintos. Con Play App Signing es recuperable pidiéndoselo a Google, pero tarda días. **Vive en `~/inkar-release.jks`, fuera del proyecto y de git, en una sola máquina.** Ver `SETUP.md` | ⬜ |
| La v4 no queda publicada antes del lanzamiento del 17 | **Crítico** — se lanzaría la v3, sin generación ni cobro | Entregar a Play el 14-15 a más tardar; la revisión tardó ~1 día | ⬜ |

## Decisiones tomadas

**Todo el cobro pasa por RevenueCat**, sacrificando el 15-30% de comisión. El
premio mayor se mide sobre lo facturado ahí, así que cobrar por fuera no
contaría. Si no se gana, se migra a Stripe después: la pérdida está acotada al
periodo del concurso y la opción de premio es grande.

**Google Play de lleno; iOS solo si sobra tiempo.** La cuenta de Richard es de
2018 con apps publicadas y revisión directa, así que **no aplica** el requisito
de 12 testers por 14 días que sí frena a las cuentas nuevas.

**Dos motores separados** (ver `CLAUDE.md`): el de concurso es el video generado
con IA, instantáneo y cobrado in-app. El 3D personalizado se cobra fuera de la
app y no entra en la ruta crítica.

**La liga compartida abre en navegador, sin instalar nada.** Si obligara a
descargar, el loop de crecimiento muere en el primer paso.

## Pendiente de decidir

- ¿Animar el dibujo del tatuaje además del recuerdo? Ambas caben; se prueba
  cuando el motor de video esté conectado.
- ~~Precio de los créditos y cuántos entran en la prueba gratis.~~ Decidido el
  8 sep: $25 USD por crédito, primer crédito $12.50 una sola vez, prueba gratis
  solo por código promocional. Ver DECISIONS.md.
- Precio exacto de los paquetes de 3 y 5 (propuesta: 65 y 99 USD).
- Si el catálogo gratis de 3 modelos se arma con los existentes o se producen
  nuevos.

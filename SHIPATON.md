# Sprint Shipaton 2026

> Documento operativo del sprint. Para el contexto general del producto ver
> `CLAUDE.md`; para el historial de decisiones técnicas, `DECISIONS.md`.

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

## Estado actual (7 de septiembre)

**Funciona y está probado en dispositivo:**
- Escaneo AR con seguimiento de imagen, **varios tatuajes en una sesión**
- Compilación de targets en Railway (~11s por foto ya reducida)
- Supabase: base, almacenamiento, políticas por dueño
- Login con código de 6 dígitos por correo *(pendiente: ajustar plantilla en el panel — ver `AUTH-SETUP.md`)*
- 4 modelos 3D en catálogo
- APK por instalación directa + web en Vercel
- Analizador de calidad de tatuaje **construido pero sin conectar al producto**

**No existe todavía:** cobro, perfil con liga compartible, motor de video,
presencia en tienda, onboarding.

## Plan por bloques

### Bloque 1 · Publicar (7–13 sep)

Meta: **app viva en Play antes del día 14**, aunque sea mínima.

| Responsable | Tarea | Estado |
|---|---|---|
| Richard | Generar y **respaldar** la llave de firma | ⬜ |
| Richard | Crear la app en Play Console, subir primer bundle a prueba interna | ⬜ |
| Richard | Conectar el dominio inkar.app en Vercel (las URLs legales viven ahí) | ⬜ |
| Richard | Cuenta de servicio de Google Cloud para RevenueCat (**tarda ~36h**) | ⬜ |
| Richard | Crear productos de compra (créditos) en Play Console | ⬜ |
| Richard | Conectar RevenueCat con esos productos | ⬜ |
| Claude | Icono y splash propios (hoy son los de Capacitor) | ✅ |
| Claude | **Modo "activa cualquier cosa"** para jueces sin tatuaje | ⬜ |
| Claude | Borrado de cuenta (lo exige Play) | 🟡 hecho, falta desplegar |
| Claude | Política de privacidad publicada | 🟡 hecha, falta desplegar |
| Claude | SDK de RevenueCat en la app | 🟡 instalado y configurado, falta la llave |
| Claude | Conectar el analizador al flujo de activación | ⬜ |

### Bloque 2 · Motor de video (14–21 sep)

| Tarea | Estado |
|---|---|
| Integrar la API de Higgsfield (generación imagen → video) | ⬜ |
| Créditos que se consumen por generación | ⬜ |
| Video anclado al target en AR (textura de video sobre plano) | ⬜ |
| Perfil con liga compartible (cierra el loop de crecimiento) | ⬜ |
| Actualización publicada en Play | ⬜ |

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
| Rechazo en la revisión de Play | Alto si pasa tarde | Publicar el día 14, no el 28 | Mitigado por calendario |
| Tatuajes que trackean mal generan reembolsos | Alto para la reputación | Conectar el analizador y rechazar fotos malas **antes** de cobrar | ⬜ |
| Límite de correos de Supabase corta el registro | Medio | SMTP propio (Resend/SendGrid) antes del lanzamiento | ⬜ |
| Perder la llave de subida | Alto | Respaldo en dos lugares distintos. Con Play App Signing es recuperable pidiéndoselo a Google, pero tarda días | ⬜ |

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
- Precio de los créditos y cuántos entran en la prueba gratis.
- Si el catálogo gratis de 3 modelos se arma con los existentes o se producen
  nuevos.

# Ficha de Play Console — InkAR

Todo lo que hay que pegar, en el orden en que Play lo pide.
Assets listos en `brand/`. El bundle es `inkar.aab` (se regenera con `npm run aab`).

---

## Crear la app

| Campo | Valor |
|---|---|
| Nombre de la app | `InkAR` |
| Idioma predeterminado | Español (México) |
| Tipo | Aplicación |
| ¿Gratis o de pago? | **Gratis** — irreversible: una app gratis nunca puede volverse de pago |

⚠️ El nombre del paquete **`app.inkar`** lo toma del bundle al subirlo y queda
congelado para siempre.

---

## Ficha de Play Store

**Nombre** (30 caracteres máx.)
```
InkAR
```

> **Los textos viven en `brand/textos-ficha.md`**, en los dos idiomas y ya
> reescritos para la v4. Antes estaban duplicados aquí y en ese archivo, y al
> girar a video quedó una copia describiendo el producto anterior. Una sola
> fuente evita que vuelva a pasar.

**Assets**

| Qué | Archivo | Estado |
|---|---|---|
| Icono 512×512 | `brand/play-icono-512.png` | ✅ |
| Gráfico destacado 1024×500 | `brand/play-destacado-1024x500.png` | ✅ |
| Capturas de teléfono (mínimo 2) | — | ⬜ **faltan** |

La lista de qué capturar y en qué orden está en `brand/textos-ficha.md`. Solo
la primera —el video sobre el tatuaje en cámara— exige el teléfono con la app;
las de interfaz se pueden tomar del navegador del celular en inkar.app.

---

## Contenido de la app

### Política de privacidad
```
https://inkar.app/privacidad
```

### Borrado de datos
```
https://inkar.app/eliminar-cuenta
```
Marcar que la app ofrece **borrado dentro de la app Y desde la web**.

### Acceso a la app

⚠️ Punto delicado: el login es por código de 6 dígitos al correo, así que **no se
pueden entregar credenciales fijas**. Hay que explicárselo al revisor:

```
El escaneo de tatuajes no requiere cuenta: se puede probar sin iniciar sesión.

Para activar un tatuaje sí se pide identificarse. No usamos contraseñas: se
escribe cualquier dirección de correo y llega un código de 6 dígitos que se
teclea en la app. El revisor puede usar su propio correo; no hace falta una
cuenta de prueba.
```

### Anuncios
No contiene anuncios.

### Clasificación de contenido
Categoría: Utilidad / Productividad. Sin violencia, sin contenido sexual, sin
lenguaje ofensivo, sin sustancias, sin juego de apuestas.

### Público objetivo
**Solo 18 años o más.** No dirigida a menores.

### Seguridad de los datos

**Recopilados:**

| Tipo | ¿Se comparte? | ¿Obligatorio? | Propósito |
|---|---|---|---|
| Dirección de correo | No | Sí | Gestión de la cuenta |
| Fotos | **Sí** | Sí | Funcionalidad de la app |
| Historial de compras | No | Sí | Funcionalidad de la app |

**"Fotos" pasó a compartido en la v4, y hay que declararlo.** "Compartir" en Play
significa transferir a un tercero. Supabase, Railway y Vercel procesan por
encargo y no cuentan — pero **Higgsfield sí**: la foto del recuerdo y la historia
salen a su infraestructura para generar el video. Es una transferencia real y
declararla mal es declaración falsa.

Ojo con la distinción, porque no todas las fotos viajan: la del **tatuaje** solo
va a Railway (en memoria, sin guardarse) y a Supabase. La del **recuerdo** es la
que sale a Higgsfield, y solo cuando el usuario pide una generación.

**Historial de compras** se declara ahora que la app cobra créditos. En la v3 no
se declaró a propósito, porque entonces no podía cobrar.

**Prácticas de seguridad:**
- Datos cifrados en tránsito: **Sí**
- El usuario puede solicitar el borrado de sus datos: **Sí**
- Revisión de seguridad independiente: No

**Recordatorio para la próxima vez:** declarar solo lo que el código hace hoy.
En la v3 no se declaró historial de compras porque la app no podía cobrar;
declarar datos que no se recopilan también es declaración falsa.

---

## Estado de los trámites

| | |
|---|---|
| App publicada | ✅ 8 sep 2026, versionCode 3 |
| Cuenta de servicio de Google Cloud | ✅ credenciales validadas |
| Países, con Estados Unidos incluido | ✅ regla del concurso |
| Productos de créditos | ⬜ Monetizar con Play → Productos → **Productos únicos** |
| Verificación de identidad de desarrollador | ⬜ vence el **30 sep**, el mismo día que el concurso |

Los identificadores de los productos, con sus precios, están en `SHIPATON.md`.
El nombre del menú cambió: ya no es "Productos integrados".

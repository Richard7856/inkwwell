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

**Descripción corta** (80 caracteres máx.)
```
Tu tatuaje cobra vida en realidad aumentada. Apunta la cámara y míralo.
```

**Descripción completa**
```
InkAR convierte tu tatuaje en una puerta a contenido en 3D.

No es una prueba de tatuajes ni un filtro. Tu tatuaje real —el que ya traes en la
piel— queda vinculado a una experiencia en realidad aumentada. Cualquier persona
que apunte la cámara hacia él la ve aparecer, anclada a tu piel y siguiendo tu
movimiento.

CÓMO FUNCIONA

1. Tomas una foto de tu tatuaje
2. Eliges un modelo 3D del catálogo
3. Tu tatuaje queda activado

Desde ese momento, quien apunte su cámara a tu tatuaje ve tu contenido. No
necesita instalar nada: basta abrir tu liga en el navegador.

PARA QUIEN NO TIENE TATUAJE

También puedes activar cualquier imagen con suficiente detalle: un dibujo, una
carta, la portada de un cuaderno. El reconocimiento funciona igual.

QUÉ NECESITAS

Un tatuaje sanado, de al menos 4 cm, con detalle visual claro, y buena
iluminación al registrarlo. Los tatuajes muy pequeños o de trazo muy simple
pueden costar más trabajo de reconocer.

PRIVACIDAD

Las imágenes de la cámara al escanear nunca salen de tu teléfono: el
reconocimiento ocurre completo en el dispositivo. Puedes borrar tu cuenta y todos
tus datos cuando quieras, desde la app o desde inkar.app/eliminar-cuenta.
```

**Assets**

| Qué | Archivo | Estado |
|---|---|---|
| Icono 512×512 | `brand/play-icono-512.png` | ✅ |
| Gráfico destacado 1024×500 | `brand/play-destacado-1024x500.png` | ✅ |
| Capturas de teléfono (mínimo 2) | — | ⬜ **faltan** |

Las capturas conviene tomarlas del teléfono real con un tatuaje activado: es lo
que vende el producto y no se puede simular desde el navegador.

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
| Fotos | No | Sí | Funcionalidad de la app |

"Compartir" en Play significa transferir a un tercero. Supabase, Railway y Vercel
procesan por encargo, no son terceros que reciban los datos para sus fines: por
eso va **No**.

**Prácticas de seguridad:**
- Datos cifrados en tránsito: **Sí**
- El usuario puede solicitar el borrado de sus datos: **Sí**
- Revisión de seguridad independiente: No

**NO declarar todavía:** historial de compras. La app aún no puede cobrar. Se
agrega al publicar la actualización con el paywall — declarar hoy datos que no se
recopilan también es una declaración falsa.

---

## Después de subir el bundle

1. **Crear los productos de créditos** en Monetización → Productos integrados.
   Se habilita porque el bundle ya trae la librería de facturación.
2. **Cuenta de servicio de Google Cloud** para RevenueCat. **Empezar el mismo
   día: tarda hasta 36 horas en propagar permisos.**
3. Países: **incluir Estados Unidos** — regla del concurso, los jueces deben
   poder probarla.

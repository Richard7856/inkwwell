# Configurar el login por código

El login usa un **código de 6 dígitos por correo**. Requiere un ajuste en el
panel de Supabase, porque la plantilla que viene por defecto solo manda un
enlace y el usuario nunca llegaría a ver el código.

## 1. Ajustar la plantilla del correo

**Supabase → Authentication → Emails → Magic Link**

Reemplazar el cuerpo por:

```html
<h2>Tu código de acceso a Inkwell</h2>
<p>Escribe este código en la app:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:8px;font-family:monospace">
  {{ .Token }}
</p>
<p style="color:#666;font-size:13px">
  El código vence en una hora. Si no lo pediste, ignora este mensaje.
</p>
```

Lo importante es `{{ .Token }}` — esa variable es el código de 6 dígitos.
La plantilla original trae `{{ .ConfirmationURL }}`, que genera el enlace.

## 2. Verificar que el proveedor de correo esté activo

**Authentication → Providers → Email** debe estar habilitado.
"Confirm email" puede quedar activado: con OTP, verificar el código ya confirma
la dirección.

## ⚠️ Límite de envíos

El servicio de correo integrado de Supabase **está pensado solo para pruebas**:
permite unos pocos mensajes por hora. Al probar repetidamente se agota, y la app
mostrará "Demasiados intentos. Espera unos minutos".

No es un error del código. Para uso real hay que conectar un SMTP propio en
**Project Settings → Authentication → SMTP Settings** (Resend, SendGrid, Amazon
SES). Es gratis hasta volúmenes altos y quita el límite.

## 3. Probar

1. Abrir la app → "Activar mi tatuaje"
2. Escribir un correo → llega el código
3. Teclearlo → se abre la sesión y aparece el flujo de activación

La sesión queda guardada en el dispositivo: no hay que repetirlo en cada uso.

## Quién inicia sesión y quién no

**Solo quien ACTIVA un tatuaje.** Quien escanea el tatuaje de otra persona nunca
ve una pantalla de login — si la viera, no escanearía, y sin escaneos el
producto pierde lo que lo hace viral. Las políticas de la base de datos están
escritas con esa separación: lectura pública, escritura solo del dueño.

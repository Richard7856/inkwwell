# Desplegar el worker de compilación

El worker compila fotos de tatuajes a archivos `.mind` (image targets de MindAR).
El frontend lo consume vía `VITE_COMPILER_URL`.

## Por qué necesita host propio (y no Vercel)

Vercel despliega el frontend, pero el worker no cabe ahí:

- Usa `canvas`, un módulo nativo de C que necesita cairo/pango del sistema.
- La compilación tarda 10-30s y consume CPU y RAM de forma sostenida — es lo
  contrario del perfil de una función serverless.

Por eso: un contenedor de larga vida (Railway, Render, Fly, un VPS).

## Railway — pasos

1. **New Project → Deploy from GitHub repo** → elegir `Richard7856/inkwwell`.

2. **Settings → Root Directory: `worker`** ← el paso que la gente olvida.
   El repo tiene el frontend en la raíz; sin esto Railway intenta construir la
   app de Vite y falla.

3. Railway detecta el `Dockerfile` y el `railway.json` de esta carpeta. No hay
   que configurar comando de build ni de start.

4. **Settings → Networking → Generate Domain.** Eso da la URL pública fija.

   ⚠️ **Cuando pida el target port, poner `8080` — no 3001.**

   Railway inyecta `PORT=8080` en el contenedor por su cuenta. El server lo
   respeta (`process.env.PORT || 3001`), así que escucha en 8080, no en el 3001
   del Dockerfile. Si en Networking pones 3001, Railway enruta a un puerto donde
   nadie escucha y responde 502 "Application failed to respond" — aunque en los
   logs se vea el servidor arrancado perfectamente.

   Para saber en qué puerto quedó escuchando, mirar el Deploy Log:
   `🖋️  Inkwell AR Worker corriendo en http://localhost:____`
   Ese número es el que va en el target port.

5. Verificar:
   ```bash
   curl https://TU-URL.up.railway.app/health
   # → {"status":"ok","service":"inkwell-ar-worker",...}
   ```

No hacen falta variables de entorno: `PORT` la inyecta Railway y el server ya la
respeta (`process.env.PORT || 3001`).

## Después de desplegar: apuntar el frontend

La URL de Railway es fija — esto se hace UNA vez, no en cada reinicio como con ngrok.

**Local** (`inkwell-ar/.env`):
```
VITE_COMPILER_URL=https://TU-URL.up.railway.app
```

**Vercel**: Settings → Environment Variables → `VITE_COMPILER_URL` → Redeploy.

**APK**: la URL se compila DENTRO del bundle, así que hay que regenerarlo:
```bash
npm run apk
```

## Qué vigilar

- **Cold start**: si el servicio duerme por inactividad, la primera petición
  paga el arranque del contenedor además de los 10-30s de compilación.
- **CPU**: MindAR corre TensorFlow.js en CPU. En un contenedor compartido la
  compilación puede tardar bastante más que en una Mac con chip M. Si se vuelve
  intolerable, subir el plan del servicio antes que tocar el código.
- **RAM**: compilar imágenes grandes es intensivo en memoria. Si el contenedor
  muere durante `/compile`, es OOM — subir memoria o limitar la resolución de
  entrada antes de compilar.

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/health` | Healthcheck (lo usa Railway) |
| POST | `/compile` | `multipart/form-data` con campo `image` → devuelve el `.mind` binario |
| POST | `/analyze` | Igual, pero devuelve JSON con métricas de calidad de tracking |

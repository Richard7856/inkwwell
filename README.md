# Inkwell AR

Tu tatuaje cobra vida en realidad aumentada. Tomas una foto de tu tatuaje, se compila
como *image target*, y cualquiera que apunte su cámara a ese tatuaje ve un modelo 3D
animado encima.

Corre como **web** (el flujo principal) y como **APK de Android** (Capacitor).

## Los dos flujos

- **Flujo A — `/activate`** · el dueño activa su tatuaje
  foto → Supabase Storage → elegir GLB → worker compila `.mind` → registro en DB → link `/scan?tattoo=<uuid>`
- **Flujo B — `/scan?tattoo=<uuid>`** · cualquiera escanea
  resuelve `.mind` + GLB desde Supabase → MindAR trackea → Three.js renderiza

> El Flujo B **debe seguir viviendo en la web**. Pedirle a alguien que instale una app
> para ver el tatuaje de otro mata el flujo viral. El APK es para el dueño del tatuaje.

## Stack

React 19 · Vite 8 · Tailwind 4 · React Router 7 · MindAR 1.2.5 · Three.js **0.151.0 (pineado)** · Supabase · Capacitor 7

Three.js está pineado porque MindAR importa `sRGBEncoding`/`outputEncoding`, removidos en 0.152.
Ver `DECISIONS.md` — ahí está el porqué de cada decisión no obvia.

## Setup

```bash
npm install --ignore-scripts   # --ignore-scripts salta la compilación nativa de canvas
cp .env.example .env           # rellenar credenciales
npm run dev                    # https://localhost:5173 (cert self-signed)
```

HTTPS es obligatorio en dev: `getUserMedia` está bloqueado en HTTP salvo en localhost.
Chrome mostrará un warning de certificado — "Avanzado → Continuar".

### Worker de compilación `.mind`

Servicio aparte, no comparte nada con el frontend salvo el contrato HTTP.

```bash
cd worker && npm install && node index.js   # :3001
```

En macOS necesita dependencias de sistema para `canvas`:
`brew install pkg-config cairo pango libpng giflib librsvg pixman`

Para exponerlo en dev: `ngrok http 3001` y pegar la URL en `VITE_COMPILER_URL`.
En producción va con el `Dockerfile` incluido (Railway).

## Build del APK

Requisitos: JDK 21 y Android SDK (compileSdk 35, minSdk 23).

```bash
npm run cap:sync      # build web + copia al proyecto Android
npm run android:apk   # → android/app/build/outputs/apk/debug/app-debug.apk
npm run cap:open      # abrir en Android Studio
```

**`VITE_PUBLIC_URL` es obligatoria para builds del APK.** Dentro del WebView
`window.location.origin` es `https://localhost`, así que sin esa variable los links
de escaneo que genere la app apuntarán a localhost y no abrirán en ningún otro lado.

### Firma de release

Las credenciales viven en `android/keystore.properties` (gitignored). Copiar
`android/keystore.properties.example` y seguir las instrucciones de ahí para generar
el keystore. Sin ese archivo el build de release corre igual, pero produce un APK
**sin firmar** que Android no instala.

```bash
npm run android:bundle   # .aab firmado para Play Store
```

### App Links

Para que un link compartido abra la app en vez del navegador:

```bash
npm run assetlinks   # regenera public/.well-known/assetlinks.json desde el keystore
```

Android descarga `https://inkwwell.vercel.app/.well-known/assetlinks.json` y compara
esa huella con la del certificado que firmó el APK instalado. Si no coinciden, abre el
navegador **sin ningún error visible** — por eso los App Links fallan tan seguido sin
que quede claro por qué.

Dos cosas que muerden:

- El archivo solo cuenta cuando está **desplegado en producción**. En una rama sin
  mergear, la verificación sigue fallando.
- Al publicar en Play con App Signing, **Google re-firma el APK con su propia llave**.
  La huella que importa pasa a ser la de Play Console → Integridad de la app. Agrégala
  sin borrar la local: `npm run assetlinks -- --sha256 AA:BB:...`

Verificar en un dispositivo con la app instalada:

```bash
adb shell pm verify-app-links --re-verify com.inkwell.ar
adb shell pm get-app-links com.inkwell.ar   # debe decir "verified"
```

### Pendiente antes de publicar

- [ ] Regenerar el keystore localmente (el actual se creó en una sesión de Claude Code, ver `DECISIONS.md`)
- [ ] Mergear a `main` para que `assetlinks.json` quede desplegado
- [ ] Agregar la huella de Play App Signing al `assetlinks.json`
- [ ] Iconos y splash propios (ahora son los de Capacitor)

## Estructura

```
src/
  components/ARViewer/     MindAR + Three.js — el visor AR
  components/UploadFlow/   captura de foto, catálogo, estado de compilación
  lib/native.js            toda la bifurcación web/APK vive aquí
  lib/supabase.js          cliente + createTattoo
  lib/compiler.js          cliente HTTP del worker
worker/                    servicio Express que compila los .mind
supabase/migrations/       schema + RLS policies
android/                   proyecto nativo de Capacitor (commiteado, ver DECISIONS.md)
```

# InkAR

Apunta la cámara a un tatuaje y el tatuaje se mueve.

Quien se tatuó a su perro que murió sube una foto suya y una frase; de ahí sale
un video generado, anclado a su piel en realidad aumentada. El video es suyo, no
de un catálogo.

- **App**: [Google Play](https://play.google.com/store/apps/details?id=app.inkar) · **Sitio**: [inkar.app](https://www.inkar.app)

## Cómo está armado

| | |
|---|---|
| `src/` | App y landing — React + Vite, desplegado en Vercel |
| `android/` | Envoltorio Capacitor 8. Empaqueta `dist/` adentro |
| `worker/` | Express en Railway: compila los objetivos de AR, analiza calidad del tatuaje y genera el video |
| `supabase/` | Migraciones y funciones de borde (webhook de cobro, borrado de cuenta) |
| `scripts/` | Builds firmados de Android y utilidades 3D |

## Para empezar

```bash
npm install
cp .env.example .env     # y llenarlo — ver SETUP.md
npm run dev
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (HTTPS autofirmado: la cámara lo exige) |
| `npm run build` | Construye `dist/` |
| `npm run lint` | ESLint |
| `npm run apk` | APK firmado para probar en un teléfono |
| `npm run aab` | Bundle firmado para Play |

## Los documentos

| | |
|---|---|
| `CLAUDE.md` | Contexto mínimo y las trampas que ya costaron días |
| `SETUP.md` | Montar el proyecto en otra máquina |
| `PROXIMA-SESION.md` | Estado del día y decisiones abiertas |
| `LANZAMIENTO.md` | Los pasos para publicar una versión |
| `DECISIONS.md` | Por qué cada decisión, con lo que se probó |
| `SHIPATON.md` | Contexto del concurso RevenueCat Shipaton |

Los modelos 3D de perro llevan licencia CC-BY: ver `brand/3d/CREDITOS.md`.

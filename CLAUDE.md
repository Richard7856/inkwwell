# InkAR — contexto para una sesión que empieza de cero

> Si estás leyendo esto en una sesión nueva: esto es lo mínimo para no romper
> nada. El estado del día está en `PROXIMA-SESION.md`, los pasos operativos en
> `LANZAMIENTO.md`, y el porqué de cada decisión en `DECISIONS.md` — que es
> largo a propósito y se lee por búsqueda, no de corrido.

## Qué es

Una app donde la cámara del teléfono reconoce un tatuaje y le sobrepone video
anclado a la piel. El caso que vende: alguien se tatúa a su perro que murió,
apunta la cámara, y el perro se mueve.

**Lo que hace único al producto es que el video es SUYO**, generado a partir de
su foto y su historia — no un modelo 3D de un catálogo. Esa distinción decide
la copy de la landing y también el orden de las pantallas.

## Las cuatro piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| App / landing | `src/`, React + Vite | Todo lo que ve el usuario. Se despliega a Vercel |
| App nativa | `android/`, Capacitor 8 | Envuelve lo anterior. **Empaqueta `dist/` adentro** |
| Worker | `worker/`, Express en Railway | Compila los `.mind` de AR, analiza calidad, genera el video |
| Base | Supabase (`duzfvyfhsvhavptuxehi`) | Auth, tablas, Storage, funciones de borde |

## Las trampas que ya costaron días

**Capacitor empaqueta los assets.** `webDir: dist` significa que desplegar a
Vercel **no actualiza la app instalada**. Cualquier cambio que deba llegar al
teléfono exige build, `versionCode` nuevo y otra revisión de Play (≈1 día).

**Las variables `VITE_*` se hornean al compilar.** Ponerlas en Railway no sirve
para nada: el frontend lo construye Vercel. La llave de RevenueCat se horneó
vacía una vez y por eso la v3 publicada **no puede cobrar**.

**Higgsfield Cloud (la API) y el plan Plus del panel son cuentas distintas.**
Pagar la suscripción no alimenta el producto.

**El catálogo documentado de Higgsfield no es el que el plan habilita.** Antes
de cambiar `HIGGSFIELD_ENDPOINT`: `cd worker && node --env-file=.env modelos.js`.

**Antes de juzgar una imagen o un video, ábrelo.** Se describió un archivo como
"render 3D" sin mirarlo, era una ilustración plana, y eso invalidó dos rondas
de pruebas.

**Las rutas del SPA devuelven 200 aunque la página no exista.** Verificar con
navegador, nunca con `curl` a secas.

## Ramas

**Todo va a `main`, directo, sin PR.** Producción se despliega de ahí.
Richard dio permiso explícito el 17 de septiembre de 2026.

Antes de empujar: `git pull --rebase origin main`. Hay varias sesiones
trabajando en paralelo y los conflictos, cuando los hay, son siempre en los
documentos que crecen por el final (`DECISIONS.md`, `PROXIMA-SESION.md`) —
se resuelven conservando los dos lados.

**No mergees `claude/retomar-proyecto-contexto-u3o686`.** Es un intento de
agosto con historia independiente; mergearla borraría ~11.500 líneas.

## Cómo se escribe aquí

- **Todo en español**: código, comentarios, commits, documentos.
- **Los comentarios explican POR QUÉ, no qué.** El qué se lee en el código. Lo
  que no se recupera es la razón — y varias decisiones de este repo parecen
  arbitrarias hasta que se sabe qué falló antes.
- **Nombres en español** para lo del dominio (`saldo`, `reservarCredito`,
  `disponibilidad`), en inglés para lo que ya es de una biblioteca.
- **Nada de números mágicos sin una línea que diga de dónde salieron.**
- Cuando algo se probó, se dice contra qué se probó. "Verificado" sin decir
  cómo no vale.

## Antes de dar algo por cierto

Los documentos de este repo se escriben rápido y envejecen en horas. El estado
real se mide, no se lee:

```bash
curl -s https://inkwwell-production.up.railway.app/health   # worker y generación
grep -n versionCode android/app/build.gradle                # qué versión existe
```

Y para la base, las herramientas de Supabase — no lo que diga un documento.

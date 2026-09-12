# Montar InkAR en otra máquina

> Escrito el 12 sep 2026. La regla que ordena todo este documento:
> **el código viaja con `git clone`; los secretos y la llave de firma NO.**
> Esos se mueven a mano, por un canal seguro, y nunca por git, correo ni chat.

---

## Qué viaja solo y qué no

| Viaja con `git clone` | Hay que moverlo a mano |
|---|---|
| Todo el código de la app y del worker | `inkwell-ar/.env` |
| Migraciones, marca, documentación | `inkwell-ar/worker/.env` |
| `DECISIONS.md`, `SHIPATON.md`, `PROXIMA-SESION.md` | `inkwell-ar/android/keystore.properties` |
| | **`~/inkar-release.jks`** — la llave de firma, FUERA del proyecto |
| | `CLAUDE.md`, `AGENTS.md` y `.claude/` — están en la carpeta **padre**, fuera del repo |
| | La memoria de Claude (`~/.claude/projects/…/memory/`) |

Lo de la derecha está en `.gitignore` a propósito, o vive fuera del repo.

---

## ⚠️ Antes de nada: la llave de firma

`android/keystore.properties` apunta a **`/Users/richardfigueroa/inkar-release.jks`**:
fuera del proyecto, en la carpeta de usuario. Hoy **existe en una sola máquina.**

Si esa laptop se pierde o se daña, no puedes firmar actualizaciones. Con Play
App Signing es recuperable —Google puede reiniciar la llave de subida— pero
**tarda días**, y en plena semana del concurso eso es fatal.

**Mudarte de laptop es el momento de arreglarlo:** cuando copies el `.jks`,
guárdalo también en tu gestor de contraseñas (1Password, Bitwarden: nota segura
con archivo adjunto), junto con las contraseñas de `keystore.properties`. Así
queda en dos lugares, que es lo que pide el riesgo abierto en `SHIPATON.md`.

---

## Paso a paso

### 1. Herramientas

- **Node 22** (se desarrolló con v22.19)
- **Git**
- **Android Studio** — no por el editor: trae el **JDK 21** (JBR) que exige
  Capacitor 8 y el SDK de Android. `scripts/build-apk.sh` los encuentra solos.
- Opcional: `ffmpeg` (para revisar videos)

### 2. Clonar en la MISMA ruta

```bash
mkdir -p ~/Downloads/Tatuajes && cd ~/Downloads/Tatuajes
git clone https://github.com/Richard7856/inkwwell.git inkwell-ar
```

**Por qué la misma ruta:** la memoria de Claude se guarda en una carpeta cuyo
nombre sale de la ruta absoluta del proyecto
(`~/.claude/projects/-Users-richardfigueroa-Downloads-Tatuajes/`). Si tu usuario
en la otra Mac también es `richardfigueroa` y clonas aquí, la memoria copiada
funciona tal cual. En otra ruta, Claude no la encuentra.

### 3. Mover los secretos, por AirDrop

Entre dos Macs, **AirDrop** es lo más simple que no deja copias en ningún
servidor. Mueve estos cinco:

| Archivo | Destino en la laptop nueva |
|---|---|
| `inkwell-ar/.env` | igual |
| `inkwell-ar/worker/.env` | igual |
| `inkwell-ar/android/keystore.properties` | igual |
| `~/inkar-release.jks` | `~/inkar-release.jks` |
| `Tatuajes/CLAUDE.md`, `Tatuajes/AGENTS.md`, `Tatuajes/.claude/` | la carpeta padre `~/Downloads/Tatuajes/` |

Si tu usuario es **distinto**, edita `storeFile=` en `keystore.properties`: la
ruta es absoluta.

**No** subas nada de esto a git, ni lo mandes por correo o chat, ni lo pegues en
una conversación con Claude.

### 4. La memoria de Claude (opcional pero útil)

```bash
mkdir -p ~/.claude/projects/-Users-richardfigueroa-Downloads-Tatuajes
```

Copia ahí la carpeta `memory/` completa. Lo esencial también está en
`DECISIONS.md` y `PROXIMA-SESION.md`, así que sin la memoria no se pierde nada
crítico — solo contexto.

### 5. Dependencias

```bash
cd ~/Downloads/Tatuajes/inkwell-ar && npm install
```

```bash
cd ~/Downloads/Tatuajes/inkwell-ar/worker && npm install
```

---

## Verificar que quedó bien

Cada uno comprueba una pieza distinta. Si los cuatro pasan, estás igual que en
la laptop anterior.

**El frontend compila:**

```bash
cd ~/Downloads/Tatuajes/inkwell-ar && npm run build
```

**Las llaves de Higgsfield son válidas** (sin gastar — ver `worker/modelos.js`):

```bash
cd ~/Downloads/Tatuajes/inkwell-ar/worker && node --env-file=.env modelos.js
```

**El APK compila** (valida JDK 21 y SDK):

```bash
cd ~/Downloads/Tatuajes/inkwell-ar && npm run apk
```

**La llave de firma se lee** (valida `.jks` y `keystore.properties`; genera el
AAB firmado que va a Play):

```bash
cd ~/Downloads/Tatuajes/inkwell-ar && npm run aab
```

---

## Retomar con Claude

Abre una sesión nueva en `~/Downloads/Tatuajes` (la carpeta **padre**, para que
lea `CLAUDE.md`) y pídele que lea `inkwell-ar/PROXIMA-SESION.md`. Ese archivo
existe justo para esto: una conversación no viaja entre máquinas, los documentos
sí.

**Lo que no sirve para este proyecto:** una sesión en la nube (claude.ai/code)
contra el repo de GitHub. Puede editar código, pero no tiene `.env` ni la llave
de firma, así que no puede probar el worker ni compilar el AAB.

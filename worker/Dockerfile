# Worker de compilación .mind — imagen para Railway / cualquier host con Docker.
#
# ── Por qué build en dos etapas ──
# El package `canvas` (dependencia transitiva de mind-ar) es un módulo nativo.
# Normalmente npm baja un binario precompilado, pero si no hay uno para esta
# combinación de arquitectura + versión de Node, cae a compilar desde fuente y
# necesita un toolchain de C completo.
#
# Una sola etapa obliga a elegir: o instalas el toolchain (imagen enorme, ~1GB)
# o apuestas a que el precompilado exista (si no existe, el build truena).
# Con dos etapas no hay que elegir: la etapa `builder` tiene el toolchain
# completo — así funciona en cualquier caso — y a la imagen final solo se copia
# el node_modules ya resuelto, sin compiladores.
#
# ── Por qué Debian slim y no Alpine ──
# Alpine usa musl, donde los precompilados de canvas no aplican nunca y hay
# incompatibilidades conocidas. Debian usa glibc: camino soportado y estable.

# ─────────────────── Etapa 1: dependencias ───────────────────
FROM node:20-slim AS builder

# Toolchain + headers. Solo se usan si canvas tiene que compilar desde fuente;
# si baja el precompilado, quedan sin usar y de todas formas no llegan a la
# imagen final porque esta etapa se descarta.
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      python3 \
      pkg-config \
      libcairo2-dev \
      libpango1.0-dev \
      libjpeg-dev \
      libgif-dev \
      librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
# npm ci (no npm install): instala exactamente lo del package-lock.json.
# Deploys reproducibles — nadie se lleva una sorpresa por una versión nueva.
RUN npm ci --omit=dev

# ─────────────────── Etapa 2: runtime ───────────────────
FROM node:20-slim

# Solo las librerías compartidas (.so) contra las que enlaza el binario de canvas.
# Sin ellas el módulo instala bien pero truena al hacer require() en runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libcairo2 \
      libpango-1.0-0 \
      libpangocairo-1.0-0 \
      libjpeg62-turbo \
      libgif7 \
      librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# node_modules ya resuelto en la etapa anterior — sin compiladores en la imagen final
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# No correr como root: si alguien logra ejecución remota vía la subida de imágenes,
# queda con permisos de un usuario sin privilegios. La imagen de node ya trae
# el usuario `node`.
USER node

# Informativo. Railway inyecta PORT y el server lo respeta (process.env.PORT).
EXPOSE 3001

CMD ["node", "index.js"]

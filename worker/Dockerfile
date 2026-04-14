# Worker de compilación .mind — para deploy en Railway
#
# ¿Por qué Alpine y no la imagen base de Node?
# Alpine es ~5x más pequeño. El problema: el package `canvas` (dependencia de mind-ar)
# necesita compilarse desde fuente en Alpine porque no hay binarios precompilados.
# Las libs de sistema (cairo, pango, etc.) son las que canvas necesita para operar.

FROM node:20-alpine

# Dependencias de sistema requeridas por node-canvas para compilar desde fuente
# cairo: rendering 2D, jpeg-dev: decode JPGs, pango: texto (necesario aunque no usemos texto),
# giflib: GIFs, pixman: composición de pixeles, build-base: compilador C (make, gcc)
RUN apk add --no-cache \
  cairo-dev \
  jpeg-dev \
  pango-dev \
  giflib-dev \
  pixman-dev \
  build-base \
  python3

WORKDIR /app

# Instalar dependencias primero (layer cacheado si package.json no cambia)
COPY package*.json ./
RUN npm install

# Copiar código fuente
COPY . .

EXPOSE 3001

# Railway inyecta PORT como variable de entorno
CMD ["node", "index.js"]

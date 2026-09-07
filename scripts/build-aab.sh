#!/usr/bin/env bash
# Genera el Android App Bundle (.aab) firmado para subir a Google Play.
#
# POR QUÉ AAB Y NO APK:
# Google Play exige App Bundle para apps nuevas desde agosto de 2021. Además, el
# APK que genera build-apk.sh está firmado con la llave de depuración y la tienda
# lo rechaza.
#
# PRIMERA VEZ — crear la llave de firma:
#
#   keytool -genkey -v -keystore ~/inkwell-release.jks \
#     -keyalg RSA -keysize 2048 -validity 10000 -alias inkwell
#
#   Después crear android/keystore.properties con:
#     storeFile=/Users/TU_USUARIO/inkwell-release.jks
#     storePassword=...
#     keyAlias=inkwell
#     keyPassword=...
#
# ⚠️ RESPALDA LA LLAVE EN MÁS DE UN LUGAR.
# Si se pierde, no se puede volver a actualizar la app jamás: hay que publicarla
# de cero con otro identificador, perdiendo instalaciones y reseñas.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Capacitor 8 exige JDK 21; el default del sistema suele ser 17 y el error de
# Gradle es críptico ("invalid source release: 21")
JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
if [ -d "$JBR" ]; then
  export JAVA_HOME="$JBR"
elif /usr/libexec/java_home -v 21 >/dev/null 2>&1; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
else
  echo "ERROR: falta un JDK 21 (viene con Android Studio, o brew install openjdk@21)"
  exit 1
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

if [ ! -f "android/keystore.properties" ]; then
  echo "ERROR: falta android/keystore.properties — el bundle saldría sin firmar"
  echo "       y Play lo rechazaría. Ver las instrucciones al inicio de este script."
  exit 1
fi

echo "[1/3] Build del frontend..."
npm run build

echo ""
echo "[2/3] Sincronizando con el proyecto Android..."
npx cap sync android

echo ""
echo "[3/3] Generando el bundle firmado..."
cd android
./gradlew bundleRelease
cd "$PROJECT_ROOT"

AAB="android/app/build/outputs/bundle/release/app-release.aab"
OUT="inkwell-ar.aab"
cp "$AAB" "$OUT"

echo ""
echo "✓ Bundle listo: $PROJECT_ROOT/$OUT ($(du -h "$OUT" | cut -f1))"
echo ""
echo "  Súbelo en Play Console → Producción (o Prueba interna) → Crear versión."
echo "  Recuerda subir versionCode en android/app/build.gradle en cada entrega:"
echo "  Play rechaza dos versiones con el mismo número."

#!/usr/bin/env bash
# Genera el APK de debug de Inkwell AR para instalar en Android.
#
# POR QUÉ ESTE SCRIPT EXISTE:
# Capacitor 8 exige JDK 21 para compilar. Muchas Macs tienen JDK 17 como default
# (Temurin, Homebrew), y el error de Gradle es críptico: "invalid source release: 21".
# Android Studio trae su propio JDK 21 empaquetado (JBR), así que lo detectamos
# y lo usamos sin obligar a instalar otro JDK ni cambiar el default del sistema.
#
# Uso:
#   ./scripts/build-apk.sh            # compila
#   ./scripts/build-apk.sh --install  # compila e instala en el device conectado

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Detectar un JDK 21 ──
JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
if [ -d "$JBR" ]; then
  export JAVA_HOME="$JBR"
elif /usr/libexec/java_home -v 21 >/dev/null 2>&1; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
else
  echo "ERROR: no se encontró un JDK 21."
  echo "  Opción A: instalar Android Studio (trae JDK 21 propio)"
  echo "  Opción B: brew install openjdk@21"
  exit 1
fi
echo "JDK: $($JAVA_HOME/bin/java -version 2>&1 | head -1)"

# Gradle necesita saber dónde está el SDK de Android
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

echo ""
echo "[1/3] Build del frontend (Vite)..."
npm run build

echo ""
echo "[2/3] Sincronizando assets web al proyecto Android..."
npx cap sync android

echo ""
echo "[3/3] Compilando APK..."
cd android
./gradlew assembleDebug
cd "$PROJECT_ROOT"

APK="android/app/build/outputs/apk/debug/app-debug.apk"
OUT="inkwell-ar.apk"
cp "$APK" "$OUT"

echo ""
echo "✓ APK listo: $PROJECT_ROOT/$OUT ($(du -h "$OUT" | cut -f1))"

if [ "${1:-}" = "--install" ]; then
  if adb devices | grep -q "device$"; then
    echo ""
    echo "Instalando en el device conectado..."
    # -r reinstala conservando datos; -d permite downgrade de versionCode
    adb install -r -d "$OUT"
    echo "✓ Instalado. Busca 'Inkwell AR' en el cajón de apps."
  else
    echo ""
    echo "No hay device conectado por adb."
    echo "Conecta el cel con Depuración USB activada y corre: adb install -r $OUT"
  fi
fi

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { execSync } from 'node:child_process'

/*
  Identificador de build inyectado en el bundle.

  Por qué: el APK se distribuye a mano y se han mandado varias versiones. Sin un
  identificador visible es imposible saber si el dispositivo corre el build nuevo
  o uno viejo, y se pierde tiempo depurando bugs que ya estaban corregidos.

  El try/catch cubre builds fuera de un repo git (CI con tarball, por ejemplo):
  ahí se pierde el sha pero el build no debe fallar por eso.
*/
function getBuildId() {
  let sha = 'nogit'
  try {
    sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim()
  } catch {
    // sin git disponible — se conserva el placeholder
  }
  const stamp = new Date().toISOString().slice(5, 16).replace('T', ' ')
  return `${sha} · ${stamp}`
}

// HTTPS required — getUserMedia (camera access) blocked on HTTP in all browsers
export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(getBuildId()),
  },
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
  ],
  server: {
    https: true,
    // El proyecto Android copia el bundle web dentro de android/app/... — sin
    // esta exclusión el watcher reacciona a cada build de Gradle
    watch: { ignored: ['**/android/**'] },
  },
  optimizeDeps: {
    /*
      Limitar el escaneo de dependencias a index.html.
      Capacitor copia el bundle (con su propio index.html) dentro de android/,
      y Gradle genera reportes HTML ahí también. Sin esto, Vite los toma como
      entrypoints adicionales y falla el pre-bundling.
    */
    entries: ['index.html'],
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// HTTPS required — getUserMedia (camera access) blocked on HTTP in all browsers
export default defineConfig({
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

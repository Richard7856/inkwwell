import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    // Proyecto nativo de Capacitor. Contiene una copia del build web en
    // app/src/main/assets/public/ — lintear bundles minificados genera miles
    // de errores falsos y hace inservible `npm run lint`.
    'android',
    'ios',
    // Decoder de Draco de terceros (copiado de three/examples). Código
    // generado por Emscripten, no lo mantenemos nosotros.
    'public/draco',
  ]),
  {
    // El worker corre en Node, no en el browser: usa process, Buffer, etc.
    // Sin este bloque esos globals se reportan como no-undef.
    files: ['worker/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])

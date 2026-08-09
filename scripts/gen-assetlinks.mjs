#!/usr/bin/env node
/**
 * Genera public/.well-known/assetlinks.json con la huella SHA-256 del keystore.
 *
 * Ese archivo es lo que hace que Android verifique los App Links: cuando el
 * usuario toca un link de inkwwell.vercel.app, Android descarga
 * https://inkwwell.vercel.app/.well-known/assetlinks.json y compara la huella
 * de ahí con la del certificado que firmó el APK instalado. Si coinciden, abre
 * la app; si no, abre el navegador — SIN ningún error visible. Por eso los App
 * Links "no funcionan" tan seguido: falla en silencio.
 *
 * Uso:
 *   npm run assetlinks                      # lee android/keystore.properties
 *   npm run assetlinks -- --debug           # usa el debug keystore (~/.android/debug.keystore)
 *   npm run assetlinks -- --sha256 AA:BB:.. # agrega una huella a mano
 *
 * La opción --sha256 existe para Play App Signing: cuando publicas en Play,
 * Google RE-FIRMA el APK con SU propia llave, así que la huella que importa NO
 * es la de tu keystore local sino la que aparece en
 * Play Console → Integridad de la app → Firma de apps. Tu llave local pasa a
 * ser solo la de SUBIDA. El archivo acepta varias huellas a la vez, así que
 * conviene tener las dos: la local (para APKs sideloaded) y la de Google
 * (para lo que instala la gente desde Play).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', '.well-known', 'assetlinks.json')

// Debe coincidir con applicationId en android/app/build.gradle
const PACKAGE_NAME = 'com.inkwell.ar'

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? null : (args[i + 1] ?? true)
}

/** Corre keytool y extrae la línea "SHA256: AA:BB:..." */
function fingerprintFrom({ storeFile, storePassword, keyAlias }) {
  const out = execFileSync('keytool', [
    '-list', '-v',
    '-keystore', storeFile,
    '-alias', keyAlias,
    '-storepass', storePassword,
  ], { encoding: 'utf8' })

  const match = out.match(/SHA256:\s*([A-F0-9:]{95})/i)
  if (!match) throw new Error('keytool no devolvió una huella SHA-256 reconocible')
  return match[1].toUpperCase()
}

function resolveSource() {
  const manual = flag('sha256')
  if (typeof manual === 'string') return { fingerprint: manual.toUpperCase(), origin: '--sha256' }

  if (flag('debug') !== null) {
    return {
      fingerprint: fingerprintFrom({
        // Contraseña y alias fijos del debug keystore de Android — son públicos por diseño
        storeFile: join(homedir(), '.android', 'debug.keystore'),
        storePassword: 'android',
        keyAlias: 'androiddebugkey',
      }),
      origin: 'debug.keystore',
    }
  }

  const propsPath = join(ROOT, 'android', 'keystore.properties')
  if (!existsSync(propsPath)) {
    console.error(
      'No existe android/keystore.properties.\n' +
      'Copia android/keystore.properties.example, genera el keystore y vuelve a correr esto.\n' +
      'O usa: npm run assetlinks -- --debug   (para probar con builds debug)'
    )
    process.exit(1)
  }

  const props = Object.fromEntries(
    readFileSync(propsPath, 'utf8')
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      })
  )

  return {
    fingerprint: fingerprintFrom({
      storeFile: join(ROOT, 'android', props.storeFile),
      storePassword: props.storePassword,
      keyAlias: props.keyAlias,
    }),
    origin: props.storeFile,
  }
}

const { fingerprint, origin } = resolveSource()

/*
  Merge en vez de sobrescribir: el archivo acumula huellas.
  Un APK sideloaded (firmado local) y uno instalado desde Play (re-firmado por
  Google) tienen huellas distintas y ambas deben estar aquí, o los App Links
  funcionan en un caso y en el otro no.
*/
let fingerprints = []
if (existsSync(OUT)) {
  try {
    const existing = JSON.parse(readFileSync(OUT, 'utf8'))
    fingerprints = existing[0]?.target?.sha256_cert_fingerprints ?? []
  } catch {
    console.warn('assetlinks.json existente ilegible — se regenera desde cero')
  }
}

if (fingerprints.includes(fingerprint)) {
  console.log(`La huella de ${origin} ya estaba registrada. Sin cambios.`)
} else {
  fingerprints.push(fingerprint)
}

const payload = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: PACKAGE_NAME,
      sha256_cert_fingerprints: fingerprints,
    },
  },
]

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n')

console.log(`✓ ${OUT.replace(ROOT + '/', '')}`)
console.log(`  package:  ${PACKAGE_NAME}`)
console.log(`  huellas:  ${fingerprints.length}`)
fingerprints.forEach((f) => console.log(`    ${f === fingerprint ? '→' : ' '} ${f.slice(0, 32)}…`))
console.log('\nEl archivo se sirve solo cuando la web se despliega. Verificar con:')
console.log('  curl https://inkwwell.vercel.app/.well-known/assetlinks.json')

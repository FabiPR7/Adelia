import { build } from 'esbuild'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const functionsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = path.join(functionsDir, '..')
const sourceDir = path.join(projectRoot, 'server')
const targetDir = path.join(functionsDir, 'server')
const libDir = path.join(functionsDir, 'lib')

function loadRootEnv() {
  const envPath = path.join(projectRoot, '.env')
  if (!existsSync(envPath)) {
    return
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match || process.env[match[1]]) {
      continue
    }
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

loadRootEnv()

const publicEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_DATABASE_ID',
  'APP_URL',
]

const define = Object.fromEntries(
  publicEnvKeys
    .filter((key) => process.env[key])
    .map((key) => [`process.env.${key}`, JSON.stringify(process.env[key])]),
)

if (!process.env.VITE_FIREBASE_API_KEY) {
  throw new Error('Falta VITE_FIREBASE_API_KEY en .env para construir las functions.')
}

rmSync(targetDir, { recursive: true, force: true })
cpSync(sourceDir, targetDir, {
  recursive: true,
  filter: (src) => !src.includes('node_modules'),
})

mkdirSync(libDir, { recursive: true })

cpSync(
  path.join(projectRoot, 'public', 'adelia-logo-email.png'),
  path.join(libDir, 'adelia-logo-email.png'),
)

const external = [
  'firebase-admin',
  'firebase-admin/app',
  'firebase-admin/auth',
  'firebase-admin/firestore',
  'firebase-functions',
  'firebase-functions/v2/https',
  'firebase-functions/v2/firestore',
  'firebase-functions/v2/scheduler',
  'firebase-functions/params',
  'express',
  'cors',
  'resend',
  'stripe',
  'dotenv',
  'dotenv/config',
]

await build({
  entryPoints: [path.join(functionsDir, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: path.join(libDir, 'index.js'),
  define,
  external,
  logLevel: 'info',
})

console.log('Functions bundle listo')

import { build } from 'esbuild'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const functionsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = path.join(functionsDir, '..')
const sourceDir = path.join(projectRoot, 'server')
const targetDir = path.join(functionsDir, 'server')
const libDir = path.join(functionsDir, 'lib')

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
  entryPoints: [
    path.join(functionsDir, 'src', 'api.ts'),
    path.join(functionsDir, 'src', 'triggers.ts'),
  ],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: libDir,
  external,
  logLevel: 'info',
})

writeFileSync(
  path.join(libDir, 'index.js'),
  `export { api } from './api.js'\nexport {
  onReservationCreatedSendEmail,
  onReservationUpdatedSendEmail,
  onReservationUpdatedNotifications,
  onUserGamificationUpdatedNotifications,
  processScheduledNotifications,
} from './triggers.js'\n`,
  'utf8',
)

console.log('Functions bundle listo')

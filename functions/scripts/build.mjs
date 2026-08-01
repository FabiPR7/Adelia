import { build } from 'esbuild'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
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

await build({
  entryPoints: [path.join(functionsDir, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: path.join(libDir, 'index.js'),
  external: [
    'firebase-admin',
    'firebase-admin/app',
    'firebase-admin/auth',
    'firebase-admin/firestore',
    'firebase-functions',
    'firebase-functions/v2/https',
    'firebase-functions/v2/firestore',
    'firebase-functions/params',
    'express',
    'cors',
  ],
  logLevel: 'info',
})

console.log('Functions bundle listo')

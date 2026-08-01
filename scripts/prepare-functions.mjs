import { cpSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = path.join(projectRoot, 'server')
const targetDir = path.join(projectRoot, 'functions', 'server')

rmSync(targetDir, { recursive: true, force: true })
cpSync(sourceDir, targetDir, {
  recursive: true,
  filter: (src) => !src.includes('node_modules'),
})

console.log('Server copiado a functions/server')

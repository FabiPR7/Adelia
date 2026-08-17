/**
 * Convierte PNG de cartas de nivel y tiras a WebP (sin borrar el original).
 *   node scripts/optimize-level-assets.mjs
 */
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TARGETS = [
  path.join(ROOT, 'src', 'assets', 'levels'),
  path.join(ROOT, 'src', 'assets', 'levels name'),
]

async function convertTree(dir) {
  let converted = 0
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      converted += await convertTree(fullPath)
      continue
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.png')) {
      continue
    }

    const outputPath = fullPath.replace(/\.png$/i, '.webp')
    try {
      const current = await stat(outputPath).catch(() => null)
      const source = await stat(fullPath)
      if (current && current.mtimeMs >= source.mtimeMs) {
        continue
      }
    } catch {
      // create
    }

    await sharp(fullPath)
      .webp({ quality: 78, alphaQuality: 88, effort: 4 })
      .toFile(outputPath)
    converted += 1
    console.log(`✓ ${path.relative(ROOT, outputPath)}`)
  }

  return converted
}

let total = 0
for (const dir of TARGETS) {
  total += await convertTree(dir)
}
console.log(`\nWebP generados/actualizados: ${total}`)

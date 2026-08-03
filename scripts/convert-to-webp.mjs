import { readdir, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')

async function convertDirectory(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  let converted = 0

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.png')) {
      continue
    }

    const inputPath = path.join(dir, entry.name)
    const outputPath = inputPath.replace(/\.png$/i, '.webp')

    await sharp(inputPath)
      .webp({ quality: 85, alphaQuality: 90, effort: 4 })
      .toFile(outputPath)

    await unlink(inputPath)
    converted += 1
    console.log(`✓ ${path.relative(ROOT, inputPath)} → ${path.basename(outputPath)}`)
  }

  return converted
}

async function optimizePngForEmail(inputPath, outputPath, maxWidth = 256) {
  await sharp(inputPath)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toFile(outputPath)
}

async function convertAdeliaLogo() {
  const logoPng = path.join(ROOT, 'public', 'adelia-logo.png')
  const logoWebp = path.join(ROOT, 'public', 'adelia-logo.webp')
  const logoPngEmail = path.join(ROOT, 'public', 'adelia-logo-email.png')
  const logoPngTemp = path.join(ROOT, 'public', 'adelia-logo-temp.png')

  await sharp(logoPng)
    .resize({ width: 512, withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 90 })
    .toFile(logoWebp)

  await optimizePngForEmail(logoPng, logoPngEmail, 256)
  await optimizePngForEmail(logoPng, logoPngTemp, 512)
  await unlink(logoPng)
  await rename(logoPngTemp, logoPng)

  console.log('✓ public/adelia-logo.webp created')
  console.log('✓ public/adelia-logo.png optimized (max 512px, PNG fallback)')
  console.log('✓ public/adelia-logo-email.png created (for emails)')
}

const assetCount = await convertDirectory(path.join(ROOT, 'src', 'assets'))
await convertAdeliaLogo()

console.log(`\nDone: ${assetCount} floor-plan assets converted to WebP.`)

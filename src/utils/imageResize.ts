/**
 * Prepara fotos en el navegador antes de subirlas: las del móvil (4000×3000 o
 * más, 5–12 MB) se reducen aquí en vez de rechazarlas.
 */

/** Lado mayor de las fotos que se suben (de sobra para pantallas retina). */
export const UPLOAD_MAX_SIDE = 2560

export interface LoadedImage {
  element: HTMLImageElement
  width: number
  height: number
  url: string
}

export async function loadImageFile(file: Blob): Promise<LoadedImage> {
  const url = URL.createObjectURL(file)
  const element = new Image()
  element.decoding = 'async'
  element.src = url
  try {
    await element.decode()
  } catch {
    URL.revokeObjectURL(url)
    throw new Error('No se pudo abrir la imagen. Prueba con otra foto (JPG, PNG o WEBP).')
  }
  return { element, width: element.naturalWidth, height: element.naturalHeight, url }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Tamaño de salida que cabe en `maxSide` sin deformar. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/**
 * Dibuja un trozo de la imagen (sx, sy, sw, sh) a outWidth×outHeight y lo
 * devuelve como archivo. PNG se queda en PNG (logos con transparencia).
 */
export async function renderImageRegion(
  image: LoadedImage,
  region: { sx: number; sy: number; sw: number; sh: number },
  outWidth: number,
  outHeight: number,
  sourceType: string,
  name: string,
): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = outHeight
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Tu navegador no permite preparar la imagen.')
  }
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  const keepAlpha = sourceType === 'image/png' || sourceType === 'image/webp'
  if (!keepAlpha) {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, outWidth, outHeight)
  }
  context.drawImage(image.element, region.sx, region.sy, region.sw, region.sh, 0, 0, outWidth, outHeight)

  const type = keepAlpha ? 'image/png' : 'image/jpeg'
  let blob = await canvasToBlob(canvas, type, 0.88)
  // Un PNG grande puede pasar de 5 MB: en WEBP mantiene la transparencia y pesa mucho menos.
  if (blob && keepAlpha && blob.size > 4 * 1024 * 1024) {
    blob = (await canvasToBlob(canvas, 'image/webp', 0.9)) ?? blob
  }
  if (!blob) {
    throw new Error('No se pudo preparar la imagen.')
  }
  const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
  const baseName = name.replace(/\.[^.]+$/, '') || 'foto'
  return new File([blob], `${baseName}.${extension}`, { type: blob.type })
}

/**
 * Abre la foto ya reducida a `maxSide` para editarla (recortar, zoom). Una foto
 * de móvil a tamaño completo (12–50 MP) agota la memoria del navegador del
 * móvil y cierra la página al moverla; con 1600 px sobra para un recorte de 1024.
 */
export async function loadImageForEditing(file: File, maxSide = 1600): Promise<LoadedImage> {
  const original = await loadImageFile(file)
  if (Math.max(original.width, original.height) <= maxSide) {
    return original
  }
  try {
    const size = fitWithin(original.width, original.height, maxSide)
    const reduced = await renderImageRegion(
      original,
      { sx: 0, sy: 0, sw: original.width, sh: original.height },
      size.width,
      size.height,
      file.type,
      file.name,
    )
    return await loadImageFile(reduced)
  } finally {
    // Suelta la foto grande cuanto antes.
    original.element.src = ''
    URL.revokeObjectURL(original.url)
  }
}

/** Reduce una foto a `maxSide` como mucho. Si ya es pequeña y ligera, la deja igual. */
export async function downscaleImageFile(file: File, maxSide = UPLOAD_MAX_SIDE, maxBytes = 4.5 * 1024 * 1024): Promise<File> {
  const image = await loadImageFile(file)
  try {
    if (Math.max(image.width, image.height) <= maxSide && file.size <= maxBytes) {
      return file
    }
    const size = fitWithin(image.width, image.height, maxSide)
    return await renderImageRegion(
      image,
      { sx: 0, sy: 0, sw: image.width, sh: image.height },
      size.width,
      size.height,
      file.type,
      file.name,
    )
  } finally {
    URL.revokeObjectURL(image.url)
  }
}

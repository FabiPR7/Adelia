/**
 * Constantes de seguridad para file uploads
 */

// Tamaño máximo de archivo: 5MB
export const MAX_FILE_SIZE = 5 * 1024 * 1024

// Dimensiones máximas de imagen
export const MAX_IMAGE_WIDTH = 4000
export const MAX_IMAGE_HEIGHT = 4000

// Tipos MIME permitidos (whitelist estricta)
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const

// Extensiones permitidas (backup validation)
export const ALLOWED_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
] as const

/**
 * Valida si un tipo MIME está permitido
 */
export function isAllowedImageType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(mimeType as typeof ALLOWED_IMAGE_TYPES[number])
}

/**
 * Valida si una extensión está permitida
 */
export function isAllowedImageExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return ALLOWED_IMAGE_EXTENSIONS.includes(ext as typeof ALLOWED_IMAGE_EXTENSIONS[number])
}

export const MAX_PDF_FILE_SIZE = 10 * 1024 * 1024

export const ALLOWED_PDF_TYPES = ['application/pdf', 'application/x-pdf'] as const

export function isAllowedPdfExtension(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf')
}

export function isAllowedPdfFile(file: Pick<File, 'name' | 'type'>): boolean {
  if (!isAllowedPdfExtension(file.name)) {
    return false
  }

  return !file.type || ALLOWED_PDF_TYPES.includes(file.type as (typeof ALLOWED_PDF_TYPES)[number])
}

export function isValidPdfFileSize(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_PDF_FILE_SIZE
}

/**
 * Valida tamaño de archivo
 */
export function isValidFileSize(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_FILE_SIZE
}

/**
 * Formatea tamaño para mensajes de error
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Clip de perfil: 30 s evita películas y mantiene la subida estable. */
export const MAX_VIDEO_DURATION_SECONDS = 30

/** Tamaño máximo del archivo que se sube (ya comprimido). */
export const MAX_VIDEO_FILE_SIZE = 40 * 1024 * 1024

/** Un 4K de 200–300 MB se puede comprimir. Por encima, ni el navegador lo aguanta. */
export const MAX_VIDEO_SOURCE_FILE_SIZE = 512 * 1024 * 1024

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
] as const

export const ALLOWED_VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.webm',
  '.m4v',
] as const

export const VIDEO_FILE_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm,.m4v'

export function isAllowedVideoExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return ALLOWED_VIDEO_EXTENSIONS.includes(ext as (typeof ALLOWED_VIDEO_EXTENSIONS)[number])
}

export function isAllowedVideoType(mimeType: string): boolean {
  if (!mimeType) {
    return false
  }

  return ALLOWED_VIDEO_TYPES.includes(mimeType.toLowerCase() as (typeof ALLOWED_VIDEO_TYPES)[number])
}

export function isAllowedVideoFile(file: Pick<File, 'name' | 'type'>): boolean {
  if (!isAllowedVideoExtension(file.name)) {
    return false
  }

  return !file.type || isAllowedVideoType(file.type)
}

export function isValidVideoFileSize(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_VIDEO_FILE_SIZE
}

export function isVideoDurationAllowed(durationSeconds: number): boolean {
  return Number.isFinite(durationSeconds)
    && durationSeconds > 0
    && durationSeconds <= MAX_VIDEO_DURATION_SECONDS + 0.35
}

export function formatVideoDurationLimit(): string {
  return `${MAX_VIDEO_DURATION_SECONDS} segundos`
}

export function companyVideoUploadHint(maxVideos: number): string {
  return `Máximo ${maxVideos} clips. Adelia recorta a ${MAX_VIDEO_DURATION_SECONDS} s y comprime un 4K de 200–300 MB a un HD de unos 10–30 MB (máx. ${formatFileSize(MAX_VIDEO_FILE_SIZE)}). Puede tardar un minuto. MP4, MOV o WebM. Después pulsa Guardar perfil.`
}

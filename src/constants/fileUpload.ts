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

import { sanitizeString } from './sanitize.ts'

export class InputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InputError'
  }
}

export function asTrimmed(value: unknown, max = 200, label = 'Este dato'): string {
  if (typeof value !== 'string') {
    throw new InputError(`${label} no es válido.`)
  }
  const trimmed = sanitizeString(value, max)
  if (!trimmed) {
    throw new InputError(`${label} no puede estar vacío.`)
  }
  return trimmed
}

export function asOptionalTrimmed(value: unknown, max = 200): string {
  if (value == null || value === '') {
    return ''
  }
  if (typeof value !== 'string') {
    return ''
  }
  return sanitizeString(value, max)
}

export function asPlainText(value: unknown, max = 200, label = 'Este dato'): string {
  const cleaned = asTrimmed(value, max, label).replace(/<[^>]*>/g, '').trim()
  if (!cleaned) {
    throw new InputError(`${label} no puede estar vacío.`)
  }
  return cleaned
}

export function asEmail(value: unknown): string {
  const email = asTrimmed(value, 120, 'El correo').toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.includes('..')) {
    throw new InputError('Indica un correo electrónico válido.')
  }
  return email
}

export function asOptionalEmail(value: unknown): string {
  const raw = asOptionalTrimmed(value, 120)
  if (!raw) {
    return ''
  }
  return asEmail(raw)
}

export function asSlug(value: unknown): string {
  const slug = asTrimmed(value, 80, 'El identificador').toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new InputError('Identificador no válido.')
  }
  return slug
}

export function asId(value: unknown, label = 'Identificador'): string {
  const id = asTrimmed(value, 128, label)
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new InputError(`${label} no válido.`)
  }
  return id
}

export function asInt(value: unknown, min: number, max: number, label = 'Este número'): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new InputError(`${label} no es válido.`)
  }
  return parsed
}

export function asDateYmd(value: unknown): string {
  const date = asTrimmed(value, 10, 'La fecha')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new InputError('Indica una fecha válida (YYYY-MM-DD).')
  }
  return date
}

const ALLOWED_MEDIA_HOSTS = new Set([
  'res.cloudinary.com',
])

export function asHttpsMediaUrl(value: unknown): string {
  const url = asTrimmed(value, 500, 'La URL')
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new InputError('La URL del archivo no es válida.')
  }
  if (parsed.protocol !== 'https:') {
    throw new InputError('Solo se admiten archivos por HTTPS.')
  }
  const host = parsed.hostname.toLowerCase()
  const allowed = ALLOWED_MEDIA_HOSTS.has(host) || host.endsWith('.cloudinary.com')
  if (!allowed) {
    throw new InputError('Ese origen de archivo no está permitido.')
  }
  return parsed.toString()
}

export function asPassword(value: unknown, min = 6, max = 128): string {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    throw new InputError(`La contraseña debe tener entre ${min} y ${max} caracteres.`)
  }
  if (/\u0000/.test(value)) {
    throw new InputError('La contraseña no es válida.')
  }
  return value
}

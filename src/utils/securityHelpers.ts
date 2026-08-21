/**
 * Utilidades de seguridad para prevenir vulnerabilidades comunes
 */

/**
 * Previene Mass Assignment permitiendo solo campos whitelistados
 * 
 * @example
 * const safeData = sanitizeInput(userInput, ['name', 'email', 'phone'])
 */
export function sanitizeInput<T extends Record<string, unknown>>(
  input: T,
  allowedFields: readonly string[],
): Partial<T> {
  const safe: Partial<T> = {}
  
  for (const key of allowedFields) {
    if (key in input) {
      safe[key as keyof T] = input[key as keyof T]
    }
  }
  
  return safe
}

/**
 * Campos permitidos para actualización de perfil de usuario
 */
export const ALLOWED_USER_PROFILE_FIELDS = [
  'displayName',
  'phone',
  'photoUrl',
  'notificationPreferences',
] as const

/**
 * Campos permitidos para actualización de perfil de empresa
 */
export const ALLOWED_COMPANY_PROFILE_FIELDS = [
  'name',
  'description',
  'phone',
  'email',
  'address',
  'city',
  'country',
  'logoUrl',
  'coverUrl',
  'cuisine',
  'priceRange',
  'openingHours',
] as const

/**
 * Campos permitidos para actualización de settings
 */
export const ALLOWED_SETTINGS_FIELDS = [
  'emailNotifications',
  'pushNotifications',
  'smsNotifications',
  'language',
  'timezone',
] as const

/**
 * Valida y sanitiza datos de perfil de usuario
 */
export function sanitizeUserProfileUpdate(input: Record<string, unknown>) {
  return sanitizeInput(input, ALLOWED_USER_PROFILE_FIELDS)
}

/**
 * Valida y sanitiza datos de perfil de empresa
 */
export function sanitizeCompanyProfileUpdate(input: Record<string, unknown>) {
  return sanitizeInput(input, ALLOWED_COMPANY_PROFILE_FIELDS)
}

/**
 * Valida y sanitiza datos de settings
 */
export function sanitizeSettingsUpdate(input: Record<string, unknown>) {
  return sanitizeInput(input, ALLOWED_SETTINGS_FIELDS)
}

/**
 * Detecta intentos de inyección en strings
 */
export function detectInjectionAttempt(value: string): boolean {
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,  // onclick=, onerror=, etc
    /<iframe/i,
    /document\./i,
    /window\./i,
    /eval\(/i,
    /expression\(/i,  // CSS expression()
  ]
  
  return dangerousPatterns.some(pattern => pattern.test(value))
}

/**
 * Sanitiza string de búsqueda/input básico
 */
export function sanitizeSearchInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '')  // Remover < y >
    .slice(0, 100)  // Limitar longitud
}

/**
 * Valida que un email sea válido
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

/**
 * Valida que un teléfono sea válido
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/  // E.164 format
  return phoneRegex.test(phone.replace(/[\s()-]/g, ''))
}

/**
 * Valida que una URL sea válida y segura
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Solo permitir http y https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }
    // No permitir IPs privadas
    const hostname = parsed.hostname
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Limita longitud de string de forma segura
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

/**
 * Genera mensaje de error genérico para producción
 * En desarrollo retorna el error real
 */
export function safeErrorMessage(error: unknown, fallback: string): string {
  if (import.meta.env.DEV) {
    // En desarrollo, mostrar error real
    if (error instanceof Error) {
      return error.message
    }
    return String(error)
  }
  
  // En producción, mensaje genérico
  return fallback
}

/**
 * Log de errores en producción (para enviar a servicio de monitoring)
 */
export function logSecurityEvent(event: {
  type: 'injection_attempt' | 'unauthorized_access' | 'invalid_input' | 'rate_limit'
  userId?: string
  details: Record<string, unknown>
}) {
  // En desarrollo, loguear en consola
  if (import.meta.env.DEV) {
    console.warn('[SECURITY EVENT]', event)
    return
  }
  
  // En producción, enviar a servicio de monitoring
  // TODO: Integrar con Sentry, LogRocket, etc.
  console.warn('[SECURITY]', event.type, event.userId)
}

/**
 * Delay aleatorio para prevenir timing attacks
 */
export async function randomDelay(minMs: number = 100, maxMs: number = 300): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs)
  await new Promise(resolve => setTimeout(resolve, delay))
}

/**
 * Rate limiter simple basado en memoria (solo para frontend)
 * Para producción, usar rate limiting en backend
 */
class SimpleRateLimiter {
  private attempts = new Map<string, number[]>()
  
  /**
   * Verifica si se excedió el rate limit
   * @param key - Identificador único (userId, email, etc)
   * @param maxAttempts - Máximo de intentos permitidos
   * @param windowMs - Ventana de tiempo en ms
   */
  check(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now()
    const attempts = this.attempts.get(key) || []
    
    // Filtrar intentos dentro de la ventana
    const recentAttempts = attempts.filter(time => now - time < windowMs)
    
    if (recentAttempts.length >= maxAttempts) {
      return false  // Rate limit excedido
    }
    
    // Agregar intento actual
    recentAttempts.push(now)
    this.attempts.set(key, recentAttempts)
    
    // Limpiar intentos viejos
    if (this.attempts.size > 1000) {
      this.cleanup(windowMs)
    }
    
    return true  // OK
  }
  
  private cleanup(windowMs: number) {
    const now = Date.now()
    for (const [key, attempts] of this.attempts.entries()) {
      const recent = attempts.filter(time => now - time < windowMs)
      if (recent.length === 0) {
        this.attempts.delete(key)
      } else {
        this.attempts.set(key, recent)
      }
    }
  }
  
  reset(key: string) {
    this.attempts.delete(key)
  }
}

export const rateLimiter = new SimpleRateLimiter()

/**
 * Verificación de reCAPTCHA v3 en Cloud Functions
 * 
 * CONFIGURACIÓN REQUERIDA:
 * 1. Obtener SECRET_KEY de https://www.google.com/recaptcha/admin
 * 2. Agregarla en Firebase Console:
 *    Functions → Secrets → Add Secret
 *    Nombre: RECAPTCHA_SECRET_KEY
 *    Valor: tu_secret_key_aqui
 */

interface RecaptchaVerificationResponse {
  success: boolean
  score: number
  action: string
  challenge_ts: string
  hostname: string
  'error-codes'?: string[]
}

/**
 * Verifica un token de reCAPTCHA v3 con Google
 * 
 * @param token - Token obtenido del frontend
 * @param expectedAction - Acción esperada (ej: 'register', 'login')
 * @param minScore - Score mínimo aceptable (0.0 - 1.0). Por defecto 0.5
 * @returns true si es válido, false si es bot
 */
export async function verifyRecaptchaToken(
  token: string,
  expectedAction: string,
  minScore: number = 0.5,
): Promise<{ valid: boolean; score: number; reason?: string }> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY

  // En desarrollo/testing, permitir token especial
  if (token === 'dev_mode_no_captcha' && process.env.NODE_ENV !== 'production') {
    console.warn('⚠️ reCAPTCHA en modo desarrollo - omitiendo verificación')
    return { valid: true, score: 1.0 }
  }

  if (!secretKey) {
    console.error('❌ RECAPTCHA_SECRET_KEY no configurada en Cloud Functions')
    // En desarrollo, permitir sin CAPTCHA
    if (process.env.NODE_ENV !== 'production') {
      return { valid: true, score: 1.0, reason: 'dev_mode' }
    }
    return { valid: false, score: 0, reason: 'captcha_not_configured' }
  }

  if (!token || token.trim() === '') {
    return { valid: false, score: 0, reason: 'missing_token' }
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    })

    if (!response.ok) {
      console.error('Error en API de reCAPTCHA:', response.status)
      return { valid: false, score: 0, reason: 'api_error' }
    }

    const data: RecaptchaVerificationResponse = await response.json()

    // Verificar errores de Google
    if (!data.success) {
      console.warn('reCAPTCHA falló:', data['error-codes'])
      return {
        valid: false,
        score: 0,
        reason: `google_error: ${data['error-codes']?.join(', ')}`,
      }
    }

    // Verificar acción
    if (data.action !== expectedAction) {
      console.warn(
        `Acción no coincide. Esperada: ${expectedAction}, recibida: ${data.action}`,
      )
      return {
        valid: false,
        score: data.score,
        reason: `action_mismatch: expected ${expectedAction}, got ${data.action}`,
      }
    }

    // Verificar score
    if (data.score < minScore) {
      console.warn(`Score bajo: ${data.score} < ${minScore} (posible bot)`)
      return {
        valid: false,
        score: data.score,
        reason: `low_score: ${data.score} < ${minScore}`,
      }
    }

    // Todo OK
    return {
      valid: true,
      score: data.score,
    }
  } catch (error) {
    console.error('Error verificando reCAPTCHA:', error)
    return {
      valid: false,
      score: 0,
      reason: error instanceof Error ? error.message : 'unknown_error',
    }
  }
}

/**
 * Configuraciones de score recomendadas según el tipo de acción
 */
export const RECAPTCHA_THRESHOLDS = {
  // Acciones críticas (registro, pago)
  critical: 0.7,

  // Acciones normales (login, formularios)
  normal: 0.5,

  // Acciones de bajo riesgo (búsqueda, lectura)
  low: 0.3,
} as const

/**
 * Helper para determinar si una acción requiere verificación estricta
 */
export function getRecaptchaThreshold(action: string): number {
  switch (action) {
    case 'register':
    case 'create_company':
    case 'payment':
      return RECAPTCHA_THRESHOLDS.critical

    case 'login':
    case 'submit_review':
    case 'create_reservation':
      return RECAPTCHA_THRESHOLDS.normal

    case 'search':
    case 'view':
      return RECAPTCHA_THRESHOLDS.low

    default:
      return RECAPTCHA_THRESHOLDS.normal
  }
}

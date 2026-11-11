import { adminDb } from '../firebase-admin.ts'

/**
 * Ajustes de seguridad editables sin desplegar: documento `appConfig/security`.
 * Si falta el documento o un campo, se usa el valor por defecto de aquí.
 */
export interface SecurityConfig {
  /** Pedir captcha al reservar sin cuenta (bots que llenan mesas o mandan correos). */
  guestBookingCaptcha: boolean
  /** Puntuación mínima de reCAPTCHA v3 para esas reservas (0 = bot, 1 = humano). */
  guestBookingMinScore: number
  /** Días como máximo de antelación para reservar (0 = sin límite). */
  maxBookingDaysAhead: number
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  guestBookingCaptcha: true,
  guestBookingMinScore: 0.5,
  maxBookingDaysAhead: 180,
}

const CACHE_MS = 5 * 60_000
let cached: { value: SecurityConfig; at: number } | null = null

export function parseSecurityConfig(data: FirebaseFirestore.DocumentData | undefined): SecurityConfig {
  const source = data ?? {}
  const score = typeof source.guestBookingMinScore === 'number' ? source.guestBookingMinScore : NaN
  const days = typeof source.maxBookingDaysAhead === 'number' ? source.maxBookingDaysAhead : NaN
  return {
    guestBookingCaptcha: typeof source.guestBookingCaptcha === 'boolean'
      ? source.guestBookingCaptcha
      : DEFAULT_SECURITY_CONFIG.guestBookingCaptcha,
    guestBookingMinScore: Number.isFinite(score) && score >= 0 && score <= 1
      ? score
      : DEFAULT_SECURITY_CONFIG.guestBookingMinScore,
    maxBookingDaysAhead: Number.isFinite(days) && days >= 0 && days <= 3650
      ? Math.floor(days)
      : DEFAULT_SECURITY_CONFIG.maxBookingDaysAhead,
  }
}

export async function getSecurityConfig(now = Date.now()): Promise<SecurityConfig> {
  if (cached && now - cached.at < CACHE_MS) {
    return cached.value
  }
  try {
    const snap = await adminDb.collection('appConfig').doc('security').get()
    const value = parseSecurityConfig(snap.data())
    cached = { value, at: now }
    return value
  } catch (error) {
    // Si Firestore falla, mejor seguro: los valores por defecto piden captcha.
    console.error('Security config read error:', error)
    return cached?.value ?? DEFAULT_SECURITY_CONFIG
  }
}

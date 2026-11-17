const PRODUCTION_APP_URL = 'https://adeliareservas.com'

export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? 'Adelia <no-reply@adeliareservas.com>'

export const EMAIL_REPLY_TO =
  process.env.EMAIL_REPLY_TO ?? 'contacto@adeliareservas.com'

function isLocalAppUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return true
  }
}

/**
 * Base de la app para enlaces de correo (reset, verificación, etc.).
 * En Cloud Functions nunca devolvemos localhost aunque APP_URL venga mal
 * del .env local embebido en el build.
 */
function resolveAppUrl(): string {
  const raw = (process.env.APP_URL ?? PRODUCTION_APP_URL).trim().replace(/\/$/, '')
  const runningInCloudFunctions =
    Boolean(process.env.K_SERVICE || process.env.FUNCTION_TARGET)
    && process.env.FUNCTIONS_EMULATOR !== 'true'

  if (!raw || isLocalAppUrl(raw)) {
    if (runningInCloudFunctions || process.env.NODE_ENV === 'production') {
      return PRODUCTION_APP_URL
    }
  }

  return raw || PRODUCTION_APP_URL
}

export const APP_URL = resolveAppUrl()

export function getResendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY?.trim() || undefined
}

export function isValidClientEmail(email: string): boolean {
  const trimmed = email.trim()
  return trimmed.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)
}

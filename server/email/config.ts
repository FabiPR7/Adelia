export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? 'Adelia Reservas <no-reply@adeliareservas.com>'

export const EMAIL_REPLY_TO =
  process.env.EMAIL_REPLY_TO ?? 'contacto@adeliareservas.com'

export const APP_URL = (process.env.APP_URL ?? 'https://adeliareservas.com').replace(/\/$/, '')

export function getResendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY?.trim() || undefined
}

export function isValidClientEmail(email: string): boolean {
  const trimmed = email.trim()
  return trimmed.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)
}

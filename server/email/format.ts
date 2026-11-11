import { BUSINESS_TIME_ZONE } from '../utils/madridDateTime.ts'

export function formatDateSpanish(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatTimeSpanish(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function capitalizeSpanish(text: string): string {
  if (!text) {
    return text
  }

  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatPhoneDisplay(phone: string): string {
  const trimmed = phone.trim()

  if (!trimmed) {
    return '—'
  }

  return trimmed
}

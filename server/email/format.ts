export function formatDateSpanish(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatTimeSpanish(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
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

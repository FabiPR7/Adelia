const AUTH_DOMAIN = 'adelia.app'

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export function dateToIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getPublicBookingUrl(slug: string): string {
  const path = `/reservar/${slug}`

  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`
  }

  return path
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function slugToAuthEmail(slug: string): string {
  return `${slug}@${AUTH_DOMAIN}`
}

export function usernameToAuthEmail(username: string): string {
  return slugToAuthEmail(slugify(username))
}

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

export function dateToTimeInput(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const result = new Date(date)
  result.setHours(hours, minutes, 0, 0)
  return result
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000)
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function startOfDay(date: Date): Date {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

export function isPastCalendarDate(date: Date): boolean {
  return startOfDay(date).getTime() < startOfDay(new Date()).getTime()
}

export function isReservationStartInPast(date: Date, time: string): boolean {
  return combineDateAndTime(date, time).getTime() <= Date.now()
}

export function assertReservationStartInFuture(
  date: Date,
  time: string,
  status: 'confirmed' | 'cancelled' | 'completed' = 'confirmed',
): void {
  if (status !== 'confirmed') {
    return
  }

  if (isPastCalendarDate(date) || isReservationStartInPast(date, time)) {
    throw new Error('No se pueden hacer reservas en fechas u horas pasadas.')
  }
}

export function clampToTodayOrFuture(date: Date): Date {
  const today = startOfDay(new Date())

  if (startOfDay(date).getTime() < today.getTime()) {
    return new Date(today)
  }

  return date
}

export function getMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7
  const days: (Date | null)[] = []

  for (let i = 0; i < startOffset; i += 1) {
    days.push(null)
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day))
  }

  return days
}

export const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

export const WEEKDAY_NAMES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

export function defaultSchedule() {
  const openDay = { open: '13:00', close: '23:00', active: true }
  const closedDay = { open: '', close: '', active: false }

  return {
    monday: { ...openDay },
    tuesday: { ...openDay },
    wednesday: { ...closedDay },
    thursday: { ...openDay },
    friday: { open: '13:00', close: '23:30', active: true },
    saturday: { open: '13:00', close: '23:30', active: true },
    sunday: { open: '13:00', close: '16:00', active: true },
  }
}

export function normalizeSpanishPhoneDigits(input: string): string | null {
  let digits = input.trim().replace(/[\s.\-/()]/g, '')

  if (digits.startsWith('+')) {
    digits = digits.slice(1)
  }

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  if (digits.startsWith('34') && digits.length >= 11) {
    digits = digits.slice(2)
  }

  if (!/^[6789]\d{8}$/.test(digits)) {
    return null
  }

  return digits
}

export function isValidSpanishPhone(input: string): boolean {
  return normalizeSpanishPhoneDigits(input) !== null
}

export function formatSpanishPhoneForStorage(input: string): string {
  const digits = normalizeSpanishPhoneDigits(input)

  if (!digits) {
    return input.trim()
  }

  return `+34 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
}

export function isValidEmail(input: string): boolean {
  const trimmed = input.trim()

  if (!trimmed) {
    return true
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = text.trim()

  if (!value || typeof document === 'undefined') {
    return false
  }

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Fallback below for mobile browsers and older WebViews.
    }
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '0'
    textarea.style.width = '2em'
    textarea.style.height = '2em'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, value.length)

    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  } catch {
    return false
  }
}

export function selectInputText(input: HTMLInputElement | HTMLTextAreaElement | null): void {
  if (!input) {
    return
  }

  input.focus()
  input.select()
  input.setSelectionRange(0, input.value.length)
}

export function isValidClientName(input: string): boolean {
  const trimmed = input.trim().replace(/\s+/g, ' ')

  if (trimmed.length < 2 || trimmed.length > 80) {
    return false
  }

  const letters = trimmed.match(/\p{L}/gu)

  return (letters?.length ?? 0) >= 2
}

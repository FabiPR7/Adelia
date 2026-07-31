const AUTH_DOMAIN = 'adelia.app'

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

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
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

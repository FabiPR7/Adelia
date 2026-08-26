export const BUSINESS_TIME_ZONE = 'Europe/Madrid'

/** Interpreta fecha y hora civiles en Europe/Madrid. */
export function madridDateTime(ymd: string, time: string, timeZone = BUSINESS_TIME_ZONE): Date {
  const [year, month, day] = ymd.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)

  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    throw new Error('Fecha u hora inválida.')
  }

  const utcMillis = Date.UTC(year, month - 1, day, hour, minute, 0)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcMillis))
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  )

  return new Date(utcMillis - (asUtc - utcMillis))
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function madridYmd(date: Date, timeZone = BUSINESS_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00'
  return `${read('year')}-${read('month')}-${read('day')}`
}

export function madridHour(date: Date, timeZone = BUSINESS_TIME_ZONE): number {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date).find((part) => part.type === 'hour')?.value,
  )
  return Number.isFinite(hour) ? hour : date.getHours()
}

export function madridWeekday(date: Date, timeZone = BUSINESS_TIME_ZONE): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(date)
  const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
  return index >= 0 ? index : date.getDay()
}

export function madridDayRange(instant: Date): { start: Date; end: Date } {
  const ymd = madridYmd(instant)
  const start = madridDateTime(ymd, '00:00')
  const [year, month, day] = ymd.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  const nextYmd = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
  return { start, end: madridDateTime(nextYmd, '00:00') }
}

export function utcNoonFromYmd(ymd: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!match) {
    throw new Error('Fecha inválida.')
  }

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month, day, 12, 0, 0))

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month
    || date.getUTCDate() !== day
  ) {
    throw new Error('Fecha inválida.')
  }

  return date
}

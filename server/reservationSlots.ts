import { madridDateTime, utcNoonFromYmd } from './utils/madridDateTime.ts'

type TimePeriod = { open: string; close: string }

type DaySchedule = { open: string; close: string; active: boolean; periods?: TimePeriod[] }

type CompanySchedule = Record<
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
  DaySchedule
>

type ReservationLike = {
  id: string
  tableId: string
  startTime: Date
  endTime: Date
  status: string
}

const WEEKDAY_TO_SCHEDULE: Record<number, keyof CompanySchedule> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
}

function getDaySchedule(date: Date, schedule: CompanySchedule): DaySchedule {
  return schedule[WEEKDAY_TO_SCHEDULE[date.getUTCDay()]]
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function combineDateAndTime(date: Date, time: string): Date {
  const ymd = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  return madridDateTime(ymd, time)
}

function schedulePeriods(day: DaySchedule): TimePeriod[] {
  if (Array.isArray(day.periods) && day.periods.length > 0) {
    return day.periods.filter((period) => Boolean(period.open && period.close))
  }
  if (day.open && day.close) {
    return [{ open: day.open, close: day.close }]
  }
  return []
}

export function generateSlotTimes(
  date: Date,
  schedule: CompanySchedule,
  slotIntervalMinutes: number,
  reservationDurationMinutes: number,
): string[] {
  const day = getDaySchedule(date, schedule)

  if (!day.active) {
    return []
  }

  // Un 0 o un dato raro en la base dejaba este bucle sin avanzar.
  const step = Math.max(5, Math.trunc(Number(slotIntervalMinutes)) || 0)
  const duration = Math.max(5, Math.trunc(Number(reservationDurationMinutes)) || 0)
  const slots: string[] = []

  for (const period of schedulePeriods(day)) {
    const openMinutes = timeToMinutes(period.open)
    const closeMinutes = timeToMinutes(period.close)

    for (
      let cursor = openMinutes;
      cursor + duration <= closeMinutes;
      cursor += step
    ) {
      const time = minutesToTime(cursor)
      if (!slots.includes(time)) {
        slots.push(time)
      }
    }
  }

  return slots.sort()
}

export function reservationsOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime()
}

export function occupyingReservation(
  reservation: ReservationLike,
  tableId: string,
  startTime: Date,
  endTime: Date,
  excludeId?: string,
): boolean {
  if (reservation.status === 'cancelled') {
    return false
  }
  if (excludeId && reservation.id === excludeId) {
    return false
  }
  if (reservation.tableId !== tableId) {
    return false
  }
  return reservationsOverlap(startTime, endTime, reservation.startTime, reservation.endTime)
}

export function isSlotAvailableForTable(
  tableId: string,
  time: string,
  date: Date,
  durationMinutes: number,
  reservations: ReservationLike[],
): boolean {
  if (reservationStart(date, time).getTime() <= Date.now()) {
    return false
  }

  const startTime = combineDateAndTime(date, time)
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000)

  return !reservations.some((reservation) =>
    occupyingReservation(reservation, tableId, startTime, endTime),
  )
}

export function assertReservationSlotValid(
  tableId: string,
  time: string,
  date: Date,
  schedule: CompanySchedule,
  slotIntervalMinutes: number,
  durationMinutes: number,
  reservations: ReservationLike[],
): void {
  assertReservationStartInFuture(date, time)

  const slots = generateSlotTimes(date, schedule, slotIntervalMinutes, durationMinutes)

  if (slots.length === 0) {
    throw new Error('El restaurante no abre ese día. Elige otro día.')
  }

  if (!slots.includes(time)) {
    throw new Error('La hora seleccionada no está dentro del horario del restaurante.')
  }

  if (!isSlotAvailableForTable(tableId, time, date, durationMinutes, reservations)) {
    throw new Error('Esa mesa ya está reservada a esa hora.')
  }
}

/** «Comer ahora»: margen para llegar tarde y ventana de búsqueda (de appConfig/businessRules). */
export interface NowWindow {
  graceMinutes: number
  windowMinutes: number
}

/**
 * Hora que vale como «ahora» aunque no sea una de las horas fijas del local: hoy,
 * en minutos redondos de 5, como pronto hace `graceMinutes` y como tarde dentro
 * de `windowMinutes`, y con la reserva entera dentro de un tramo abierto.
 */
export function isNowBookingTime(
  date: Date,
  time: string,
  schedule: CompanySchedule,
  durationMinutes: number,
  window: NowWindow,
  now = Date.now(),
): boolean {
  if (!/^\d{2}:\d{2}$/.test(time)) return false
  const minutes = timeToMinutes(time)
  if (!Number.isFinite(minutes) || minutes % 5 !== 0) return false
  const start = combineDateAndTime(date, time).getTime()
  if (start < now - window.graceMinutes * 60_000 || start > now + window.windowMinutes * 60_000) return false
  const day = getDaySchedule(date, schedule)
  if (!day?.active) return false
  const duration = Math.max(5, Math.trunc(Number(durationMinutes)) || 0)
  return schedulePeriods(day).some((period) => (
    minutes >= timeToMinutes(period.open) && minutes + duration <= timeToMinutes(period.close)
  ))
}

/** Horas candidatas para «ahora»: las fijas del local en la ventana y la siguiente en punto de 5 min. */
export function nowCandidateTimes(
  date: Date,
  schedule: CompanySchedule,
  durationMinutes: number,
  window: NowWindow,
  now = Date.now(),
): string[] {
  const grid = generateSlotTimes(date, schedule, durationMinutes, durationMinutes)
  const nowParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(now))
  const hour = Number(nowParts.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(nowParts.find((part) => part.type === 'minute')?.value ?? 0)
  const next5 = Math.ceil((hour * 60 + minute) / 5) * 5
  const extra = next5 < 24 * 60 ? [minutesToTime(next5)] : []
  return [...new Set([...grid, ...extra])]
    .filter((time) => isNowBookingTime(date, time, schedule, durationMinutes, window, now))
    .sort()
}

export function parseBookingDate(value: string): Date {
  return utcNoonFromYmd(value)
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function startOfDay(date: Date): Date {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function reservationStart(date: Date, time: string): Date {
  return combineDateAndTime(date, time)
}

export function assertReservationStartInFuture(date: Date, time: string): void {
  if (startOfDay(date).getTime() < startOfDay(new Date()).getTime()) {
    throw new Error('No se pueden hacer reservas en fechas u horas pasadas.')
  }

  if (reservationStart(date, time).getTime() <= Date.now()) {
    throw new Error('No se pueden hacer reservas en fechas u horas pasadas.')
  }
}

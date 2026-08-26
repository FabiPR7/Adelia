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

  const slots: string[] = []

  for (const period of schedulePeriods(day)) {
    const openMinutes = timeToMinutes(period.open)
    const closeMinutes = timeToMinutes(period.close)

    for (
      let cursor = openMinutes;
      cursor + reservationDurationMinutes <= closeMinutes;
      cursor += slotIntervalMinutes
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

  if (!slots.includes(time)) {
    throw new Error('La hora seleccionada no está dentro del horario del restaurante.')
  }

  if (!isSlotAvailableForTable(tableId, time, date, durationMinutes, reservations)) {
    throw new Error('Esa mesa ya está reservada a esa hora.')
  }
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

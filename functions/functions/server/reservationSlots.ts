type DaySchedule = { open: string; close: string; active: boolean }

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
  return schedule[WEEKDAY_TO_SCHEDULE[date.getDay()]]
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

function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const result = new Date(date)
  result.setHours(hours, minutes, 0, 0)
  return result
}

export function generateSlotTimes(
  date: Date,
  schedule: CompanySchedule,
  slotIntervalMinutes: number,
  reservationDurationMinutes: number,
): string[] {
  const day = getDaySchedule(date, schedule)

  if (!day.active || !day.open || !day.close) {
    return []
  }

  const openMinutes = timeToMinutes(day.open)
  const closeMinutes = timeToMinutes(day.close)
  const slots: string[] = []

  for (
    let cursor = openMinutes;
    cursor + reservationDurationMinutes <= closeMinutes;
    cursor += slotIntervalMinutes
  ) {
    slots.push(minutesToTime(cursor))
  }

  return slots
}

function reservationsOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime()
}

export function isSlotAvailableForTable(
  tableId: string,
  time: string,
  date: Date,
  durationMinutes: number,
  reservations: ReservationLike[],
): boolean {
  const startTime = combineDateAndTime(date, time)
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000)

  for (const reservation of reservations) {
    if (reservation.status === 'cancelled') {
      continue
    }

    if (reservation.tableId !== tableId) {
      continue
    }

    if (reservationsOverlap(startTime, endTime, reservation.startTime, reservation.endTime)) {
      return false
    }
  }

  return true
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
  const slots = generateSlotTimes(date, schedule, slotIntervalMinutes, durationMinutes)

  if (!slots.includes(time)) {
    throw new Error('La hora seleccionada no está dentro del horario del restaurante.')
  }

  if (!isSlotAvailableForTable(tableId, time, date, durationMinutes, reservations)) {
    throw new Error('Esa mesa ya está reservada a esa hora.')
  }
}

export function parseBookingDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())

  if (!match) {
    throw new Error('Fecha inválida.')
  }

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    throw new Error('Fecha inválida.')
  }

  return date
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

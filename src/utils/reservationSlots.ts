import type { CompanySchedule, DaySchedule, Reservation } from '../types'
import { addMinutes, combineDateAndTime, assertReservationStartInFuture, isReservationStartInPast } from './helpers'

const WEEKDAY_TO_SCHEDULE: Record<number, keyof CompanySchedule> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
}

export function getDaySchedule(date: Date, schedule: CompanySchedule): DaySchedule {
  const key = WEEKDAY_TO_SCHEDULE[date.getDay()]
  return schedule[key]
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

export function reservationsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime()
}

export function isSlotAvailableForTable(
  tableId: string,
  time: string,
  date: Date,
  durationMinutes: number,
  reservations: Reservation[],
  excludeReservationId?: string,
): boolean {
  if (isReservationStartInPast(date, time)) {
    return false
  }

  const startTime = combineDateAndTime(date, time)
  const endTime = addMinutes(startTime, durationMinutes)

  for (const reservation of reservations) {
    if (reservation.status === 'cancelled') {
      continue
    }

    if (excludeReservationId && reservation.id === excludeReservationId) {
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

export function getSlotStatesForTable(
  tableId: string,
  date: Date,
  schedule: CompanySchedule,
  slotIntervalMinutes: number,
  durationMinutes: number,
  reservations: Reservation[],
  excludeReservationId?: string,
): { time: string; available: boolean }[] {
  const slots = generateSlotTimes(date, schedule, slotIntervalMinutes, durationMinutes)

  return slots.map((time) => ({
    time,
    available: isSlotAvailableForTable(
      tableId,
      time,
      date,
      durationMinutes,
      reservations,
      excludeReservationId,
    ),
  }))
}

export function isHourAvailable(
  time: string,
  date: Date,
  durationMinutes: number,
  tables: { id: string }[],
  reservations: Reservation[],
  excludeReservationId?: string,
): boolean {
  return tables.some((table) =>
    isSlotAvailableForTable(
      table.id,
      time,
      date,
      durationMinutes,
      reservations,
      excludeReservationId,
    ),
  )
}

export function getTableStatesForSlot(
  time: string,
  date: Date,
  durationMinutes: number,
  tables: { id: string }[],
  reservations: Reservation[],
  excludeReservationId?: string,
): { tableId: string; available: boolean }[] {
  return tables.map((table) => ({
    tableId: table.id,
    available: isSlotAvailableForTable(
      table.id,
      time,
      date,
      durationMinutes,
      reservations,
      excludeReservationId,
    ),
  }))
}

export function getHourSlotStates(
  date: Date,
  schedule: CompanySchedule,
  slotIntervalMinutes: number,
  durationMinutes: number,
  tables: { id: string }[],
  reservations: Reservation[],
  excludeReservationId?: string,
): { time: string; available: boolean }[] {
  const slots = generateSlotTimes(date, schedule, slotIntervalMinutes, durationMinutes)

  return slots.map((time) => ({
    time,
    available: isHourAvailable(
      time,
      date,
      durationMinutes,
      tables,
      reservations,
      excludeReservationId,
    ),
  }))
}

export function assertReservationSlotValid(
  tableId: string,
  time: string,
  date: Date,
  schedule: CompanySchedule,
  slotIntervalMinutes: number,
  durationMinutes: number,
  reservations: Reservation[],
  excludeReservationId?: string,
  status: Reservation['status'] = 'confirmed',
): void {
  if (status === 'cancelled') {
    return
  }

  assertReservationStartInFuture(date, time, status)

  const slots = generateSlotTimes(date, schedule, slotIntervalMinutes, durationMinutes)

  if (!slots.includes(time)) {
    throw new Error('La hora seleccionada no está dentro del horario del restaurante.')
  }

  if (
    !isSlotAvailableForTable(
      tableId,
      time,
      date,
      durationMinutes,
      reservations,
      excludeReservationId,
    )
  ) {
    throw new Error('Esa mesa ya está reservada a esa hora.')
  }
}

export function formatSlotEndTime(time: string, durationMinutes: number): string {
  return minutesToTime(timeToMinutes(time) + durationMinutes)
}

export function computeReservationCountsByMonth(
  reservations: Reservation[],
  year: number,
  month: number,
): Record<number, number> {
  const counts: Record<number, number> = {}

  for (const reservation of reservations) {
    const start = reservation.startTime

    if (start.getFullYear() !== year || start.getMonth() !== month) {
      continue
    }

    if (reservation.status === 'cancelled') {
      continue
    }

    const day = start.getDate()
    counts[day] = (counts[day] ?? 0) + 1
  }

  return counts
}

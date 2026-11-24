// «Comer ahora»: qué se sabe de cada local abierto en este momento. Lo calcula SOLO el
// servidor, en hora de España; la web y la app solo lo pintan. Si se puede reservar,
// la reserva se vuelve a validar con las mismas reglas (isNowBookingTime).
import { combineDateAndTime, generateSlotTimes, nowCandidateTimes, occupyingReservation, type NowWindow } from '../reservationSlots.ts'
import { madridYmd, utcNoonFromYmd } from '../utils/madridDateTime.ts'

type Schedule = Parameters<typeof nowCandidateTimes>[1]

export interface NowTable {
  id: string
  capacity: number
}

export interface NowReservation {
  id: string
  tableId: string
  startTime: Date
  endTime: Date
  status: string
}

export interface NowSlot {
  time: string
  /** Momento exacto (ISO): el móvil calcula con él cuánto falta, sea cual sea su zona horaria. */
  startsAt: string
  /** Minutos desde ya (negativo = empezó hace poco y aún se puede llegar). */
  minutesFromNow: number
  freeTableCount: number
  /** Mesas libres, de la más ajustada a la más grande (máx. 2 por tamaño). */
  freeTableIds: string[]
  /** Comensales que caben en la mesa libre más grande. */
  maxSeats: number
}

/** Como mucho 2 mesas de cada tamaño: así siempre va alguna de las grandes. */
function pickTables(tables: NowTable[]): string[] {
  const perSize = new Map<number, number>()
  return tables.filter((table) => {
    const used = perSize.get(table.capacity) ?? 0
    perSize.set(table.capacity, used + 1)
    return used < 2
  }).slice(0, 16).map((table) => table.id)
}

function freeTablesBetween(tables: NowTable[], reservations: NowReservation[], start: Date, end: Date): NowTable[] {
  return tables.filter((table) => !reservations.some((item) => occupyingReservation(item, table.id, start, end)))
}

/** Mesas donde caben (todas si no se dice cuántos son), de menor a mayor. */
function fittingTables(tables: NowTable[], pax: number | null): NowTable[] {
  return tables
    .filter((table) => pax == null || table.capacity >= pax)
    .sort((left, right) => left.capacity - right.capacity)
}

interface SlotInput {
  date: Date
  schedule: Schedule
  durationMinutes: number
  tables: NowTable[]
  pax: number | null
  reservations: NowReservation[]
  now?: number
}

/** La primera hora de la ventana con alguna mesa libre. */
export function findNowSlot(input: SlotInput & { window: NowWindow }): NowSlot | null {
  const now = input.now ?? Date.now()
  const duration = Math.max(5, Math.trunc(Number(input.durationMinutes)) || 0)
  const fitting = fittingTables(input.tables, input.pax)
  if (fitting.length === 0) return null
  for (const time of nowCandidateTimes(input.date, input.schedule, duration, input.window, now)) {
    const start = combineDateAndTime(input.date, time)
    const free = freeTablesBetween(fitting, input.reservations, start, new Date(start.getTime() + duration * 60_000))
    if (free.length > 0) {
      return {
        time,
        startsAt: start.toISOString(),
        minutesFromNow: Math.round((start.getTime() - now) / 60_000),
        freeTableCount: free.length,
        freeTableIds: pickTables(free),
        maxSeats: free[free.length - 1].capacity,
      }
    }
  }
  return null
}

/**
 * La última hora de hoy que ya pasó hace poco (hasta `missedMinutes`) y que nadie
 * reservó: no se puede reservar, pero puede que la mesa siga libre.
 */
export function findMissedSlot(input: SlotInput & { missedMinutes: number }): { time: string; startsAt: string } | null {
  const now = input.now ?? Date.now()
  const duration = Math.max(5, Math.trunc(Number(input.durationMinutes)) || 0)
  const fitting = fittingTables(input.tables, input.pax)
  const times = generateSlotTimes(input.date, input.schedule, duration, duration).sort().reverse()
  for (const time of times) {
    const start = combineDateAndTime(input.date, time)
    const age = now - start.getTime()
    if (age <= 0) continue
    if (age > input.missedMinutes * 60_000) return null
    const end = new Date(start.getTime() + duration * 60_000)
    if (freeTablesBetween(fitting, input.reservations, start, end).length > 0) {
      return { time, startsAt: start.toISOString() }
    }
  }
  return null
}

/** ¿Hay alguna mesa sin reserva en este momento y en la próxima media hora? */
export function hasTableFreeNow(tables: NowTable[], reservations: NowReservation[], pax: number | null, now = Date.now()): boolean {
  return freeTablesBetween(fittingTables(tables, pax), reservations, new Date(now), new Date(now + 30 * 60_000)).length > 0
}

/**
 * ¿El local ha puesto su horario? Al crear un local se le pone uno automático: mientras
 * siga siendo ese, no sabemos cuándo abre y no se puede decir «abierto».
 */
export function hasOwnSchedule(schedule: Schedule | null | undefined, automatic: Schedule): boolean {
  if (!schedule) return false
  return DAY_KEYS.some((key) => {
    const day = schedule[key]
    const auto = automatic[key]
    if (!day || Boolean(day.active) !== Boolean(auto.active)) return true
    if (!day.active) return false
    const periods = Array.isArray(day.periods) && day.periods.length > 0 ? day.periods : [{ open: day.open, close: day.close }]
    return periods.length !== 1 || periods[0].open !== auto.open || periods[0].close !== auto.close
  })
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const HHMM = /^\d{2}:\d{2}$/

/** Hora a la que cierra si está abierto ahora (también si cierra pasada la medianoche). */
export function closesAtIfOpen(schedule: Schedule, now = Date.now()): { time: string; minutesLeft: number } | null {
  const today = utcNoonFromYmd(madridYmd(new Date(now)))
  for (const offset of [0, -1]) {
    const date = new Date(today.getTime() + offset * 86_400_000)
    const day = schedule?.[DAY_KEYS[date.getUTCDay()]]
    if (!day?.active) continue
    const periods = Array.isArray(day.periods) && day.periods.length > 0 ? day.periods : [{ open: day.open, close: day.close }]
    for (const period of periods) {
      if (!HHMM.test(period?.open ?? '') || !HHMM.test(period?.close ?? '')) continue
      const start = combineDateAndTime(date, period.open).getTime()
      const closeDate = period.close <= period.open ? new Date(date.getTime() + 86_400_000) : date
      const end = combineDateAndTime(closeDate, period.close).getTime()
      if (now >= start && now < end) return { time: period.close, minutesLeft: Math.floor((end - now) / 60_000) }
    }
  }
  return null
}

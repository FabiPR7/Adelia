// «Comer ahora»: qué locales cercanos tienen mesa libre para ya mismo (o como mucho en
// unos minutos). Lo calcula SOLO el servidor, en hora de España; la web y la app solo
// lo pintan. La reserva luego se valida con las mismas reglas (isNowBookingTime).
import { combineDateAndTime, nowCandidateTimes, occupyingReservation, type NowWindow } from '../reservationSlots.ts'

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
  /** Minutos desde ya (negativo = empezó hace poco y aún se puede llegar). */
  minutesFromNow: number
  freeTableCount: number
  /** Mesas libres para ese grupo, de la más ajustada a la más grande (máx. 6). */
  freeTableIds: string[]
}

/** La primera hora de la ventana con al menos una mesa libre para ese número de personas. */
export function findNowSlot(input: {
  date: Date
  schedule: Schedule
  durationMinutes: number
  tables: NowTable[]
  pax: number
  reservations: NowReservation[]
  window: NowWindow
  now?: number
}): NowSlot | null {
  const now = input.now ?? Date.now()
  const duration = Math.max(5, Math.trunc(Number(input.durationMinutes)) || 0)
  const fitting = input.tables
    .filter((table) => table.capacity >= input.pax)
    .sort((left, right) => left.capacity - right.capacity)
  if (fitting.length === 0) return null
  for (const time of nowCandidateTimes(input.date, input.schedule, duration, input.window, now)) {
    const start = combineDateAndTime(input.date, time)
    const end = new Date(start.getTime() + duration * 60_000)
    const free = fitting.filter((table) => !input.reservations.some((reservation) => (
      occupyingReservation(reservation, table.id, start, end)
    )))
    if (free.length > 0) {
      return { time, minutesFromNow: Math.round((start.getTime() - now) / 60_000), freeTableCount: free.length, freeTableIds: free.slice(0, 6).map((table) => table.id) }
    }
  }
  return null
}

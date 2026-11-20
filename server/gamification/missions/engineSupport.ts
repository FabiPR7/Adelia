// Piezas pequeñas que el motor de misiones necesita (antes vivían en la web).
import { BUSINESS_TIME_ZONE } from '../../utils/madridDateTime.ts'

export type ReservationStatus = 'completed' | 'confirmed' | 'cancelled' | string
export type PromotionVisitStatus = 'pending' | 'eligible' | 'n/a' | string

/** Lo que el motor lee de una reserva. */
export interface Reservation {
  id: string
  companyId: string
  tableId: string
  pax: number
  startTime: Date
  endTime: Date
  createdAt: Date
  status: ReservationStatus
  customerUid?: string | null
  promotionId?: string | null
  minimumSpendCents?: number | null
  promotionVisitStatus?: PromotionVisitStatus
}

export interface CustomerVerifiedConsumption {
  id: string
  companyId: string
  verifiedAt: string
  visitAt: string
  totalCents: number
  mode: 'total' | 'products' | 'skip'
  lineItems: Array<{ name: string; quantity: number; lineTotalCents: number }>
  source: 'reservation' | 'walk_in'
  promotionId: string | null
  minimumSpendCents: number
  meetsMinimumSpend: boolean
}

export function reservationHasMinimumSpendRequirement(reservation: Reservation): boolean {
  return typeof reservation.minimumSpendCents === 'number' && reservation.minimumSpendCents > 0
}

/** Reservas confirmadas que suman progreso en ofertas por reserva o consumo. */
export function countsForPromotionProgress(reservation: Reservation): boolean {
  if (reservation.status !== 'confirmed') return false
  if (!reservationHasMinimumSpendRequirement(reservation)) return true
  return reservation.promotionVisitStatus === 'eligible'
}

const BAR_VENUE_TYPE_IDS = new Set<string>([
  'bar',
  'tapas_bar',
  'pub',
  'wine_bar',
  'cocktail_bar',
  'cerveceria',
  'vermuteria',
])

const RESTAURANT_VENUE_TYPE_IDS = new Set<string>([
  'restaurant',
  'gastrobar',
  'bistro',
  'asador',
  'hotel',
])

export function venueTypesIncludeKind(venueTypes: string[], kind: 'bar' | 'restaurant'): boolean {
  const allowed = kind === 'bar' ? BAR_VENUE_TYPE_IDS : RESTAURANT_VENUE_TYPE_IDS
  return venueTypes.some((id) => allowed.has(id))
}

/** Reservas hechas pero sin confirmar asistencia en el restaurante. */
export function buildPendingReservationCounts(reservations: Reservation[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const reservation of reservations) {
    if (reservation.status !== 'completed') continue
    counts[reservation.companyId] = (counts[reservation.companyId] ?? 0) + 1
  }
  return counts
}

function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  const asUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'), read('second'))
  return Math.round((asUtc - instant.getTime()) / 60000)
}

/**
 * El motor usa la hora «local» del ordenador (getHours, getDay…). El servidor está en
 * UTC, así que a cada fecha se le da la hora de pared de España: después de esto,
 * getHours() devuelve la hora que marcaba un reloj en Madrid, en cualquier servidor.
 */
export function toMadridWall(instant: Date): Date {
  const localOffset = -instant.getTimezoneOffset()
  return new Date(instant.getTime() + (offsetMinutes(instant, BUSINESS_TIME_ZONE) - localOffset) * 60000)
}

let fixedNow: Date | null = null

/** «Ahora» en hora de pared de España (o la fecha fijada en los tests). */
export function engineNow(): Date {
  return toMadridWall(fixedNow ?? new Date())
}

/** Solo para tests: fija «ahora». */
export function setEngineNowForTests(date: Date | null): void {
  fixedNow = date
}

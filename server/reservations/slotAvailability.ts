// Horas y mesas libres de un día, y las reglas de las promos con horario. Se calculan
// SOLO aquí, en hora de España: la web y la app las reciben hechas en
// GET /api/public/booking/:slug/availability, y la reserva usa las mismas reglas.
import { generateSlotTimes, isSlotAvailableForTable } from '../reservationSlots.ts'
import { madridYmd, BUSINESS_TIME_ZONE } from '../utils/madridDateTime.ts'

type CompanySchedule = Parameters<typeof generateSlotTimes>[1]

export interface ReservationLike {
  id: string
  tableId: string
  startTime: Date
  endTime: Date
  status: string
}

export interface DaySlot {
  time: string
  /** Mesas libres a esa hora (vacío = hora completa). */
  freeTableIds: string[]
}

export function computeDaySlots(input: {
  date: Date
  schedule: CompanySchedule
  durationMinutes: number
  tableIds: string[]
  reservations: ReservationLike[]
}): DaySlot[] {
  const times = generateSlotTimes(input.date, input.schedule, input.durationMinutes, input.durationMinutes)
  return times.map((time) => ({
    time,
    freeTableIds: input.tableIds.filter((tableId) =>
      isSlotAvailableForTable(tableId, time, input.date, input.durationMinutes, input.reservations),
    ),
  }))
}

/** Lo que hace falta de la promo para sus reglas de horario. */
export interface SlotPromotion {
  type: string
  activeFromTime: string
  activeToTime: string
  arrivalWindowMinutes?: number | null
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function madridMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return read('hour') * 60 + read('minute')
}

/** El día de la reserva (fecha «a mediodía UTC» de la API) es hoy en España. */
function isTodayInMadrid(date: Date, now: Date): boolean {
  const ymd = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  return ymd === madridYmd(now)
}

export function isPromoTimeConstrained(promotion: SlotPromotion): boolean {
  return (promotion.type === 'time_limited' || promotion.type === 'attendance')
    && Boolean(promotion.activeFromTime && promotion.activeToTime)
}

export function isSlotWithinPromoWindow(time: string, promotion: SlotPromotion): boolean {
  const slot = timeToMinutes(time)
  return slot >= timeToMinutes(promotion.activeFromTime) && slot < timeToMinutes(promotion.activeToTime)
}

/** Asistencia puntual: hoy todavía no ha empezado o ya terminó. */
export function promoDayBlockMessage(promotion: SlotPromotion, date: Date, now = new Date()): string | null {
  if (promotion.type !== 'attendance' || !isPromoTimeConstrained(promotion)) return null
  if (!isTodayInMadrid(date, now)) return null
  const current = madridMinutes(now)
  if (current < timeToMinutes(promotion.activeFromTime)) {
    return `La promo de asistencia puntual empieza a las ${promotion.activeFromTime}. Aún no puedes reservar.`
  }
  if (current >= timeToMinutes(promotion.activeToTime)) {
    return 'La promo de asistencia puntual ya ha terminado hoy.'
  }
  return null
}

/** Asistencia puntual: la primera hora libre de la franja (si es hoy, la primera que aún no ha pasado). */
export function attendanceEarliestSlot(
  availableTimes: string[],
  promotion: SlotPromotion,
  date: Date,
  now = new Date(),
): string | null {
  const inWindow = availableTimes.filter((time) => isSlotWithinPromoWindow(time, promotion)).sort()
  if (!isTodayInMadrid(date, now)) return inWindow[0] ?? null
  const current = madridMinutes(now)
  return inWindow.find((time) => timeToMinutes(time) > current) ?? null
}

/** Por qué no se puede reservar esta hora con la promo (null si se puede). */
export function promoSlotReason(
  promotion: SlotPromotion,
  time: string,
  date: Date,
  availableTimes: string[],
  now = new Date(),
): string | null {
  if (!isPromoTimeConstrained(promotion)) return null
  if (!isSlotWithinPromoWindow(time, promotion)) return 'Esta promoción está fuera del horario.'
  if (promotion.type === 'time_limited') return null
  const dayBlock = promoDayBlockMessage(promotion, date, now)
  if (dayBlock) return dayBlock
  const earliest = attendanceEarliestSlot(availableTimes, promotion, date, now)
  if (!earliest) return 'No hay horas disponibles para esta promo de asistencia puntual.'
  if (time !== earliest) {
    const grace = promotion.arrivalWindowMinutes ?? 30
    return `Con asistencia puntual solo puedes reservar la primera hora disponible (${earliest}). Debes presentarte a esa hora; tienes ${grace} min para confirmar tu asistencia o pierdes la promo.`
  }
  return null
}

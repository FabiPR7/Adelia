import type { PublicPromotion } from '../services/publicPromotions'

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function isSlotWithinPromoWindow(
  slotTime: string,
  activeFromTime: string,
  activeToTime: string,
): boolean {
  const slot = timeToMinutes(slotTime)
  const from = timeToMinutes(activeFromTime)
  const to = timeToMinutes(activeToTime)
  return slot >= from && slot < to
}

export function isPromoTimeConstrained(promotion: PublicPromotion): boolean {
  return promotion.type === 'time_limited' || promotion.type === 'attendance'
}

export function buildPromotionBookingHref(
  companySlug: string,
  promotionId: string,
  options?: { fromPromotions?: boolean },
): string {
  const params = new URLSearchParams({ reservar: '1', promo: promotionId })
  if (options?.fromPromotions) {
    params.set('from', 'promociones')
  }
  return `/reservar/${encodeURIComponent(companySlug)}?${params.toString()}`
}

export function getAttendanceDayBlockMessage(
  promotion: PublicPromotion,
  selectedDate: Date,
  now = new Date(),
): string | null {
  if (promotion.type !== 'attendance') {
    return null
  }

  const isToday = selectedDate.toDateString() === now.toDateString()
  if (!isToday) {
    return null
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const fromMinutes = timeToMinutes(promotion.activeFromTime)
  const toMinutes = timeToMinutes(promotion.activeToTime)

  if (nowMinutes < fromMinutes) {
    return `La promo de asistencia puntual empieza a las ${promotion.activeFromTime}. Aún no puedes reservar.`
  }

  if (nowMinutes >= toMinutes) {
    return 'La promo de asistencia puntual ya ha terminado hoy.'
  }

  return null
}

/** Primera hora libre dentro de la franja de la promo (asistencia puntual). */
export function getAttendanceEarliestSlot(
  availableSlots: string[],
  promotion: PublicPromotion,
  selectedDate: Date,
  now = new Date(),
): string | null {
  const inWindow = availableSlots
    .filter((slot) =>
      isSlotWithinPromoWindow(slot, promotion.activeFromTime, promotion.activeToTime),
    )
    .sort()

  if (inWindow.length === 0) {
    return null
  }

  const isToday = selectedDate.toDateString() === now.toDateString()
  if (!isToday) {
    return inWindow[0]
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const futureSlots = inWindow.filter((slot) => timeToMinutes(slot) > nowMinutes)
  return futureSlots[0] ?? null
}

export function validatePromoSlotSelection(
  promotion: PublicPromotion,
  slotTime: string,
  selectedDate: Date,
  availableSlotTimes: string[],
  now = new Date(),
): string | null {
  if (!isPromoTimeConstrained(promotion)) {
    return null
  }

  if (!isSlotWithinPromoWindow(slotTime, promotion.activeFromTime, promotion.activeToTime)) {
    return 'Esta promoción está fuera del horario.'
  }

  if (promotion.type === 'time_limited') {
    return null
  }

  const dayBlock = getAttendanceDayBlockMessage(promotion, selectedDate, now)
  if (dayBlock) {
    return dayBlock
  }

  const earliest = getAttendanceEarliestSlot(availableSlotTimes, promotion, selectedDate, now)
  if (!earliest) {
    return 'No hay horas disponibles para esta promo de asistencia puntual.'
  }

  if (slotTime !== earliest) {
    const grace = promotion.arrivalWindowMinutes ?? 30
    return `Con asistencia puntual solo puedes reservar la primera hora disponible (${earliest}). Debes presentarte a esa hora; tienes ${grace} min para confirmar tu asistencia o pierdes la promo.`
  }

  return null
}

export function getPromoSlotDisabledReason(
  promotion: PublicPromotion,
  slotTime: string,
  slotAvailable: boolean,
  selectedDate: Date,
  availableSlotTimes: string[],
  now = new Date(),
): string | null {
  if (!slotAvailable) {
    return null
  }

  if (!isPromoTimeConstrained(promotion)) {
    return null
  }

  return validatePromoSlotSelection(
    promotion,
    slotTime,
    selectedDate,
    availableSlotTimes,
    now,
  )
}

export function getPromoBookingHint(promotion: PublicPromotion): string {
  const from = promotion.activeFromTime
  const to = promotion.activeToTime

  if (promotion.type === 'time_limited') {
    return `Promo activa de ${from} a ${to}. Elige una hora dentro de ese tramo.`
  }

  if (promotion.type === 'attendance') {
    const grace = promotion.arrivalWindowMinutes ?? 30
    return `Asistencia puntual de ${from} a ${to}. Solo la primera hora libre del tramo. Debes confirmar tu asistencia en el local en ${grace} min o pierdes la promo.`
  }

  return ''
}

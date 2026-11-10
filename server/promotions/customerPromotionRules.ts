// Reglas puras de uso de promociones por cliente (sin base de datos: se pueden probar).
import { BUSINESS_TIME_ZONE } from '../utils/madridDateTime.ts'

function timeToMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

function madridMinutesOfDay(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return read('hour') * 60 + read('minute')
}

/**
 * Premio por reservas o consumos con franja de canje: mensaje de error si ahora (hora de
 * España) está fuera de la franja; null si se puede reclamar. Admite franjas que cruzan la medianoche.
 */
export function claimWindowError(data: FirebaseFirestore.DocumentData, now = new Date()): string | null {
  if (data.claimWindowEnabled !== true) return null
  const from = timeToMinutes(data.activeFromTime)
  const to = timeToMinutes(data.activeToTime)
  if (from == null || to == null || from === to) return null
  const current = madridMinutesOfDay(now)
  const inside = from < to ? current >= from && current < to : current >= from || current < to
  return inside ? null : `Este premio solo se puede reclamar de ${data.activeFromTime} a ${data.activeToTime}.`
}

/** Veces que cada cliente puede usar la promo (null = sin límite). */
export function readMaxClaimsPerCustomer(data: FirebaseFirestore.DocumentData): number | null {
  const value = data.maxClaimsPerCustomer
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

export function isPromotionSoldOut(data: FirebaseFirestore.DocumentData): boolean {
  const max = typeof data.maxRedemptions === 'number' ? data.maxRedemptions : null
  const current = typeof data.currentRedemptions === 'number' ? data.currentRedemptions : 0
  return max != null && max > 0 && current >= max
}

export function customerLimitMessage(limit: number): string {
  return limit === 1
    ? 'Esta promoción solo se puede usar una vez por cliente y ya la has usado.'
    : `Esta promoción se puede usar ${limit} veces por cliente y ya las has usado todas.`
}

/** Premios ya reclamados de esta promo en el estado del cliente, sin contar la reserva actual. */
export function countClaimsForPromotion(
  claims: unknown,
  promotionId: string,
  exceptReservationId?: string,
): number {
  if (!Array.isArray(claims)) return 0
  return claims.filter((claim) => {
    if (!claim || typeof claim !== 'object') return false
    const record = claim as { promotionId?: unknown; reservationId?: unknown }
    return record.promotionId === promotionId
      && (!exceptReservationId || record.reservationId !== exceptReservationId)
  }).length
}

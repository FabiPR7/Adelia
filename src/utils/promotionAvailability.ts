import type { PublicPromotion } from '../services/publicPromotions'
import type { Reservation } from '../types'
import type { ClaimedPromotionRecord } from '../types/gamification'
import { companyAcceptsReservations } from '../data/companyReservationMode'

/** Por qué una promo no se puede usar ahora mismo (o null si se puede). */
export type PromotionLockReason =
  | 'promo_locked'
  | 'sold_out'
  | 'customer_limit'
  | 'outside_hours'
  | 'ended_today'

export type PromotionAvailabilityAction = 'reserve' | 'restaurant' | null

export interface PromotionAvailability {
  locked: boolean
  reason: PromotionLockReason | null
  /** Etiqueta corta para el candado de la tarjeta. */
  badge: string | null
  /** Título y explicación que se ven al abrir la promo. */
  title: string | null
  message: string | null
  action: PromotionAvailabilityAction
  /** "Puedes usarla 2 de 3 veces" / "Sin límite de usos" (null si no aplica). */
  usesLabel: string | null
  usesLeft: number | null
  /** Avisos que no bloquean: pocas plazas, reserva ya hecha… */
  notes: string[]
}

export interface PromotionAvailabilityContext {
  now: Date
  promoLocked: boolean
  /** Veces que este cliente ya ha usado o tiene reservada la promo. */
  customerUses: number
  /** Próxima reserva del cliente con esta promo, si la hay. */
  upcomingReservation?: Reservation | null
}

function timeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/** Franja de la promo; admite franjas que cruzan la medianoche (22:00–02:00). */
export function isWithinPromotionHours(promotion: Pick<PublicPromotion, 'activeFromTime' | 'activeToTime'>, now: Date): boolean | null {
  const from = timeToMinutes(promotion.activeFromTime ?? '')
  const to = timeToMinutes(promotion.activeToTime ?? '')
  if (from == null || to == null || from === to) return null
  const current = now.getHours() * 60 + now.getMinutes()
  return from < to ? current >= from && current < to : current >= from || current < to
}

function hasEndedForToday(promotion: Pick<PublicPromotion, 'activeFromTime' | 'activeToTime'>, now: Date): boolean {
  const from = timeToMinutes(promotion.activeFromTime ?? '')
  const to = timeToMinutes(promotion.activeToTime ?? '')
  if (from == null || to == null || from >= to) return false
  return now.getHours() * 60 + now.getMinutes() >= to
}

function isHourBound(promotion: PublicPromotion): boolean {
  return (promotion.type === 'time_limited' || promotion.type === 'attendance')
    && Boolean(promotion.activeFromTime && promotion.activeToTime)
}

function formatReservationDay(date: Date, now: Date): string {
  const sameDay = date.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `hoy a las ${time}`
  if (date.toDateString() === tomorrow.toDateString()) return `mañana a las ${time}`
  return `el ${date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${time}`
}

/** Usos de un cliente: premios ya reclamados + reservas vivas con la promo aún sin reclamar. */
export function countCustomerPromotionUses(
  promotionId: string,
  claims: ClaimedPromotionRecord[],
  reservations: Reservation[],
): number {
  const promotionClaims = claims.filter((claim) => claim.promotionId === promotionId)
  const claimedReservationIds = new Set(
    promotionClaims.map((claim) => claim.reservationId).filter((id): id is string => Boolean(id)),
  )
  const openReservations = reservations.filter(
    (reservation) =>
      reservation.promotionId === promotionId
      && reservation.status !== 'cancelled'
      && !claimedReservationIds.has(reservation.id),
  )
  return promotionClaims.length + openReservations.length
}

export function findUpcomingPromotionReservation(
  promotionId: string,
  reservations: Reservation[],
  now: Date,
): Reservation | null {
  return reservations
    .filter(
      (reservation) =>
        reservation.promotionId === promotionId
        && reservation.status !== 'cancelled'
        && reservation.startTime.getTime() >= now.getTime(),
    )
    .sort((left, right) => left.startTime.getTime() - right.startTime.getTime())[0] ?? null
}

/**
 * Estado de una promo puntual (horario / asistencia / descuento suelto) para un cliente.
 * Las escaleras de fidelidad tienen su propio estado en el mapa de premios.
 */
export function getPromotionAvailability(
  promotion: PublicPromotion,
  context: PromotionAvailabilityContext,
): PromotionAvailability {
  const { now, promoLocked, customerUses, upcomingReservation } = context
  const notes: string[] = []
  const limit = promotion.maxClaimsPerCustomer != null && promotion.maxClaimsPerCustomer > 0
    ? promotion.maxClaimsPerCustomer
    : null
  const usesLeft = limit != null ? Math.max(0, limit - customerUses) : null
  const usesLabel = promotion.type === 'reservation_ladder'
    ? null
    : limit != null
      ? `Te ${usesLeft === 1 ? 'queda' : 'quedan'} ${usesLeft} de ${limit} ${limit === 1 ? 'uso' : 'usos'}`
      : 'Sin límite de usos'
  const spotsLeft = promotion.maxRedemptions != null && promotion.maxRedemptions > 0
    ? Math.max(0, promotion.maxRedemptions - (promotion.currentRedemptions ?? 0))
    : null
  const canReserve = companyAcceptsReservations(promotion.reservationMode ?? 'optional')
  const hours = isHourBound(promotion) ? `de ${promotion.activeFromTime} a ${promotion.activeToTime}` : ''

  const locked = (
    reason: PromotionLockReason,
    badge: string,
    title: string,
    message: string,
    action: PromotionAvailabilityAction,
  ): PromotionAvailability => ({
    locked: true,
    reason,
    badge,
    title,
    message,
    action,
    usesLabel,
    usesLeft,
    notes,
  })

  if (upcomingReservation) {
    notes.push(`Ya tienes una reserva con esta promo ${formatReservationDay(upcomingReservation.startTime, now)}.`)
  }
  if (spotsLeft != null && spotsLeft > 0 && spotsLeft <= 5) {
    notes.push(spotsLeft === 1 ? 'Queda la última plaza.' : `Quedan ${spotsLeft} plazas.`)
  }

  if (promoLocked) {
    return locked(
      'promo_locked',
      'Bloqueada',
      'Tus promociones están bloqueadas',
      'Has cancelado 5 reservas o más, así que no puedes usar promociones por ahora. Las reservas normales siguen disponibles.',
      'restaurant',
    )
  }

  if (spotsLeft === 0) {
    return locked(
      'sold_out',
      'Agotada',
      'Promoción agotada',
      `Ya se han usado las ${promotion.maxRedemptions} plazas de esta promoción. Mira las demás promos del local.`,
      'restaurant',
    )
  }

  if (limit != null && customerUses >= limit) {
    return locked(
      'customer_limit',
      'Límite alcanzado',
      'Ya has usado el máximo',
      limit === 1
        ? 'Esta promoción solo se puede usar una vez por cliente y ya la has usado.'
        : `Esta promoción se puede usar ${limit} veces por cliente y ya las has usado todas.`,
      'restaurant',
    )
  }

  if (isHourBound(promotion) && isWithinPromotionHours(promotion, now) === false) {
    const howTo = canReserve
      ? 'Si quieres, reserva ya una mesa para esa franja y la tendrás.'
      : 'Este local no hace reservas: ve en ese horario y enséñala en el local.'
    if (promotion.type === 'attendance' && hasEndedForToday(promotion, now)) {
      return locked(
        'ended_today',
        promotion.activeFromTime,
        'Hoy ya ha terminado',
        `Esta promoción solo vale ${hours}. Vuelve mañana en esa franja. ${howTo}`,
        canReserve ? 'reserve' : 'restaurant',
      )
    }
    return locked(
      'outside_hours',
      `${promotion.activeFromTime}–${promotion.activeToTime}`,
      'Ahora no está disponible',
      `Esta promoción solo se puede usar ${hours}. ${howTo}`,
      canReserve ? 'reserve' : 'restaurant',
    )
  }

  return {
    locked: false,
    reason: null,
    badge: null,
    title: null,
    message: null,
    action: null,
    usesLabel,
    usesLeft,
    notes,
  }
}

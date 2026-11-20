// Estado de una promo para un cliente (disponible, bloqueada, agotada, límite, fuera de
// horario). Se decide SOLO aquí, en hora de España; la web y la app lo reciben hecho por
// GET /api/customer/promotions/availability y no lo recalculan.
import { BUSINESS_TIME_ZONE, madridYmd } from '../utils/madridDateTime.ts'

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
  /** «Te quedan 2 de 3 usos» / «Sin límite de usos» (null si no aplica). */
  usesLabel: string | null
  usesLeft: number | null
  /** Avisos que no bloquean: pocas plazas, reserva ya hecha… */
  notes: string[]
}

/** Lo que hace falta de la promo (el mismo formato que la lista pública). */
export interface PromotionForAvailability {
  type: string
  activeFromTime: string
  activeToTime: string
  maxRedemptions: number | null
  currentRedemptions: number
  maxClaimsPerCustomer: number | null
  reservationMode: 'required' | 'optional' | 'none'
}

export interface PromotionAvailabilityContext {
  now: Date
  promoLocked: boolean
  /** Veces que este cliente ya ha usado o tiene reservada la promo. */
  customerUses: number
  /** Inicio de la próxima reserva del cliente con esta promo, si la hay. */
  upcomingReservationStart?: Date | null
}

function timeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
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

/** Franja de la promo en hora de España; admite franjas que cruzan la medianoche. */
export function isWithinPromotionHours(
  promotion: Pick<PromotionForAvailability, 'activeFromTime' | 'activeToTime'>,
  now: Date,
): boolean | null {
  const from = timeToMinutes(promotion.activeFromTime ?? '')
  const to = timeToMinutes(promotion.activeToTime ?? '')
  if (from == null || to == null || from === to) return null
  const current = madridMinutes(now)
  return from < to ? current >= from && current < to : current >= from || current < to
}

function hasEndedForToday(promotion: PromotionForAvailability, now: Date): boolean {
  const from = timeToMinutes(promotion.activeFromTime ?? '')
  const to = timeToMinutes(promotion.activeToTime ?? '')
  if (from == null || to == null || from >= to) return false
  return madridMinutes(now) >= to
}

function isHourBound(promotion: PromotionForAvailability): boolean {
  return (promotion.type === 'time_limited' || promotion.type === 'attendance')
    && Boolean(promotion.activeFromTime && promotion.activeToTime)
}

function formatReservationDay(date: Date, now: Date): string {
  const time = new Intl.DateTimeFormat('es-ES', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
  const day = madridYmd(date)
  if (day === madridYmd(now)) return `hoy a las ${time}`
  if (day === madridYmd(new Date(now.getTime() + 24 * 60 * 60 * 1000))) return `mañana a las ${time}`
  const label = new Intl.DateTimeFormat('es-ES', {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
  return `el ${label} a las ${time}`
}

export function getPromotionAvailability(
  promotion: PromotionForAvailability,
  context: PromotionAvailabilityContext,
): PromotionAvailability {
  const { now, promoLocked, customerUses, upcomingReservationStart } = context
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
  const canReserve = promotion.reservationMode !== 'none'
  const hours = isHourBound(promotion) ? `de ${promotion.activeFromTime} a ${promotion.activeToTime}` : ''

  const locked = (
    reason: PromotionLockReason,
    badge: string,
    title: string,
    message: string,
    action: PromotionAvailabilityAction,
  ): PromotionAvailability => ({ locked: true, reason, badge, title, message, action, usesLabel, usesLeft, notes })

  if (upcomingReservationStart) {
    notes.push(`Ya tienes una reserva con esta promo ${formatReservationDay(upcomingReservationStart, now)}.`)
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

  return { locked: false, reason: null, badge: null, title: null, message: null, action: null, usesLabel, usesLeft, notes }
}

/** Usos de un cliente: premios ya reclamados + reservas vivas con la promo aún sin reclamar. */
export function countCustomerPromotionUses(
  promotionId: string,
  claims: Array<{ promotionId?: unknown; reservationId?: unknown }>,
  reservations: Array<{ id: string; promotionId?: unknown; status?: unknown }>,
): number {
  const promotionClaims = claims.filter((claim) => claim.promotionId === promotionId)
  const claimedReservationIds = new Set(
    promotionClaims.map((claim) => claim.reservationId).filter((id): id is string => typeof id === 'string' && id.length > 0),
  )
  const open = reservations.filter(
    (reservation) =>
      reservation.promotionId === promotionId
      && reservation.status !== 'cancelled'
      && !claimedReservationIds.has(reservation.id),
  )
  return promotionClaims.length + open.length
}

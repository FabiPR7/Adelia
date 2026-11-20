/**
 * Reglas de reserva de un local tal como las decide el servidor
 * (server/reservations/bookingRules.ts). La web no las calcula: solo las usa.
 */
export interface BookingDepositRule {
  fromPax: number
  perGuestCents: number
  cancellationHours: number | null
}

export interface BookingRules {
  canReserve: boolean
  reservationRequired: boolean
  walkInAllowed: boolean
  completePath: 'choose' | 'reserve' | 'consume'
  ctaLabel: string
  note: string
  deposit: BookingDepositRule | null
  depositsReady: boolean
}

/** Mientras llega la respuesta del servidor (o si es una respuesta antigua en caché). */
export const BOOKING_RULES_UNKNOWN: BookingRules = {
  canReserve: false,
  reservationRequired: false,
  walkInAllowed: true,
  completePath: 'choose',
  ctaLabel: 'Sin reservas',
  note: '',
  deposit: null,
  depositsReady: false,
}

/** Fianza para estos comensales según la regla del servidor (0 si no hay). */
export function bookingDepositCents(rules: BookingRules | null | undefined, pax: number): number {
  const rule = rules?.deposit
  if (!rule || pax < rule.fromPax) return 0
  return rule.perGuestCents * pax
}

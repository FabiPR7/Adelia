import type { PublicPromotion } from '../services/publicPromotions'
import type { AppUser } from '../types'
import type { User } from 'firebase/auth'


export function isPromoTimeConstrained(promotion: PublicPromotion): boolean {
  return promotion.type === 'time_limited' || promotion.type === 'attendance'
}

export function canRedeemPromotionAsCustomer(
  user: User | null | undefined,
  profile: AppUser | null | undefined,
): boolean {
  return Boolean(user && profile?.role === 'customer')
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

export function buildPromotionLandingPath(companySlug: string, promotionId: string): string {
  return `/reservar/${encodeURIComponent(companySlug)}/promo/${encodeURIComponent(promotionId)}`
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

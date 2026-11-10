import { COMPANY_PLANS_CONTACT_EMAIL } from './companyPlans'

/**
 * Oferta de lanzamiento: un pago único de 99,99 € da el plan Local para siempre.
 * Solo se puede comprar hasta el 1 de enero de 2027 (hora de España).
 */
export const LIFETIME_OFFER = {
  priceLabel: '99,99',
  planName: 'Local',
  /** 1/1/2027 a las 00:00 en Madrid (invierno, UTC+1). */
  endsAt: new Date('2027-01-01T00:00:00+01:00'),
  /**
   * Enlace de compra del producto de pago único en Lemon Squeezy. Mientras esté
   * vacío, el botón abre un correo para reservar la oferta.
   */
  checkoutUrl: (import.meta.env.VITE_LEMONSQUEEZY_LIFETIME_CHECKOUT_URL as string | undefined)?.trim() ?? '',
} as const

export function isLifetimeOfferActive(now = new Date()): boolean {
  return now.getTime() < LIFETIME_OFFER.endsAt.getTime()
}

export function lifetimeOfferTimeLeft(now = new Date()): { days: number; hours: number; minutes: number } {
  const ms = Math.max(0, LIFETIME_OFFER.endsAt.getTime() - now.getTime())
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
  }
}

/**
 * Añade el id del restaurante al checkout de Lemon Squeezy (`checkout[custom]`)
 * para que el pago se asigne a esa cuenta y no dependa solo del correo.
 */
export function withCompanyCheckoutData(url: string, companyId: string | null | undefined): string {
  if (!url || !companyId) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}checkout[custom][company_id]=${encodeURIComponent(companyId)}`
}

export function lifetimeOfferHref(companyId: string | null | undefined): string {
  if (LIFETIME_OFFER.checkoutUrl) {
    return withCompanyCheckoutData(LIFETIME_OFFER.checkoutUrl, companyId)
  }
  const subject = 'Quiero el plan Local de por vida (99,99 €)'
  const body = 'Hola, quiero reservar la oferta de lanzamiento: plan Local de por vida por 99,99 € en un único pago.'
  return `mailto:${COMPANY_PLANS_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

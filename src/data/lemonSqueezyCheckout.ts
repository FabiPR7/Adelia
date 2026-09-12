import type { CompanyPlanId } from './companyPlans'

/**
 * Lemon Squeezy sustituye al checkout de Stripe para el pago mensual/anual de
 * los planes de restaurante.
 *
 * El producto tiene 4 variantes (Sala/Local × mensual/anual). Lemon Squeezy NO
 * permite un enlace por variante ni preseleccionar con `?variant=`, así que se
 * usa un único checkout: el cliente elige plan y periodo en la lista de LS. El
 * toggle Mensual/Anual de la web es informativo (precio y descuento); lo que
 * cuenta es lo que marque en Lemon Squeezy, y el webhook nos dice qué eligió.
 */
export const LEMONSQUEEZY_STORE_ID = '465870'

export type BillingPeriod = 'monthly' | 'annual'

/** Checkout único del producto de planes (muestra las 4 variantes). */
export const LEMONSQUEEZY_CHECKOUT_URL =
  'https://adelia.lemonsqueezy.com/checkout/buy/07cd5eb1-e81d-405d-b677-2790751266e4'

/**
 * Portal de cliente genérico de Lemon Squeezy: el restaurante entra con el
 * correo del pago y recibe un enlace mágico para gestionar/cancelar su
 * suscripción y ver facturas. Fallback cuando no tenemos guardada la URL de
 * portal concreta de esa suscripción (la del webhook `subscription_created`).
 */
export const LEMONSQUEEZY_CUSTOMER_PORTAL_URL = 'https://app.lemonsqueezy.com/my-orders'

/**
 * IDs de variante numéricos que llegan en los webhooks de Lemon Squeezy.
 * (Referencia — el mapeo real que usa el servidor está en
 * `server/lemonsqueezy/config.ts`.)
 */
export const LEMONSQUEEZY_VARIANT_IDS: Record<'basic' | 'premium', Record<BillingPeriod, string>> = {
  basic: { monthly: '2088081', annual: '2088312' },
  premium: { monthly: '2088306', annual: '2089103' },
}

export function lemonSqueezyCheckoutUrl(
  planId: CompanyPlanId,
  _period: BillingPeriod = 'monthly',
): string | null {
  if (planId !== 'basic' && planId !== 'premium') {
    return null
  }
  return LEMONSQUEEZY_CHECKOUT_URL
}

/** Segmento `?plan=` del alta (`/empresa/alta`) para cada plan de pago. */
export const PLAN_SIGNUP_SLUG = {
  basic: 'sala',
  premium: 'local',
} as const

/** Traduce el `?plan=` del alta a un plan interno. */
export function planIdFromSignupSlug(
  value: string | null,
): 'free' | 'basic' | 'premium' | null {
  if (value === 'sala' || value === 'basic') return 'basic'
  if (value === 'local' || value === 'premium') return 'premium'
  if (value === 'mesa' || value === 'free') return 'free'
  return null
}

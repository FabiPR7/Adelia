/**
 * Lemon Squeezy sustituye a Stripe en el pago mensual de los planes de
 * restaurante. Un producto ("Plan Adelia") con dos variantes.
 * Mantener alineado con `src/data/lemonSqueezyCheckout.ts`.
 */

export type LemonPlanId = 'basic' | 'premium'
export type LemonBillingPeriod = 'monthly' | 'annual'

interface LemonVariant {
  plan: LemonPlanId
  period: LemonBillingPeriod
}

/** variant_id de Lemon Squeezy → plan + periodo interno. */
export const LEMONSQUEEZY_VARIANTS: Record<string, LemonVariant> = {
  '2088081': { plan: 'basic', period: 'monthly' }, // Sala · 39,99 €/mes
  '2088312': { plan: 'basic', period: 'annual' }, // Sala · 385,99 €/año (−20%)
  '2088306': { plan: 'premium', period: 'monthly' }, // Local · 59,99 €/mes (3 meses prueba)
  '2089103': { plan: 'premium', period: 'annual' }, // Local · 579,99 €/año (−20%)
}

export function lemonVariant(variantId: unknown): LemonVariant | null {
  return LEMONSQUEEZY_VARIANTS[String(variantId ?? '')] ?? null
}

export function planFromLemonVariant(variantId: unknown): LemonPlanId | null {
  return lemonVariant(variantId)?.plan ?? null
}

export function getLemonSqueezyWebhookSecret(): string {
  return process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? ''
}

export function isLemonSqueezyConfigured(): boolean {
  return getLemonSqueezyWebhookSecret().length > 0
}

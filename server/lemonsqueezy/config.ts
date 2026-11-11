/**
 * Lemon Squeezy sustituye a Stripe en el pago mensual de los planes de
 * restaurante. Un producto ("Plan Adelia") con dos variantes.
 * Mantener alineado con `src/data/lemonSqueezyCheckout.ts`.
 */

import { getRemoteCatalog } from '../data/remoteCatalog.ts'

export type LemonPlanId = 'basic' | 'premium'
export type LemonBillingPeriod = 'monthly' | 'annual'

interface LemonVariant {
  plan: LemonPlanId
  period: LemonBillingPeriod
}

/**
 * Respaldo de variant_id de Lemon Squeezy → plan + periodo. La fuente de verdad es
 * `appConfig/billing.variants` en Firestore: así pasar de modo test a live (IDs
 * distintos) no exige desplegar.
 */
const DEFAULT_LEMONSQUEEZY_VARIANTS: Record<string, LemonVariant> = {
  '2088081': { plan: 'basic', period: 'monthly' },
  '2088312': { plan: 'basic', period: 'annual' },
  '2088306': { plan: 'premium', period: 'monthly' },
  '2089103': { plan: 'premium', period: 'annual' },
}

export function lemonVariant(variantId: unknown): LemonVariant | null {
  const variants = getRemoteCatalog().billing.variants ?? DEFAULT_LEMONSQUEEZY_VARIANTS
  return variants[String(variantId ?? '')] ?? null
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

/** Solo para probar el flujo por túnel: en producción las compras de prueba se ignoran. */
export function allowLemonSqueezyTestEvents(): boolean {
  return process.env.LEMONSQUEEZY_ALLOW_TEST_EVENTS === 'true'
}

export function getLemonSqueezyApiKey(): string {
  return process.env.LEMONSQUEEZY_API_KEY?.trim() ?? ''
}

/** Cancela la suscripción. Devuelve `false` si no hay API key para hacerlo. */
export async function cancelLemonSubscription(subscriptionId: string): Promise<boolean> {
  const apiKey = getLemonSqueezyApiKey()
  if (!apiKey) {
    return false
  }
  const response = await fetch(
    `https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: 'DELETE',
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${apiKey}`,
      },
    },
  )
  // 404: ya no existe en Lemon Squeezy, así que tampoco se cobra.
  if (!response.ok && response.status !== 404) {
    throw new Error(`Lemon Squeezy respondió ${response.status} al cancelar la suscripción.`)
  }
  return true
}

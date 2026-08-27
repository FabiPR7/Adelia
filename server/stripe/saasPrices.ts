import type Stripe from 'stripe'
import {
  SAAS_CHECKOUT_META,
  SAAS_CHECKOUT_PLANS,
  type SaasCheckoutPlanId,
} from './saasCatalog.ts'

export async function getOrCreateSaasPrice(
  stripe: Stripe,
  planId: SaasCheckoutPlanId,
): Promise<string> {
  const spec = SAAS_CHECKOUT_PLANS[planId]
  const existing = await stripe.prices.list({
    lookup_keys: [spec.lookupKey],
    active: true,
    limit: 1,
  })

  if (existing.data[0]?.id) {
    return existing.data[0].id
  }

  const product = await stripe.products.create({
    name: spec.productName,
    description: `Suscripción mensual al plan ${spec.name} de Adelia.`,
    metadata: {
      type: SAAS_CHECKOUT_META,
      planId,
    },
  })

  const price = await stripe.prices.create({
    product: product.id,
    currency: 'eur',
    unit_amount: spec.amountCents,
    recurring: { interval: 'month' },
    lookup_key: spec.lookupKey,
    transfer_lookup_key: true,
    metadata: {
      type: SAAS_CHECKOUT_META,
      planId,
    },
  })

  return price.id
}

/** Precios SaaS de Adelia. Cobro a la cuenta plataforma (no Connect).
 *  Mantener alineado con `src/data/companyPlans.ts` (Sala 39 €, Local 59 €). */
export const SAAS_CHECKOUT_META = 'adelia_saas_plan'

export const SAAS_CHECKOUT_PLAN_IDS = ['basic', 'premium'] as const

export type SaasCheckoutPlanId = (typeof SAAS_CHECKOUT_PLAN_IDS)[number]

export interface SaasCheckoutPlan {
  planId: SaasCheckoutPlanId
  name: string
  productName: string
  amountCents: number
  lookupKey: string
}

export const SAAS_CHECKOUT_PLANS: Record<SaasCheckoutPlanId, SaasCheckoutPlan> = {
  basic: {
    planId: 'basic',
    name: 'Sala',
    productName: 'Adelia Sala',
    amountCents: 3900,
    lookupKey: 'adelia_plan_sala_monthly',
  },
  premium: {
    planId: 'premium',
    name: 'Local',
    productName: 'Adelia Local',
    amountCents: 5900,
    lookupKey: 'adelia_plan_local_monthly',
  },
}

export function parseSaasCheckoutPlanId(value: unknown): SaasCheckoutPlanId | null {
  return SAAS_CHECKOUT_PLAN_IDS.includes(value as SaasCheckoutPlanId)
    ? (value as SaasCheckoutPlanId)
    : null
}

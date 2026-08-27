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

export const SAAS_PLAN_HIGHLIGHTS: Record<SaasCheckoutPlanId, string[]> = {
  basic: [
    'Hasta 15 mesas y 1 mapa activo: el cliente elige mesa al reservar',
    '3 cartas digitales con fotografías',
    'Hasta 3 promociones Oferta',
    'Fianzas de reserva e informes de clientes',
    'QR de carta y reservas con la imagen de tu local',
  ],
  premium: [
    'Hasta 50 mesas y 5 mapas activos',
    'Hasta 5 cartas, digitales o en PDF',
    'Promociones de cada tipo: Oferta, tiempo limitado y asistencia',
    'Todos los informes y mayor visibilidad en Adelia',
    'Compite: visibilidad, descuentos de la app y premios',
  ],
}

export function parseSaasCheckoutPlanId(value: unknown): SaasCheckoutPlanId | null {
  return SAAS_CHECKOUT_PLAN_IDS.includes(value as SaasCheckoutPlanId)
    ? (value as SaasCheckoutPlanId)
    : null
}

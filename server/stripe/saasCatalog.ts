import { getRemoteCatalog } from '../data/remoteCatalog.ts'

/** Precios SaaS de Adelia. Cobro a la cuenta plataforma (no Connect).
 *  Nombre y precio salen de `planCatalog` en Firestore (los mismos que ve la web);
 *  los valores del código solo son el respaldo si la colección está vacía. */
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

const DEFAULT_PLAN_SPECS: Record<SaasCheckoutPlanId, { name: string; amountCents: number }> = {
  basic: { name: 'Sala', amountCents: 3999 },
  premium: { name: 'Local', amountCents: 5999 },
}

function remoteAmountCents(planId: SaasCheckoutPlanId): number {
  const price = getRemoteCatalog().plans?.get(planId)?.priceMonthly
  return typeof price === 'number' && price > 0
    ? Math.round(price * 100)
    : DEFAULT_PLAN_SPECS[planId].amountCents
}

function remoteName(planId: SaasCheckoutPlanId): string {
  return getRemoteCatalog().plans?.get(planId)?.name ?? DEFAULT_PLAN_SPECS[planId].name
}

function planSpec(planId: SaasCheckoutPlanId, lookupKey: string): SaasCheckoutPlan {
  return {
    planId,
    get name() { return remoteName(planId) },
    get productName() { return `Adelia ${remoteName(planId)}` },
    get amountCents() { return remoteAmountCents(planId) },
    lookupKey,
  }
}

export const SAAS_CHECKOUT_PLANS: Record<SaasCheckoutPlanId, SaasCheckoutPlan> = {
  basic: planSpec('basic', 'adelia_plan_sala_monthly'),
  premium: planSpec('premium', 'adelia_plan_local_monthly'),
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

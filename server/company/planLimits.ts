import { getRemoteCatalog, type RemoteCapValue } from '../data/remoteCatalog.ts'

export type StoredPlanId = 'free' | 'basic' | 'premium' | 'premium_plus'

const PROMO_TYPES = ['reservation_ladder', 'time_limited', 'attendance'] as const

const PROMO_TYPE_CAPABILITY: Record<string, string> = {
  reservation_ladder: 'promos_offer',
  time_limited: 'promos_limited',
  attendance: 'promos_attendance',
}

/**
 * Capacidades por plan. La fuente de verdad es `planCatalog/{plan}.caps` en
 * Firestore (el mismo documento que pinta la web); esta tabla solo es el
 * respaldo cuando la colección está vacía o no responde.
 */
const DEFAULT_CAPS: Record<StoredPlanId, Record<string, RemoteCapValue>> = {
  free: { menus: 1, menu_photos: false, menu_pdf: false, active_maps: false, deposits: false, promos_offer: false, promos_limited: false, promos_attendance: false },
  basic: { menus: 3, menu_photos: true, menu_pdf: false, active_maps: 1, deposits: true, promos_offer: 3, promos_limited: false, promos_attendance: false },
  premium: { menus: 5, menu_photos: true, menu_pdf: true, active_maps: 5, deposits: true, promos_offer: 10, promos_limited: 10, promos_attendance: 10 },
  premium_plus: { menus: 5, menu_photos: true, menu_pdf: true, active_maps: 5, deposits: true, promos_offer: 10, promos_limited: 10, promos_attendance: 10 },
}

export function parseStoredPlanId(value: unknown): StoredPlanId {
  if (value === 'basic' || value === 'premium' || value === 'premium_plus') {
    return value
  }
  return 'free'
}

function capability(planId: StoredPlanId, capabilityId: string): RemoteCapValue {
  const remote = getRemoteCatalog().plans?.get(planId)?.caps[capabilityId]
  return remote ?? DEFAULT_CAPS[planId][capabilityId] ?? false
}

/** Tope numérico de una capacidad: `null` = sin límite, `0` = no incluida. */
function capabilityMax(planId: StoredPlanId, capabilityId: string): number | null {
  const value = capability(planId, capabilityId)
  if (value === true || value === 'unlimited' || value === 'list') {
    return null
  }
  return typeof value === 'number' && value > 0 ? value : 0
}

export function planAllowsPromotions(planId: StoredPlanId): boolean {
  return PROMO_TYPES.some((type) => planAllowsPromoType(planId, type))
}

export function planAllowsPromoType(planId: StoredPlanId, type: string): boolean {
  const max = planMaxPromosOfType(planId, type)
  return max == null || max > 0
}

export function planMaxPromosOfType(planId: StoredPlanId, type: string): number | null {
  const capabilityId = PROMO_TYPE_CAPABILITY[type]
  return capabilityId ? capabilityMax(planId, capabilityId) : 0
}

/** Deja solo las promociones que el plan permite publicar, por tipo y cantidad. */
export function clampPromotionsToPlan<T>(
  promotions: T[],
  planId: StoredPlanId,
  typeOf: (promotion: T) => unknown,
): T[] {
  const countByType = new Map<string, number>()
  return promotions.filter((promotion) => {
    const type = String(typeOf(promotion) ?? '')
    const count = (countByType.get(type) ?? 0) + 1
    countByType.set(type, count)
    const max = planMaxPromosOfType(planId, type)
    return max == null || count <= max
  })
}

export function planPromoTypes(): readonly string[] {
  return PROMO_TYPES
}

export function planMaxMenus(planId: StoredPlanId): number | null {
  return capabilityMax(planId, 'menus')
}

export function planAllowsMenuPdf(planId: StoredPlanId): boolean {
  return capabilityMax(planId, 'menu_pdf') !== 0
}

export function planAllowsMenuGrid(planId: StoredPlanId): boolean {
  return capabilityMax(planId, 'menu_photos') !== 0
}

export function planMaxActiveMaps(planId: StoredPlanId): number | null {
  return capabilityMax(planId, 'active_maps')
}

export function planAllowsDeposits(planId: StoredPlanId): boolean {
  return capabilityMax(planId, 'deposits') !== 0
}

export function clampEnabledMaps<T extends { enabled?: unknown }>(plans: T[], planId: StoredPlanId): T[] {
  const max = planMaxActiveMaps(planId)
  if (max === 0) {
    return plans.map((plan) => ({ ...plan, enabled: false }))
  }
  if (max == null) {
    return plans
  }

  let kept = 0
  return plans.map((plan) => {
    if (plan.enabled !== true) {
      return plan
    }
    kept += 1
    return kept > max ? { ...plan, enabled: false } : plan
  })
}

/** Mesas reservables del plan (`null` = sin límite). Las que sobran se guardan pero no se reservan. */
export function planMaxTables(planId: StoredPlanId): number | null {
  return capabilityMax(planId, 'tables')
}

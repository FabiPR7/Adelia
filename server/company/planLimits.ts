export type StoredPlanId = 'free' | 'basic' | 'premium' | 'premium_plus'

const PROMO_TYPES = ['reservation_ladder', 'time_limited', 'attendance'] as const

export function parseStoredPlanId(value: unknown): StoredPlanId {
  if (value === 'basic' || value === 'premium' || value === 'premium_plus') {
    return value
  }
  return 'free'
}

export function planAllowsPromotions(planId: StoredPlanId): boolean {
  return planId !== 'free'
}

export function planAllowsPromoType(planId: StoredPlanId, type: string): boolean {
  const max = planMaxPromosOfType(planId, type)
  return max == null || max > 0
}

export function planMaxPromosOfType(planId: StoredPlanId, type: string): number | null {
  if (planId === 'free') {
    return 0
  }

  if (type === 'reservation_ladder') {
    return planId === 'basic' ? 3 : 5
  }

  if (type === 'time_limited' || type === 'attendance') {
    return planId === 'premium' || planId === 'premium_plus' ? 5 : 0
  }

  return 0
}

export function planPromoTypes(): readonly string[] {
  return PROMO_TYPES
}

export function planMaxMenus(planId: StoredPlanId): number | null {
  if (planId === 'free') {
    return 1
  }
  if (planId === 'basic') {
    return 3
  }
  return 5
}

export function planAllowsMenuPdf(planId: StoredPlanId): boolean {
  return planId === 'premium' || planId === 'premium_plus'
}

export function planAllowsMenuGrid(planId: StoredPlanId): boolean {
  return planId !== 'free'
}

export function planMaxActiveMaps(planId: StoredPlanId): number | null {
  if (planId === 'free') {
    return 0
  }
  if (planId === 'basic') {
    return 1
  }
  return 5
}

export function planAllowsDeposits(planId: StoredPlanId): boolean {
  return planId !== 'free'
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

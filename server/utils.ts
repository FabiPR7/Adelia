const AUTH_DOMAIN = 'adelia.app'

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function slugToAuthEmail(slug: string): string {
  return `${slug}@${AUTH_DOMAIN}`
}

export function defaultSchedule() {
  const openDay = { open: '13:00', close: '23:00', active: true }
  const closedDay = { open: '', close: '', active: false }

  return {
    monday: { ...openDay },
    tuesday: { ...openDay },
    wednesday: { ...closedDay },
    thursday: { ...openDay },
    friday: { open: '13:00', close: '23:30', active: true },
    saturday: { open: '13:00', close: '23:30', active: true },
    sunday: { open: '13:00', close: '16:00', active: true },
  }
}

export function mapCompanyDoc(id: string, data: FirebaseFirestore.DocumentData) {
  const planId =
    data.planId === 'basic' || data.planId === 'premium' || data.planId === 'premium_plus'
      ? data.planId
      : 'free'
  const planBilling =
    planId === 'free' ? null : data.planBilling === 'perpetual' ? 'perpetual' : 'monthly'

  return {
    id,
    name: data.name as string,
    slug: data.slug as string,
    ownerUid: data.ownerUid as string,
    phone: data.phone as string,
    website: (data.website as string) ?? '',
    location: data.location as string,
    timeSlotMinutes: (data.timeSlotMinutes as number) ?? 120,
    planId,
    planBilling,
    planStartedAt: data.planStartedAt?.toDate?.()?.toISOString?.() ?? null,
    schedule: data.schedule,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
  }
}

export function parseCompanyReservationMode(value: unknown): 'required' | 'optional' | 'none' {
  return value === 'required' || value === 'none' ? value : 'optional'
}

export function companyAcceptsReservations(mode: unknown): boolean {
  return parseCompanyReservationMode(mode) !== 'none'
}

export function parseCompanyPlanId(
  value: unknown,
): 'free' | 'basic' | 'premium' | 'premium_plus' {
  return value === 'basic' || value === 'premium' || value === 'premium_plus' ? value : 'free'
}

export function companySubscriptionFields(input: {
  currentPlanId?: unknown
  hasStartedAt?: boolean
  nextPlanId?: unknown
  nextBilling?: unknown
  nextStartedAt?: unknown
}): {
  planId: 'free' | 'basic' | 'premium' | 'premium_plus'
  planBilling: 'monthly' | 'perpetual' | null
  planStartedAt: 'now' | 'keep' | 'clear' | Date
} {
  const planId = parseCompanyPlanId(input.nextPlanId)
  if (planId === 'free') {
    return { planId: 'free', planBilling: null, planStartedAt: 'clear' }
  }

  const currentPlanId = parseCompanyPlanId(input.currentPlanId)
  const planBilling = input.nextBilling === 'perpetual' ? 'perpetual' : 'monthly'
  if (typeof input.nextStartedAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(input.nextStartedAt)) {
    const date = new Date(input.nextStartedAt)
    if (!Number.isNaN(date.getTime())) {
      return { planId, planBilling, planStartedAt: date }
    }
  }

  return {
    planId,
    planBilling,
    planStartedAt: planId !== currentPlanId ? 'now' : 'keep',
  }
}

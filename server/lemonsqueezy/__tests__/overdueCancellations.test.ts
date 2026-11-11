import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Doc = Record<string, unknown>

const store = vi.hoisted(() => ({
  companies: new Map<string, Record<string, unknown>>(),
}))

vi.mock('../../firebase-admin.ts', () => {
  const companyRef = (id: string) => ({
    set: async (data: Doc) => {
      store.companies.set(id, { ...store.companies.get(id), ...data })
    },
  })
  return {
    adminDb: {
      collection: () => ({
        where: (_field: string, _op: string, cutoff: { toMillis: () => number }) => ({
          limit: () => ({
            get: async () => ({
              docs: [...store.companies.entries()]
                .filter(([, data]) => (data.pendingPlanAt as { toMillis: () => number }).toMillis() < cutoff.toMillis())
                .map(([id, data]) => ({ id, data: () => data, ref: companyRef(id) })),
            }),
          }),
        }),
      }),
    },
  }
})

vi.mock('../../company/enforcePlanLimits.ts', () => ({
  applyPlanFeatureLimits: vi.fn(async () => undefined),
}))

const sync = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('../syncCompany.ts', () => ({
  syncCompanyFromLemonSubscription: sync,
  isPerpetualCompany: (data: Doc) => data.planBilling === 'perpetual' && data.planId !== 'free',
}))

import { Timestamp } from 'firebase-admin/firestore'
import { applyPlanFeatureLimits } from '../../company/enforcePlanLimits.ts'
import { OVERDUE_GRACE_MS, resolveOverdueLemonCancellations } from '../overdueCancellations.ts'

const NOW = new Date('2026-12-20T03:00:00Z')
const longAgo = Timestamp.fromMillis(NOW.getTime() - OVERDUE_GRACE_MS - 1000)
const yesterday = Timestamp.fromMillis(NOW.getTime() - 24 * 60 * 60 * 1000)

describe('respaldo de cancelaciones vencidas', () => {
  beforeEach(() => {
    store.companies.clear()
    sync.mockClear()
    vi.mocked(applyPlanFeatureLimits).mockClear()
    vi.stubEnv('LEMONSQUEEZY_API_KEY', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sin API key pasa a gratis una cancelación vencida hace más de 3 días', async () => {
    store.companies.set('c1', { planId: 'premium', pendingPlanId: 'free', pendingPlanAt: longAgo, lemonSqueezySubscriptionId: 'sub-1' })

    expect(await resolveOverdueLemonCancellations(NOW)).toBe(1)
    expect(store.companies.get('c1')?.planId).toBe('free')
    expect(applyPlanFeatureLimits).toHaveBeenCalledWith('c1', 'free')
  })

  it('respeta el margen: si el periodo acabó ayer, espera al aviso de Lemon', async () => {
    store.companies.set('c1', { planId: 'premium', pendingPlanId: 'free', pendingPlanAt: yesterday, lemonSqueezySubscriptionId: 'sub-1' })

    expect(await resolveOverdueLemonCancellations(NOW)).toBe(0)
    expect(store.companies.get('c1')?.planId).toBe('premium')
  })

  it('no toca planes de por vida, cambios a otro plan ni altas antiguas de Stripe', async () => {
    store.companies.set('vida', { planId: 'premium', planBilling: 'perpetual', pendingPlanId: 'free', pendingPlanAt: longAgo, lemonSqueezySubscriptionId: 'sub-1' })
    store.companies.set('bajada', { planId: 'premium', pendingPlanId: 'basic', pendingPlanAt: longAgo, lemonSqueezySubscriptionId: 'sub-2' })
    store.companies.set('stripe', { planId: 'premium', pendingPlanId: 'free', pendingPlanAt: longAgo })

    expect(await resolveOverdueLemonCancellations(NOW)).toBe(0)
    for (const id of ['vida', 'bajada', 'stripe']) {
      expect(store.companies.get(id)?.planId).toBe('premium')
    }
  })

  it('con API key manda el estado real de Lemon (por si la reanudó)', async () => {
    vi.stubEnv('LEMONSQUEEZY_API_KEY', 'clave')
    const subscription = { id: 'sub-1', attributes: { status: 'active' } }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: subscription }), { status: 200 })))
    store.companies.set('c1', { planId: 'premium', pendingPlanId: 'free', pendingPlanAt: longAgo, lemonSqueezySubscriptionId: 'sub-1' })

    expect(await resolveOverdueLemonCancellations(NOW)).toBe(1)
    expect(sync).toHaveBeenCalledWith(subscription, 'c1')
    expect(store.companies.get('c1')?.planId).toBe('premium')
  })
})

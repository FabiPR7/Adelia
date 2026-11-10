import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Doc = Record<string, unknown>

const store = vi.hoisted(() => ({
  companies: new Map<string, Record<string, unknown>>(),
  pending: new Map<string, Record<string, unknown>>(),
}))

vi.mock('../../firebase-admin.ts', () => {
  const companyDoc = (id: string) => ({
    id,
    exists: store.companies.has(id),
    data: () => store.companies.get(id),
    ref: {
      set: async (data: Doc) => {
        store.companies.set(id, { ...store.companies.get(id), ...data })
      },
    },
  })
  const emptyQuery = {
    where: () => emptyQuery,
    limit: () => ({ get: async () => ({ empty: true, size: 0, docs: [] }) }),
  }
  return {
    adminDb: {
      collection: (name: string) => {
        if (name === 'companies') {
          return {
            ...emptyQuery,
            doc: (id: string) => ({ ...companyDoc(id), get: async () => companyDoc(id) }),
          }
        }
        if (name === 'users') return emptyQuery
        return {
          doc: (id: string) => ({
            set: async (data: Doc) => {
              store.pending.set(id, data)
            },
            delete: async () => {
              store.pending.delete(id)
            },
          }),
        }
      },
    },
  }
})

vi.mock('../../company/enforcePlanLimits.ts', () => ({
  applyPlanFeatureLimits: vi.fn(async () => undefined),
}))

import { parseLemonOrder, syncCompanyFromLemonOrder } from '../lifetime.ts'
import { lemonPendingKey } from '../syncCompany.ts'

const EMAIL = 'dueno@restaurante.test'

function order(attributes: Doc = {}, id = 'order-1') {
  return {
    id,
    attributes: {
      status: 'paid',
      user_email: EMAIL,
      customer_id: 9,
      first_order_item: { variant_id: 555 },
      ...attributes,
    },
  }
}

describe('pago único de por vida', () => {
  beforeEach(() => {
    store.companies.clear()
    store.pending.clear()
    vi.stubEnv('LEMONSQUEEZY_LIFETIME_VARIANT_IDS', '555, 556')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('lee el pedido', () => {
    expect(parseLemonOrder(order())).toMatchObject({ orderId: 'order-1', variantId: '555', paid: true })
  })

  it('da el plan Local para siempre a la empresa del checkout', async () => {
    store.companies.set('c1', { planId: 'free' })
    await syncCompanyFromLemonOrder(order(), 'order_created', 'c1')
    expect(store.companies.get('c1')).toMatchObject({
      planId: 'premium',
      planBilling: 'perpetual',
      lifetimeOrderId: 'order-1',
    })
  })

  it('ignora pedidos de otros productos', async () => {
    store.companies.set('c1', { planId: 'free' })
    await syncCompanyFromLemonOrder(order({ first_order_item: { variant_id: 1 } }), 'order_created', 'c1')
    expect(store.companies.get('c1')?.planId).toBe('free')
  })

  it('sin variante configurada no regala nada', async () => {
    vi.stubEnv('LEMONSQUEEZY_LIFETIME_VARIANT_IDS', '')
    store.companies.set('c1', { planId: 'free' })
    await syncCompanyFromLemonOrder(order(), 'order_created', 'c1')
    expect(store.companies.get('c1')?.planId).toBe('free')
  })

  it('si aún no hay cuenta, lo deja pendiente para el alta', async () => {
    await syncCompanyFromLemonOrder(order(), 'order_created')
    expect(store.pending.get(lemonPendingKey(EMAIL))).toMatchObject({ planId: 'premium', period: 'perpetual' })
  })

  it('una devolución retira el plan de por vida de ese pedido', async () => {
    store.companies.set('c1', { planId: 'premium', planBilling: 'perpetual', lifetimeOrderId: 'order-1' })
    await syncCompanyFromLemonOrder(order({ status: 'refunded' }), 'order_refunded', 'c1')
    expect(store.companies.get('c1')).toMatchObject({ planId: 'free', planBilling: null })
  })

  it('una devolución de otro pedido no toca el plan', async () => {
    store.companies.set('c1', { planId: 'premium', planBilling: 'perpetual', lifetimeOrderId: 'order-1' })
    await syncCompanyFromLemonOrder(order({ status: 'refunded' }, 'order-2'), 'order_refunded', 'c1')
    expect(store.companies.get('c1')?.planId).toBe('premium')
  })
})

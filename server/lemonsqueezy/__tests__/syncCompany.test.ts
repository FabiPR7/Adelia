import { beforeEach, describe, expect, it, vi } from 'vitest'

type Doc = Record<string, unknown>

const store = vi.hoisted(() => ({
  companies: new Map<string, Record<string, unknown>>(),
  pending: new Map<string, Record<string, unknown>>(),
}))

vi.mock('../../firebase-admin.ts', () => {
  const companyDoc = (id: string) => ({
    id,
    data: () => store.companies.get(id),
    ref: {
      set: async (data: Doc) => {
        store.companies.set(id, { ...store.companies.get(id), ...data })
      },
    },
  })

  return {
    adminDb: {
      collection: (name: string) => {
        if (name === 'companies') {
          return {
            where: (field: string, _op: string, value: unknown) => ({
              limit: () => ({
                get: async () => {
                  const docs = [...store.companies.entries()]
                    .filter(([, data]) => data[field] === value)
                    .map(([id]) => companyDoc(id))
                  return { empty: docs.length === 0, docs }
                },
              }),
            }),
            doc: (id: string) => companyDoc(id),
          }
        }
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

import {
  lemonPendingKey,
  syncCompanyFromLemonInvoice,
  syncCompanyFromLemonSubscription,
} from '../syncCompany.ts'

const EMAIL = 'dueno@restaurante.test'

function subscription(attributes: Doc, id = 'sub-1') {
  return {
    id,
    attributes: {
      variant_id: 2088306,
      user_email: EMAIL,
      customer_id: 7,
      status: 'active',
      ...attributes,
    },
  }
}

function invoice(attributes: Doc = {}) {
  return {
    id: 'invoice-1',
    attributes: {
      subscription_id: 'sub-1',
      user_email: EMAIL,
      status: 'paid',
      ...attributes,
    },
  }
}

describe('Lemon Squeezy company sync', () => {
  beforeEach(() => {
    store.companies.clear()
    store.pending.clear()
  })

  it('keeps the pending plan when the payment event arrives before signup', async () => {
    await syncCompanyFromLemonSubscription(subscription({}))
    expect(store.pending.get(lemonPendingKey(EMAIL))?.planId).toBe('premium')

    await syncCompanyFromLemonInvoice(invoice(), 'subscription_payment_success')

    expect(store.pending.get(lemonPendingKey(EMAIL))?.planId).toBe('premium')
  })

  it('does not lose the pending plan on a subscription with an unknown variant', async () => {
    await syncCompanyFromLemonSubscription(subscription({}))
    await syncCompanyFromLemonSubscription(subscription({ variant_id: 999 }))

    expect(store.pending.get(lemonPendingKey(EMAIL))?.planId).toBe('premium')
  })

  it('clears the pending plan when the subscription expires before signup', async () => {
    await syncCompanyFromLemonSubscription(subscription({}))
    await syncCompanyFromLemonSubscription(subscription({ status: 'expired' }))

    expect(store.pending.has(lemonPendingKey(EMAIL))).toBe(false)
  })

  it('sets the plan dates only when the subscription is first linked', async () => {
    store.companies.set('company-1', { contactEmail: EMAIL })

    await syncCompanyFromLemonSubscription(subscription({}))
    const linked = store.companies.get('company-1')!
    expect(linked.planId).toBe('premium')
    expect(linked.planStartedAt).toBeDefined()

    store.companies.set('company-1', { ...linked, planStartedAt: 'original', planLastPaidAt: 'original' })
    await syncCompanyFromLemonSubscription(subscription({}))

    expect(store.companies.get('company-1')?.planStartedAt).toBe('original')
    expect(store.companies.get('company-1')?.planLastPaidAt).toBe('original')
  })

  it('does not move a linked subscription to a company that copies the email', async () => {
    store.companies.set('owner', { lemonSqueezySubscriptionId: 'sub-1', planId: 'premium' })
    store.companies.set('impostor', { contactEmail: EMAIL, planId: 'free' })

    await syncCompanyFromLemonSubscription(subscription({}))

    expect(store.companies.get('impostor')?.planId).toBe('free')
  })

  it('marks the plan past due on a failed payment and clears it on recovery', async () => {
    store.companies.set('company-1', { lemonSqueezySubscriptionId: 'sub-1', planId: 'premium' })

    await syncCompanyFromLemonInvoice(invoice({ status: 'pending' }), 'subscription_payment_failed')
    expect(store.companies.get('company-1')?.planPaymentState).toBe('past_due')
    expect(store.companies.get('company-1')?.planId).toBe('premium')

    await syncCompanyFromLemonInvoice(invoice(), 'subscription_payment_recovered')
    expect(store.companies.get('company-1')?.planLastPaidAt).toBeDefined()
  })
})

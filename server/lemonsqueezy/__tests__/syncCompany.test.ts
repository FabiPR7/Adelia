import { beforeEach, describe, expect, it, vi } from 'vitest'

type Doc = Record<string, unknown>

const store = vi.hoisted(() => ({
  companies: new Map<string, Record<string, unknown>>(),
  users: new Map<string, Record<string, unknown>>(),
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

  return {
    adminDb: {
      collection: (name: string) => {
        if (name === 'users') {
          // Consultas con varios where encadenados (correo + rol).
          const query = (filters: Array<[string, unknown]>) => ({
            where: (field: string, _op: string, value: unknown) => query([...filters, [field, value]]),
            limit: () => ({
              get: async () => {
                const docs = [...store.users.entries()]
                  .filter(([, data]) => filters.every(([field, value]) => data[field] === value))
                  .map(([id, data]) => ({ id, data: () => data }))
                return { empty: docs.length === 0, size: docs.length, docs }
              },
            }),
          })
          return query([])
        }
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
            doc: (id: string) => ({ ...companyDoc(id), get: async () => companyDoc(id) }),
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

import { applyPlanFeatureLimits } from '../../company/enforcePlanLimits.ts'
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
    store.users.clear()
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
    store.users.set('owner-1', { role: 'company', contactEmail: EMAIL, companyId: 'company-1' })

    await syncCompanyFromLemonSubscription(subscription({}), 'company-1')
    const linked = store.companies.get('company-1')!
    expect(linked.planId).toBe('premium')
    expect(linked.planStartedAt).toBeDefined()

    store.companies.set('company-1', { ...linked, planStartedAt: 'original', planLastPaidAt: 'original' })
    await syncCompanyFromLemonSubscription(subscription({}))

    expect(store.companies.get('company-1')?.planStartedAt).toBe('original')
    expect(store.companies.get('company-1')?.planLastPaidAt).toBe('original')
  })

  it('leaves the plan pending when it only matches the email the owner signed up with', async () => {
    // Ese correo nadie lo ha comprobado: se activa con el enlace que llega al correo.
    store.companies.set('company-1', { contactEmail: EMAIL, planId: 'free' })
    store.users.set('owner-1', { role: 'company', contactEmail: EMAIL, companyId: 'company-1' })

    await syncCompanyFromLemonSubscription(subscription({}))

    expect(store.companies.get('company-1')?.planId).toBe('free')
    expect(store.pending.get(lemonPendingKey(EMAIL))?.planId).toBe('premium')
  })

  it('does not move a linked subscription to a company that copies the email', async () => {
    store.companies.set('owner', { lemonSqueezySubscriptionId: 'sub-1', planId: 'premium' })
    store.companies.set('impostor', { contactEmail: EMAIL, planId: 'free' })

    await syncCompanyFromLemonSubscription(subscription({}))

    expect(store.companies.get('impostor')?.planId).toBe('free')
  })

  it('does not give the plan to a company that only puts the email in its contact', async () => {
    store.companies.set('impostor', { contactEmail: EMAIL, planId: 'free' })

    await syncCompanyFromLemonSubscription(subscription({}))

    expect(store.companies.get('impostor')?.planId).toBe('free')
    expect(store.pending.get(lemonPendingKey(EMAIL))?.planId).toBe('premium')
  })

  it('links the payment to the company id sent from the checkout', async () => {
    store.companies.set('logged-in', { planId: 'free' })

    await syncCompanyFromLemonSubscription(subscription({ user_email: 'otro@correo.test' }), 'logged-in')

    expect(store.companies.get('logged-in')?.planId).toBe('premium')
  })

  it('never downgrades a lifetime plan when an old subscription expires', async () => {
    store.companies.set('lifetime', {
      lemonSqueezySubscriptionId: 'sub-1',
      planId: 'premium',
      planBilling: 'perpetual',
    })

    await syncCompanyFromLemonSubscription(subscription({ status: 'expired' }))

    expect(store.companies.get('lifetime')?.planId).toBe('premium')
    expect(store.companies.get('lifetime')?.planBilling).toBe('perpetual')
  })

  it('una suscripción vieja que caduca no quita el plan de la suscripción nueva', async () => {
    store.companies.set('c1', { lemonSqueezySubscriptionId: 'sub-2', lemonSqueezyEmail: EMAIL, planId: 'premium' })

    await syncCompanyFromLemonSubscription(subscription({ status: 'expired' }, 'sub-1'), 'c1')
    await syncCompanyFromLemonSubscription(subscription({ status: 'cancelled' }, 'sub-1'), 'c1')
    await syncCompanyFromLemonInvoice(invoice({ total: 3999, refunded_amount: 3999 }), 'subscription_payment_refunded')
    await syncCompanyFromLemonInvoice(invoice(), 'subscription_payment_failed')

    expect(store.companies.get('c1')).toMatchObject({ planId: 'premium', lemonSqueezySubscriptionId: 'sub-2' })
    expect(store.companies.get('c1')?.pendingPlanId).toBeUndefined()
    expect(store.companies.get('c1')?.planPaymentState).toBeUndefined()
  })

  it('una cancelación mantiene el plan hasta fin de periodo y lo programa a gratis', async () => {
    store.companies.set('c1', { lemonSqueezySubscriptionId: 'sub-1', planId: 'premium' })

    await syncCompanyFromLemonSubscription(subscription({ status: 'cancelled', ends_at: '2026-12-10T00:00:00Z' }))

    expect(store.companies.get('c1')).toMatchObject({ planId: 'premium', pendingPlanId: 'free' })
  })

  it('al terminar el periodo (expired) pasa a gratis y recorta lo que sobra', async () => {
    store.companies.set('c1', { lemonSqueezySubscriptionId: 'sub-1', planId: 'premium' })

    await syncCompanyFromLemonSubscription(subscription({ status: 'expired' }))

    expect(store.companies.get('c1')?.planId).toBe('free')
    expect(applyPlanFeatureLimits).toHaveBeenLastCalledWith('c1', 'free')
  })

  it('si reanuda una cancelación, recupera el plan y quita el cambio programado', async () => {
    store.companies.set('c1', { lemonSqueezySubscriptionId: 'sub-1', planId: 'premium', pendingPlanId: 'free' })

    await syncCompanyFromLemonSubscription(subscription({ status: 'active' }))

    expect(store.companies.get('c1')?.planId).toBe('premium')
    expect(String(store.companies.get('c1')?.pendingPlanId ?? '')).not.toBe('free')
  })

  it('bajar de Local a Sala cambia el plan al momento y recorta los límites', async () => {
    store.companies.set('c1', { lemonSqueezySubscriptionId: 'sub-1', planId: 'premium' })

    await syncCompanyFromLemonSubscription(subscription({ variant_id: 2088081 }))

    expect(store.companies.get('c1')).toMatchObject({ planId: 'basic', planBilling: 'monthly' })
    expect(applyPlanFeatureLimits).toHaveBeenLastCalledWith('c1', 'basic')
  })

  it('subir de Sala a Local anual cambia plan y periodo', async () => {
    store.companies.set('c1', { lemonSqueezySubscriptionId: 'sub-1', planId: 'basic' })

    await syncCompanyFromLemonSubscription(subscription({ variant_id: 2089103 }))

    expect(store.companies.get('c1')).toMatchObject({ planId: 'premium', planBilling: 'annual' })
  })

  it('un impago o una pausa quitan el plan; un cobro retrasado lo mantiene avisando', async () => {
    store.companies.set('c1', { lemonSqueezySubscriptionId: 'sub-1', planId: 'premium' })
    await syncCompanyFromLemonSubscription(subscription({ status: 'past_due' }))
    expect(store.companies.get('c1')).toMatchObject({ planId: 'premium', planPaymentState: 'past_due' })

    await syncCompanyFromLemonSubscription(subscription({ status: 'unpaid' }))
    expect(store.companies.get('c1')?.planId).toBe('free')
  })

  it('una devolución total de la cuota quita el plan pero deja la suscripción enlazada', async () => {
    store.companies.set('c1', { lemonSqueezySubscriptionId: 'sub-1', planId: 'premium' })

    await syncCompanyFromLemonInvoice(invoice({ total: 5999, refunded_amount: 5999 }), 'subscription_payment_refunded')

    expect(store.companies.get('c1')).toMatchObject({
      planId: 'free',
      planPaymentState: 'refunded',
      lemonSqueezySubscriptionId: 'sub-1',
    })
  })

  it('una devolución parcial no quita el plan', async () => {
    store.companies.set('c1', { lemonSqueezySubscriptionId: 'sub-1', planId: 'premium' })

    await syncCompanyFromLemonInvoice(invoice({ total: 5999, refunded_amount: 1000 }), 'subscription_payment_refunded')

    expect(store.companies.get('c1')?.planId).toBe('premium')
  })

  it('tras una devolución, la renovación de Lemon devuelve el plan', async () => {
    store.companies.set('c1', { lemonSqueezySubscriptionId: 'sub-1', planId: 'free', planPaymentState: 'refunded' })

    await syncCompanyFromLemonSubscription(subscription({ status: 'active' }))

    expect(store.companies.get('c1')?.planId).toBe('premium')
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

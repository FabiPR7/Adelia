import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'

const sync = vi.hoisted(() => ({
  subscription: vi.fn(async () => undefined),
  invoice: vi.fn(async () => undefined),
}))

vi.mock('../../firebase-admin.ts', () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ delete: async () => undefined }) }),
    runTransaction: async () => 'claimed',
  },
}))

vi.mock('../../lemonsqueezy/syncCompany.ts', () => ({
  syncCompanyFromLemonSubscription: sync.subscription,
  syncCompanyFromLemonInvoice: sync.invoice,
}))

import { handleLemonSqueezyWebhook } from '../lemonSqueezyWebhook.ts'

const SECRET = 'webhook-secret'

async function send(payload: unknown) {
  const body = Buffer.from(JSON.stringify(payload))
  const signature = createHmac('sha256', SECRET).update(body).digest('hex')
  const json = vi.fn()
  const res = { json, status: vi.fn(() => res), send: vi.fn() } as unknown as Response
  const req = { body, header: (name: string) => (name === 'X-Signature' ? signature : undefined) } as unknown as Request
  await handleLemonSqueezyWebhook(req, res)
  return json
}

describe('Lemon Squeezy webhook', () => {
  beforeEach(() => {
    vi.stubEnv('LEMONSQUEEZY_WEBHOOK_SECRET', SECRET)
    sync.subscription.mockClear()
    sync.invoice.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('ignores test mode purchases so a test card cannot grant a plan', async () => {
    const json = await send({
      meta: { event_name: 'subscription_created', test_mode: true },
      data: { id: 'sub-1', attributes: {} },
    })

    expect(sync.subscription).not.toHaveBeenCalled()
    expect(json).toHaveBeenCalledWith({ received: true, ignored: true })
  })

  it('accepts test mode purchases only when explicitly allowed', async () => {
    vi.stubEnv('LEMONSQUEEZY_ALLOW_TEST_EVENTS', 'true')

    await send({
      meta: { event_name: 'subscription_created', test_mode: true },
      data: { id: 'sub-1', attributes: {} },
    })

    expect(sync.subscription).toHaveBeenCalledTimes(1)
  })

  it('processes live subscription events', async () => {
    await send({
      meta: { event_name: 'subscription_created', test_mode: false },
      data: { id: 'sub-1', attributes: {} },
    })

    expect(sync.subscription).toHaveBeenCalledTimes(1)
    expect(sync.invoice).not.toHaveBeenCalled()
  })

  it('treats payment events as invoices, not subscriptions', async () => {
    await send({
      meta: { event_name: 'subscription_payment_success', test_mode: false },
      data: { id: 'invoice-1', attributes: {} },
    })

    expect(sync.invoice).toHaveBeenCalledTimes(1)
    expect(sync.subscription).not.toHaveBeenCalled()
  })
})

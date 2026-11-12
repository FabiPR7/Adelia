import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase-admin.ts', () => ({ adminDb: {} }))

const { ledgerRowFromLemon } = await import('../ledger.ts')

describe('ledgerRowFromLemon', () => {
  it('apunta una cuota cobrada con su IVA y neto', () => {
    const entry = ledgerRowFromLemon({ id: '77', attributes: { total: 7258, tax: 1260, currency: 'eur', user_email: 'A@B.es', created_at: '2026-11-01T10:00:00Z', urls: { invoice_url: 'https://x/f.pdf' } } }, 'subscription_payment_success')
    expect(entry?.docId).toBe('inv_77')
    expect(entry?.row).toMatchObject({ status: 'paid', totalCents: 7258, taxCents: 1260, subtotalCents: 5998, netCents: 7258, currency: 'EUR', customerEmail: 'a@b.es', invoiceUrl: 'https://x/f.pdf' })
  })

  it('una devolución resta y un cobro fallido no suma', () => {
    const refunded = ledgerRowFromLemon({ id: '78', attributes: { total: 5000, refunded_amount: 2000 } }, 'subscription_payment_refunded')
    expect(refunded?.row).toMatchObject({ status: 'refunded', refundedCents: 2000, netCents: 3000 })
    const failed = ledgerRowFromLemon({ id: '79', attributes: { total: 5000 } }, 'subscription_payment_failed')
    expect(failed?.row.netCents).toBe(0)
  })

  it('ignora eventos que no son cobros', () => {
    expect(ledgerRowFromLemon({ id: '1', attributes: {} }, 'subscription_updated')).toBeNull()
  })
})

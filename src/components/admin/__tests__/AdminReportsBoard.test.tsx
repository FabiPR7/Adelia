import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  analytics: vi.fn(),
  geography: vi.fn(),
}))

vi.mock('../../../config/firebase', () => ({ db: {}, auth: {} }))
vi.mock('../../../services/adminApi', () => ({ adminApi: api }))

const { default: AdminReportsBoard } = await import('../AdminReportsBoard')

const bucket = (key: string, reservations: number) => ({ key, reservations, cancelled: 0, noShows: 0, pax: reservations * 2, newCustomers: 1, newCompanies: 0, revenueCents: 5999, claims: 0 })

api.analytics.mockResolvedValue({
  generatedAt: '2026-11-12T10:00:00Z',
  range: { from: '2026-11-01', to: '2026-11-02', days: 2, granularity: 'day' },
  previous: { from: '2026-10-30', to: '2026-10-31' },
  includeTest: false,
  truncated: false,
  kpis: {
    revenueNetCents: 11998, revenueGrossCents: 11998, taxCents: 2082, refundsCents: 0, invoices: 2, failedPayments: 1, avgTicketCents: 5999,
    newCustomers: 2, newCompanies: 1, reservations: 3, pax: 6, attended: 2, pending: 1, cancelledByClient: 0, cancelledByRestaurant: 0, noShows: 0,
    withPromotion: 1, withAccount: 2, claims: 1, reviews: 1, avgRating: 4.5, prev: { revenueNetCents: 5999, newCustomers: 0, reservations: 3 },
  },
  series: [bucket('2026-11-01', 1), bucket('2026-11-02', 2)],
  byHour: Array(24).fill(0).map((_, i) => (i === 21 ? 3 : 0)),
  byWeekday: [0, 0, 0, 0, 0, 1, 2],
  revenueByMonth: [{ month: '2026-11', invoices: 2, grossCents: 11998, taxCents: 2082, refundsCents: 0, netCents: 11998 }],
  revenueByPlan: [{ planId: 'premium', invoices: 2, netCents: 11998 }],
  invoices: [{ id: 'inv_1', paidAt: '2026-11-01T10:00:00Z', companyId: 'c1', companyName: 'Casa Pepe', customerEmail: 'p@x.es', planId: 'premium', kind: 'subscription', status: 'paid', currency: 'EUR', totalCents: 5999, taxCents: 1041, refundedCents: 0, netCents: 5999, invoiceUrl: 'https://x/1.pdf', testMode: false }],
  topCompanies: [{ id: 'c1', name: 'Casa Pepe', municipality: 'Logroño', planId: 'premium', reservations: 3, pax: 6, cancelled: 0, noShows: 0, attended: 2, claims: 1, reviews: 1, avgRating: 4.5, revenueCents: 11998 }],
  reservationsByCity: [{ city: 'Logroño', reservations: 3, pax: 6 }],
  newCustomersByCountry: [{ name: 'España', count: 2 }],
  newCustomersByCity: [{ name: 'Logroño', count: 2 }],
})
api.geography.mockResolvedValue({
  generatedAt: '', totalCustomers: 3, totalCompanies: 2,
  customersByCountry: [{ country: 'España', customers: 3, cities: [{ city: 'Logroño', customers: 3 }] }],
  companiesByCity: [{ city: 'Logroño', companies: 2, paid: 1, active: 2, country: 'España' }],
})

describe('AdminReportsBoard', () => {
  it('pinta dinero, crecimiento, facturas y mapa', async () => {
    render(<AdminReportsBoard />)
    await waitFor(() => expect(screen.getByText('Ingresos netos')).toBeTruthy())
    expect(screen.getAllByText('Casa Pepe').length).toBeGreaterThan(0)
    expect(screen.getByText('+100 % vs periodo anterior')).toBeTruthy()
    expect(screen.getByText('1 cobros fallidos')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver' }).getAttribute('href')).toBe('https://x/1.pdf')
    fireEvent.click(await screen.findByRole('button', { name: /España/ }))
    expect(screen.getAllByText('Logroño').length).toBeGreaterThan(1)
  })

  it('pide de nuevo el informe al cambiar de periodo', async () => {
    render(<AdminReportsBoard />)
    await waitFor(() => expect(api.analytics).toHaveBeenCalled())
    const calls = api.analytics.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Año pasado' }))
    await waitFor(() => expect(api.analytics.mock.calls.length).toBeGreaterThan(calls))
    const [from, to] = api.analytics.mock.calls.at(-1)!
    expect(from.endsWith('-01-01')).toBe(true)
    expect(to.endsWith('-12-31')).toBe(true)
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const day = (dayKey: string, reservations: number, newCustomers: number) => ({
  day: dayKey,
  reservations,
  pax: reservations * 2,
  confirmed: reservations,
  completed: 0,
  cancelled: 0,
  fromCustomers: reservations,
  withPromotion: 0,
  newCustomers,
  newCompanies: 0,
  byHour: Array.from({ length: 24 }, () => 0),
  weekday: 1,
  topCompanies: {},
})

vi.mock('../../../services/adminApi', () => ({
  adminApi: {
    stats: vi.fn(async (days: number) => ({
      generatedAt: '2026-11-11T10:00:00Z',
      totals: {
        customers: 120, blockedCustomers: 2, phoneVerified: 60, companies: 10, activeCompanies: 9,
        deactivatedCompanies: 1, featuredCompanies: 3, paidCompanies: 4, subscriptionsPending: 1,
        reservations: 300, confirmed: 200, completed: 80, cancelled: 20, upcoming: 40, promotionClaims: 15, reviews: 33,
      },
      revenue: { mrr: 199.96, perpetual: 1, conversion: 0.4 },
      plans: [
        { planId: 'free', name: 'Mesa', total: 6, monthly: 0, annual: 0, perpetual: 0, mrr: 0 },
        { planId: 'basic', name: 'Sala', total: 4, monthly: 4, annual: 0, perpetual: 0, mrr: 159.96 },
      ],
      series: Array.from({ length: days }, (_, index) => day(`2026-10-${String((index % 28) + 1).padStart(2, '0')}`, index < days / 2 ? 1 : 2, 1)),
      topCompanies: [{ id: 'c1', name: 'Bar Uno', municipality: 'Logroño', planId: 'basic', reservations: 12 }],
    })),
  },
}))

import AdminHomeBoard from '../AdminHomeBoard'

describe('AdminHomeBoard', () => {
  it('muestra ingresos, comparación con el periodo anterior y los locales top', async () => {
    render(<AdminHomeBoard onOpenCompany={() => undefined} onNavigate={() => undefined} />)
    expect(await screen.findByText('Ingresos al mes')).toBeTruthy()
    expect(screen.getByText(/200\s?€/)).toBeTruthy()
    expect(screen.getByText('Bar Uno')).toBeTruthy()
    // 30 días a 2 reservas frente a 30 días a 1: +100 %.
    expect(screen.getByText(/\+100% vs periodo anterior/)).toBeTruthy()
    expect(screen.getByText(/1 pago\(s\) de Lemon/)).toBeTruthy()
  })
})

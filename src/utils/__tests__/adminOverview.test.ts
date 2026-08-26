import { describe, expect, it } from 'vitest'
import {
  buildAdminOverview,
  buildFilledSeries,
  getAnalyticsReservationWindow,
  getExclusiveDateRange,
} from '../adminOverview'
import type { AdminCompanyRow, AdminReservationRow, AdminUserRow } from '../adminOverview'

const NOW = new Date(2026, 7, 21, 15, 0, 0)

function user(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    role: 'customer',
    createdAt: NOW,
    country: 'España',
    ...overrides,
  }
}

function company(overrides: Partial<AdminCompanyRow> = {}): AdminCompanyRow {
  return {
    id: 'c1',
    name: 'Casa Pepe',
    createdAt: NOW,
    country: 'España',
    planId: 'basic',
    planBilling: 'monthly',
    ...overrides,
  }
}

function reservation(overrides: Partial<AdminReservationRow> = {}): AdminReservationRow {
  return {
    id: 'r1',
    companyId: 'c1',
    clientName: 'Ana',
    pax: 2,
    status: 'confirmed',
    startTime: NOW,
    createdAt: NOW,
    ...overrides,
  }
}

describe('adminOverview', () => {
  it('uses the last 7 days including today for the week range', () => {
    const range = getExclusiveDateRange('week', NOW)
    expect(range.start).toEqual(new Date(2026, 7, 15))
    expect(range.end).toEqual(new Date(2026, 7, 22))
  })

  it('fills empty days so the chart does not jump', () => {
    const start = new Date(2026, 7, 19)
    const end = new Date(2026, 7, 22)
    const series = buildFilledSeries([new Date(2026, 7, 21, 10)], start, end, 'week')
    expect(series.labels).toEqual(['19/8', '20/8', '21/8'])
    expect(series.values).toEqual([0, 0, 1])
  })

  it('builds KPIs for users, companies and reservations', () => {
    const overview = buildAdminOverview({
      now: NOW,
      timeRange: 'week',
      users: [
        user(),
        user({ role: 'company', createdAt: new Date(2026, 7, 10) }),
        user({ role: 'admin', country: '' }),
      ],
      companies: [
        company(),
        company({ id: 'c2', name: 'Mesa Libre', planId: 'free', planBilling: null }),
      ],
      reservations: [
        reservation({ pax: 4 }),
        reservation({
          id: 'r2',
          status: 'cancelled',
          pax: 2,
          createdAt: new Date(2026, 7, 20, 12),
        }),
        reservation({
          id: 'r3',
          status: 'completed',
          pax: 3,
          createdAt: new Date(2026, 6, 1),
        }),
      ],
    })

    expect(overview.stats.totalCustomers).toBe(1)
    expect(overview.stats.totalCompanies).toBe(2)
    expect(overview.stats.paidCompanies).toBe(1)
    expect(overview.stats.totalReservations).toBe(3)
    expect(overview.stats.totalGuests).toBe(9)
    expect(overview.stats.avgPartySize).toBe(3)
    expect(overview.stats.cancellationRate).toBe(33.3)
    expect(overview.stats.reservationsToday).toBe(1)
    expect(overview.plansDistribution.find((slice) => slice.key === 'basic')?.value).toBe(1)
    expect(overview.topCompanies[0]).toEqual({ label: 'Casa Pepe', count: 2 })
  })

  it('fetches reservations from the previous month, not the whole history', () => {
    const window = getAnalyticsReservationWindow('week', NOW)
    expect(window.start).toEqual(new Date(2026, 5, 23))
    expect(window.end).toEqual(new Date(2026, 7, 22))
  })

  it('prefers aggregation totals over the reservation window size', () => {
    const overview = buildAdminOverview({
      now: NOW,
      timeRange: 'week',
      users: [user()],
      companies: [company()],
      reservations: [reservation({ pax: 2 })],
      totals: {
        totalUsers: 40,
        totalCustomers: 30,
        totalReservations: 900,
        confirmedReservations: 700,
        cancelledReservations: 100,
        completedReservations: 100,
      },
    })

    expect(overview.stats.totalUsers).toBe(40)
    expect(overview.stats.totalReservations).toBe(900)
    expect(overview.stats.cancellationRate).toBe(11.1)
  })
})

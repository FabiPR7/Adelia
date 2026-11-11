import { describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'

vi.mock('../../firebase-admin.ts', () => ({ adminDb: {} }))

import { addDaysYmd, summarizeReservations } from '../dailyStats.ts'

describe('resumen diario del panel', () => {
  it('suma reservas, personas, estados y locales', () => {
    const at = Timestamp.fromDate(new Date('2026-11-10T19:30:00Z')) // 20:30 en Madrid
    const stats = summarizeReservations('2026-11-10', [
      { pax: 2, status: 'confirmed', customerUid: 'u1', companyId: 'a', createdAt: at },
      { pax: 4, status: 'cancelled', companyId: 'a', createdAt: at, promotionId: 'p1' },
      { pax: 3, status: 'completed', customerUid: 'u2', companyId: 'b', createdAt: at },
      { pax: 9999, status: 'confirmed', companyId: 'b' },
    ])
    expect(stats.reservations).toBe(4)
    expect(stats.pax).toBe(2 + 4 + 3 + 500)
    expect(stats.confirmed).toBe(2)
    expect(stats.cancelled).toBe(1)
    expect(stats.completed).toBe(1)
    expect(stats.fromCustomers).toBe(2)
    expect(stats.withPromotion).toBe(1)
    expect(stats.byHour[20]).toBe(3)
    expect(stats.topCompanies).toEqual({ a: 2, b: 2 })
    expect(stats.weekday).toBe(2) // martes
  })

  it('mueve fechas por días sin errores de cambio de hora', () => {
    expect(addDaysYmd('2026-10-25', 1)).toBe('2026-10-26')
    expect(addDaysYmd('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01')
  })
})

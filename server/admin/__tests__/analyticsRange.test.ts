import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase-admin.ts', () => ({ adminDb: {} }))

const { parseAnalyticsRange } = await import('../analytics.ts')

describe('parseAnalyticsRange', () => {
  it('días de Madrid, con el día final incluido', () => {
    const range = parseAnalyticsRange('2026-11-01', '2026-11-30')!
    expect(range.days).toBe(30)
    expect(range.granularity).toBe('day')
    expect(range.start.toISOString()).toBe('2026-10-31T23:00:00.000Z')
    expect(range.end.toISOString()).toBe('2026-11-30T23:00:00.000Z')
  })

  it('agrupa por meses en periodos largos y rechaza fechas raras', () => {
    expect(parseAnalyticsRange('2026-01-01', '2026-12-31')?.granularity).toBe('month')
    expect(parseAnalyticsRange('2026-12-01', '2026-11-01')).toBeNull()
    expect(parseAnalyticsRange('2020-01-01', '2026-01-01')).toBeNull()
    expect(parseAnalyticsRange('hoy', '2026-01-01')).toBeNull()
  })
})

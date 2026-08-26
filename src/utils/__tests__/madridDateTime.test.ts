import { describe, expect, it } from 'vitest'
import { madridDateTime, madridHour, utcNoonFromYmd } from '../madridDateTime'
import { shiftCalendarMonth } from '../helpers'

describe('madridDateTime', () => {
  it('stores 20:00 in summer as 18:00 UTC', () => {
    const date = madridDateTime('2026-08-23', '20:00')
    expect(date.toISOString()).toBe('2026-08-23T18:00:00.000Z')
  })

  it('stores 20:00 in winter as 19:00 UTC', () => {
    const date = madridDateTime('2026-01-15', '20:00')
    expect(date.toISOString()).toBe('2026-01-15T19:00:00.000Z')
  })

  it('keeps the civil calendar day at UTC noon', () => {
    const date = utcNoonFromYmd('2026-08-23')
    expect(date.getUTCDate()).toBe(23)
    expect(date.getUTCMonth()).toBe(7)
  })

  it('reads the civil hour in Madrid from a UTC instant', () => {
    const date = madridDateTime('2026-08-23', '21:00')
    expect(date.toISOString()).toBe('2026-08-23T19:00:00.000Z')
    expect(madridHour(date)).toBe(21)
  })
})

describe('shiftCalendarMonth', () => {
  it('does not skip from 31 January to March', () => {
    const next = shiftCalendarMonth(new Date(2026, 0, 31), 1)
    expect(next.getFullYear()).toBe(2026)
    expect(next.getMonth()).toBe(1)
    expect(next.getDate()).toBe(28)
  })
})

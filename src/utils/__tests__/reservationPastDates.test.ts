import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isPastCalendarDate, isReservationStartInPast } from '../helpers'

describe('reservation past dates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 23, 15, 30, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('marks yesterday as a past calendar day and today as current', () => {
    expect(isPastCalendarDate(new Date(2026, 7, 22, 21, 0, 0))).toBe(true)
    expect(isPastCalendarDate(new Date(2026, 7, 23, 8, 0, 0))).toBe(false)
    expect(isPastCalendarDate(new Date(2026, 7, 24, 10, 0, 0))).toBe(false)
  })

  it('treats an earlier hour today as already started', () => {
    expect(isReservationStartInPast(new Date(2026, 7, 23), '14:00')).toBe(true)
    expect(isReservationStartInPast(new Date(2026, 7, 23), '16:00')).toBe(false)
  })

  it('treats any hour from a previous day as already started', () => {
    expect(isReservationStartInPast(new Date(2026, 7, 22), '22:00')).toBe(true)
  })
})

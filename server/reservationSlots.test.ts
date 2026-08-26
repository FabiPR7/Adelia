import { describe, expect, it } from 'vitest'
import { combineDateAndTime, generateSlotTimes, parseBookingDate } from './reservationSlots.ts'

const splitSchedule = {
  monday: { open: '13:00', close: '23:00', active: true, periods: [{ open: '13:00', close: '16:00' }, { open: '20:00', close: '23:00' }] },
  tuesday: { open: '13:00', close: '23:00', active: true, periods: [{ open: '13:00', close: '16:00' }, { open: '20:00', close: '23:00' }] },
  wednesday: { open: '13:00', close: '23:00', active: true, periods: [{ open: '13:00', close: '16:00' }, { open: '20:00', close: '23:00' }] },
  thursday: { open: '13:00', close: '23:00', active: true, periods: [{ open: '13:00', close: '16:00' }, { open: '20:00', close: '23:00' }] },
  friday: { open: '13:00', close: '23:00', active: true, periods: [{ open: '13:00', close: '16:00' }, { open: '20:00', close: '23:00' }] },
  saturday: { open: '13:00', close: '23:00', active: true, periods: [{ open: '13:00', close: '16:00' }, { open: '20:00', close: '23:00' }] },
  sunday: { open: '13:00', close: '23:00', active: true, periods: [{ open: '13:00', close: '16:00' }, { open: '20:00', close: '23:00' }] },
}

describe('generateSlotTimes', () => {
  it('keeps lunch and dinner periods instead of filling the gap', () => {
    const monday = new Date(Date.UTC(2026, 7, 24, 12, 0, 0))
    const slots = generateSlotTimes(monday, splitSchedule, 30, 90)
    expect(slots).toContain('13:00')
    expect(slots).toContain('20:00')
    expect(slots).not.toContain('17:00')
  })
})

describe('combineDateAndTime', () => {
  it('stores a company booking at 21:00 Madrid in summer as 19:00 UTC', () => {
    const date = parseBookingDate('2026-08-23')
    const start = combineDateAndTime(date, '21:00')
    expect(start.toISOString()).toBe('2026-08-23T19:00:00.000Z')
  })
})

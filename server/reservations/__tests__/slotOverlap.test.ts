import { describe, expect, it } from 'vitest'
import { occupyingReservation, reservationsOverlap } from '../../reservationSlots.ts'

describe('slot occupancy', () => {
  it('detects overlapping intervals and ignores cancelled rows', () => {
    const start = new Date(2026, 7, 22, 20, 0)
    const end = new Date(2026, 7, 22, 22, 0)
    const sameTable = {
      id: 'a',
      tableId: 't1',
      startTime: new Date(2026, 7, 22, 21, 0),
      endTime: new Date(2026, 7, 22, 23, 0),
      status: 'completed',
    }

    expect(reservationsOverlap(start, end, sameTable.startTime, sameTable.endTime)).toBe(true)
    expect(occupyingReservation(sameTable, 't1', start, end)).toBe(true)
    expect(occupyingReservation({ ...sameTable, status: 'cancelled' }, 't1', start, end)).toBe(false)
    expect(occupyingReservation(sameTable, 't2', start, end)).toBe(false)
    expect(occupyingReservation(sameTable, 't1', start, end, 'a')).toBe(false)
  })

  it('allows back-to-back slots on the same table', () => {
    const start = new Date(2026, 7, 22, 22, 0)
    const end = new Date(2026, 7, 22, 24, 0)
    const previous = {
      id: 'b',
      tableId: 't1',
      startTime: new Date(2026, 7, 22, 20, 0),
      endTime: new Date(2026, 7, 22, 22, 0),
      status: 'completed',
    }
    expect(occupyingReservation(previous, 't1', start, end)).toBe(false)
  })
})

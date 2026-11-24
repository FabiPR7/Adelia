import { describe, expect, it } from 'vitest'
import { findNowSlot } from '../nowAvailability.ts'
import { isNowBookingTime, parseBookingDate } from '../../reservationSlots.ts'

const closed = { open: '', close: '', active: false }
const friday = {
  open: '13:00',
  close: '23:30',
  active: true,
  periods: [{ open: '13:00', close: '16:00' }, { open: '20:00', close: '23:30' }],
}
const schedule = {
  monday: closed, tuesday: closed, wednesday: closed, thursday: closed,
  friday, saturday: closed, sunday: closed,
}
// Viernes 27/11/2026 a las 20:32 en Madrid (UTC+1).
const date = parseBookingDate('2026-11-27')
const now = Date.UTC(2026, 10, 27, 19, 32)
const window = { graceMinutes: 5, windowMinutes: 30 }
const tables = [{ id: 'm1', capacity: 2 }, { id: 'm2', capacity: 4 }]

describe('Comer ahora', () => {
  it('con horas cada 2 h ofrece llegar ya (la siguiente en punto de 5 min)', () => {
    const slot = findNowSlot({ date, schedule, durationMinutes: 120, tables, pax: 2, reservations: [], window, now })
    expect(slot).toEqual({ time: '20:35', minutesFromNow: 3, freeTableCount: 2, freeTableIds: ['m1', 'm2'] })
  })

  it('con horas cada 30 min deja llegar 2 min tarde a la de las 20:30', () => {
    const slot = findNowSlot({ date, schedule, durationMinutes: 30, tables, pax: 2, reservations: [], window, now })
    expect(slot?.time).toBe('20:30')
    expect(slot?.minutesFromNow).toBe(-2)
  })

  it('no ofrece mesas pequeñas para un grupo grande', () => {
    expect(findNowSlot({ date, schedule, durationMinutes: 120, tables, pax: 6, reservations: [], window, now })).toBeNull()
  })

  it('salta la mesa ocupada y usa la otra', () => {
    const busy = [{
      id: 'r1', tableId: 'm1', status: 'completed',
      startTime: new Date(Date.UTC(2026, 10, 27, 19, 0)), endTime: new Date(Date.UTC(2026, 10, 27, 21, 0)),
    }]
    expect(findNowSlot({ date, schedule, durationMinutes: 120, tables, pax: 2, reservations: busy, window, now })?.freeTableCount).toBe(1)
  })

  it('cerrado ahora: nada', () => {
    const afternoon = Date.UTC(2026, 10, 27, 16, 0) // 17:00 en Madrid, entre turnos
    expect(findNowSlot({ date, schedule, durationMinutes: 120, tables, pax: 2, reservations: [], window, now: afternoon })).toBeNull()
  })

  it('la reserva solo acepta horas dentro del margen', () => {
    expect(isNowBookingTime(date, '20:35', schedule, 120, window, now)).toBe(true)
    expect(isNowBookingTime(date, '20:20', schedule, 120, window, now)).toBe(false) // hace 12 min
    expect(isNowBookingTime(date, '21:30', schedule, 120, window, now)).toBe(false) // dentro de 58 min
    expect(isNowBookingTime(date, '20:33', schedule, 120, window, now)).toBe(false) // no es de 5 en 5
    expect(isNowBookingTime(date, '22:00', schedule, 120, { graceMinutes: 5, windowMinutes: 120 }, now)).toBe(false) // no cabe antes del cierre
  })
})

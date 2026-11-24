import { describe, expect, it } from 'vitest'
import { closesAtIfOpen, findMissedSlot, findNowSlot, hasOwnSchedule, hasTableFreeNow } from '../nowAvailability.ts'
import { defaultSchedule } from '../../utils.ts'
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
    expect(slot).toMatchObject({ time: '20:35', startsAt: '2026-11-27T19:35:00.000Z', minutesFromNow: 3, freeTableCount: 2, freeTableIds: ['m1', 'm2'], maxSeats: 4 })
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

  it('sin decir cuántos son valen todas las mesas', () => {
    expect(findNowSlot({ date, schedule, durationMinutes: 120, tables, pax: null, reservations: [], window, now })?.maxSeats).toBe(4)
  })

  it('una hora recién pasada y sin reservar sale como «puede que haya mesa»', () => {
    const late = Date.UTC(2026, 10, 27, 20, 40) // 21:40 en Madrid
    const base = { date, schedule, durationMinutes: 90, tables, pax: null, reservations: [], now: late }
    expect(findMissedSlot({ ...base, missedMinutes: 15 })?.time).toBe('21:30')
    expect(findMissedSlot({ ...base, missedMinutes: 5 })).toBeNull()
    const all = tables.map((table) => ({
      id: table.id, tableId: table.id, status: 'completed',
      startTime: new Date(Date.UTC(2026, 10, 27, 20, 30)), endTime: new Date(Date.UTC(2026, 10, 27, 22, 0)),
    }))
    expect(findMissedSlot({ ...base, reservations: all, missedMinutes: 15 })).toBeNull()
    expect(hasTableFreeNow(tables, all, null, late)).toBe(false)
    expect(hasTableFreeNow(tables, [], null, late)).toBe(true)
  })

  it('distingue el horario automático del que puso el local', () => {
    const auto = defaultSchedule()
    expect(hasOwnSchedule(null, auto)).toBe(false)
    expect(hasOwnSchedule(defaultSchedule(), auto)).toBe(false)
    expect(hasOwnSchedule({ ...auto, monday: { ...auto.monday, periods: [{ open: '13:00', close: '23:00' }] } }, auto)).toBe(false)
    expect(hasOwnSchedule({ ...auto, wednesday: { open: '13:00', close: '23:00', active: true } }, auto)).toBe(true)
    expect(hasOwnSchedule(schedule, auto)).toBe(true)
  })

  it('sabe si está abierto, también pasada la medianoche', () => {
    expect(closesAtIfOpen(schedule, now)?.time).toBe('23:30')
    expect(closesAtIfOpen(schedule, Date.UTC(2026, 10, 27, 16, 0))).toBeNull()
    const night = { ...schedule, friday: { open: '20:00', close: '02:00', active: true } }
    expect(closesAtIfOpen(night, Date.UTC(2026, 10, 28, 0, 30))?.time).toBe('02:00') // sábado 01:30
    expect(closesAtIfOpen(night, Date.UTC(2026, 10, 28, 1, 30))).toBeNull()
  })
})

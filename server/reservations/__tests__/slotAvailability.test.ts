import { describe, expect, it } from 'vitest'
import { madridDateTime } from '../../utils/madridDateTime.ts'
import { parseBookingDate, combineDateAndTime } from '../../reservationSlots.ts'
import { computeDaySlots, promoDayBlockMessage, promoSlotReason } from '../slotAvailability.ts'

const day = { open: '13:00', close: '16:00', active: true }
const schedule = {
  monday: day, tuesday: day, wednesday: day, thursday: day, friday: day, saturday: day, sunday: day,
}

// Un día lejano para que ninguna hora haya pasado ya.
const date = parseBookingDate('2030-03-12')

describe('computeDaySlots', () => {
  it('da las mesas libres de cada hora', () => {
    const start = combineDateAndTime(date, '13:00')
    const slots = computeDaySlots({
      date,
      schedule,
      durationMinutes: 60,
      tableIds: ['m1', 'm2'],
      reservations: [{ id: 'r1', tableId: 'm1', startTime: start, endTime: new Date(start.getTime() + 3600_000), status: 'completed' }],
    })
    expect(slots.map((slot) => slot.time)).toEqual(['13:00', '14:00', '15:00'])
    expect(slots[0].freeTableIds).toEqual(['m2'])
    expect(slots[1].freeTableIds).toEqual(['m1', 'm2'])
  })

  it('las canceladas no ocupan', () => {
    const start = combineDateAndTime(date, '13:00')
    const slots = computeDaySlots({
      date,
      schedule,
      durationMinutes: 60,
      tableIds: ['m1'],
      reservations: [{ id: 'r1', tableId: 'm1', startTime: start, endTime: new Date(start.getTime() + 3600_000), status: 'cancelled' }],
    })
    expect(slots[0].freeTableIds).toEqual(['m1'])
  })
})

describe('promoSlotReason', () => {
  const happy = { type: 'time_limited', activeFromTime: '13:00', activeToTime: '15:00' }
  const attendance = { type: 'attendance', activeFromTime: '13:00', activeToTime: '15:00', arrivalWindowMinutes: 20 }

  it('fuera de la franja no vale', () => {
    expect(promoSlotReason(happy, '15:00', date, ['13:00', '14:00', '15:00'])).toBe('Esta promoción está fuera del horario.')
    expect(promoSlotReason(happy, '14:00', date, ['13:00', '14:00', '15:00'])).toBeNull()
  })

  it('asistencia puntual: solo la primera hora libre de la franja', () => {
    expect(promoSlotReason(attendance, '13:00', date, ['13:00', '14:00'])).toBeNull()
    expect(promoSlotReason(attendance, '14:00', date, ['13:00', '14:00'])).toContain('primera hora disponible (13:00)')
    expect(promoSlotReason(attendance, '14:00', date, ['14:00'])).toBeNull()
  })

  it('asistencia puntual hoy, según la hora de España', () => {
    const today = parseBookingDate('2026-11-10')
    const before = madridDateTime('2026-11-10', '12:00')
    const after = madridDateTime('2026-11-10', '15:30')
    const during = madridDateTime('2026-11-10', '13:10')
    expect(promoDayBlockMessage(attendance, today, before)).toContain('empieza a las 13:00')
    expect(promoDayBlockMessage(attendance, today, after)).toBe('La promo de asistencia puntual ya ha terminado hoy.')
    expect(promoDayBlockMessage(attendance, today, during)).toBeNull()
    // A las 13:10 ya pasó la de 13:00: la primera que vale es la de 14:00.
    expect(promoSlotReason(attendance, '14:00', today, ['13:00', '14:00'], during)).toBeNull()
  })
})

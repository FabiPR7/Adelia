import { describe, expect, it } from 'vitest'
import { generateSlotTimes as serverSlots } from '../reservationSlots.ts'

const day = { open: '20:00', close: '21:00', active: true, periods: [{ open: '20:00', close: '21:00' }] }
const schedule = {
  monday: day, tuesday: day, wednesday: day, thursday: day, friday: day, saturday: day, sunday: day,
}
const date = new Date(Date.UTC(2030, 0, 7, 12))

describe('generateSlotTimes con una duración rara guardada en la base', () => {
  for (const [name, generate] of [['servidor', serverSlots]] as const) {
    it(`${name}: con 0 no se queda en bucle y usa 5 minutos`, () => {
      const slots = generate(date, schedule as never, 0, 0)
      expect(slots[0]).toBe('20:00')
      expect(slots).toHaveLength(12)
    })

    it(`${name}: con 60 da una sola hora`, () => {
      expect(generate(date, schedule as never, 60, 60)).toEqual(['20:00'])
    })
  }
})

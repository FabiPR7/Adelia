import { describe, expect, it } from 'vitest'
import { groupBookableSlots } from '../bookingSlotGroups'

function slot(time: string, available = true) {
  return { time, available }
}

describe('groupBookableSlots', () => {
  it('groups free slots by meal period', () => {
    const groups = groupBookableSlots([
      slot('10:00'),
      slot('13:30'),
      slot('16:55'),
      slot('17:00'),
      slot('21:15'),
    ])

    expect(groups.map((group) => [group.label, group.slots.map((item) => item.time)])).toEqual([
      ['Mañana', ['10:00']],
      ['Mediodía', ['13:30', '16:55']],
      ['Tarde', ['17:00']],
      ['Noche', ['21:15']],
    ])
  })

  it('hides taken or past slots', () => {
    const groups = groupBookableSlots([slot('13:00', false), slot('14:00')])

    expect(groups).toHaveLength(1)
    expect(groups[0].slots.map((item) => item.time)).toEqual(['14:00'])
  })

  it('returns no groups when nothing can be booked', () => {
    expect(groupBookableSlots([slot('20:00', false)])).toEqual([])
  })
})

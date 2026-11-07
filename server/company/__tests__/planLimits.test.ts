import { describe, expect, it } from 'vitest'
import { clampPromotionsToPlan } from '../planLimits.ts'

const promos = (type: string, count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `${type}-${index}`, type }))

const clamp = (items: { type: string }[], planId: 'free' | 'basic' | 'premium') =>
  clampPromotionsToPlan(items, planId, (item) => item.type)

describe('clampPromotionsToPlan', () => {
  it('publishes nothing on the free plan', () => {
    expect(clamp(promos('reservation_ladder', 2), 'free')).toEqual([])
  })

  it('limits Sala to 3 ladder promotions and no other types', () => {
    const result = clamp([...promos('reservation_ladder', 5), ...promos('time_limited', 2)], 'basic')

    expect(result).toHaveLength(3)
    expect(result.every((item) => item.type === 'reservation_ladder')).toBe(true)
  })

  it('limits Local to 5 of each type', () => {
    const result = clamp([...promos('reservation_ladder', 7), ...promos('attendance', 7)], 'premium')

    expect(result).toHaveLength(10)
  })
})

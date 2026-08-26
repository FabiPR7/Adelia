import { describe, expect, it } from 'vitest'
import { restaurantCarouselItemKey, wrapCarouselOffset } from '../../utils/restaurantCarousel'

describe('restaurantCarouselItemKey', () => {
  it('keeps repeated restaurant cards unique inside each carousel group', () => {
    const keys = Array.from(
      { length: 8 },
      (_, index) => restaurantCarouselItemKey('b', 'B15eoNiYXePNJBSH67UW', index),
    )

    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('wrapCarouselOffset', () => {
  it('keeps the offset inside the middle copy of a three-group loop', () => {
    expect(wrapCarouselOffset(0, 400)).toBe(400)
    expect(wrapCarouselOffset(400, 400)).toBe(400)
    expect(wrapCarouselOffset(799.5, 400)).toBe(799.5)
    expect(wrapCarouselOffset(800, 400)).toBe(400)
    expect(wrapCarouselOffset(-50, 400)).toBe(750)
  })
})

import { describe, expect, it } from 'vitest'
import { nextNearbyFeedCount, sliceNearbyFeed } from '../nearbyRestaurantFeed'

describe('nearbyRestaurantFeed', () => {
  it('starts with five items and grows five at a time', () => {
    expect(nextNearbyFeedCount(0, 23)).toBe(5)
    expect(nextNearbyFeedCount(5, 23)).toBe(10)
    expect(nextNearbyFeedCount(20, 23)).toBe(23)
    expect(nextNearbyFeedCount(23, 23)).toBe(23)
  })

  it('does not grow past an empty list', () => {
    expect(nextNearbyFeedCount(0, 0)).toBe(0)
  })

  it('slices only the visible page', () => {
    expect(sliceNearbyFeed(['a', 'b', 'c', 'd', 'e', 'f'], 5)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(sliceNearbyFeed(['a', 'b'], 5)).toEqual(['a', 'b'])
  })
})

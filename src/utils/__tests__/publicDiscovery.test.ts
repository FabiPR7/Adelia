import { describe, expect, it } from 'vitest'
import {
  getDiscoveryAdelinaSlotStates,
  restaurantMatchesVenueKind,
  restaurantsForCarouselRows,
  type PublicDiscoveryRestaurant,
} from '../publicDiscovery'

function fakeRestaurants(count: number): PublicDiscoveryRestaurant[] {
  return Array.from({ length: count }, (_, index) => ({ id: `r${index}` }) as PublicDiscoveryRestaurant)
}

describe('restaurantsForCarouselRows', () => {
  it('puts every restaurant in both rows, the second shifted, when there are few', () => {
    const { primary, secondary } = restaurantsForCarouselRows(fakeRestaurants(6))

    expect(primary.map((item) => item.id)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4', 'r5'])
    expect(secondary.map((item) => item.id)).toEqual(['r3', 'r4', 'r5', 'r0', 'r1', 'r2'])
  })

  it('splits the list in two rows once there are enough restaurants', () => {
    const { primary, secondary } = restaurantsForCarouselRows(fakeRestaurants(12))

    expect(primary).toHaveLength(6)
    expect(secondary).toHaveLength(6)
  })

  it('shows a single row for a single restaurant', () => {
    const { primary, secondary } = restaurantsForCarouselRows(fakeRestaurants(1))

    expect(primary).toHaveLength(1)
    expect(secondary).toHaveLength(0)
  })
})

describe('restaurantMatchesVenueKind', () => {
  it('only keeps bars when the Bares filter is on', () => {
    expect(restaurantMatchesVenueKind({ venueTypes: ['bar'] }, 'bar')).toBe(true)
    expect(restaurantMatchesVenueKind({ venueTypes: ['tapas_bar'] }, 'bar')).toBe(true)
    expect(restaurantMatchesVenueKind({ venueTypes: ['restaurant'] }, 'bar')).toBe(false)
    expect(restaurantMatchesVenueKind({ venueTypes: ['gastrobar'] }, 'bar')).toBe(false)
    expect(restaurantMatchesVenueKind({ venueTypes: [] }, 'bar')).toBe(false)
    expect(restaurantMatchesVenueKind({ venueTypes: ['restaurant', 'bar'] }, 'bar')).toBe(false)
    expect(restaurantMatchesVenueKind({ venueTypes: ['bar', 'restaurant'] }, 'bar')).toBe(true)
  })

  it('only keeps restaurants when the Restaurantes filter is on', () => {
    expect(restaurantMatchesVenueKind({ venueTypes: ['restaurant'] }, 'restaurant')).toBe(true)
    expect(restaurantMatchesVenueKind({ venueTypes: ['bistro'] }, 'restaurant')).toBe(true)
    expect(restaurantMatchesVenueKind({ venueTypes: ['bar'] }, 'restaurant')).toBe(false)
    expect(restaurantMatchesVenueKind({ venueTypes: ['cafe'] }, 'restaurant')).toBe(false)
    expect(restaurantMatchesVenueKind({ venueTypes: [] }, 'restaurant')).toBe(true)
    expect(restaurantMatchesVenueKind({ venueTypes: ['restaurant', 'bar'] }, 'restaurant')).toBe(true)
  })
})

describe('getDiscoveryAdelinaSlotStates', () => {
  it('fills coins from the average rating, not from accumulated Adelina points', () => {
    const slots = getDiscoveryAdelinaSlotStates({
      reviewCount: 2,
      reviewRatingSum: 8,
    })

    expect(slots.filter((slot) => slot === 'full')).toHaveLength(4)
    expect(slots.filter((slot) => slot === 'empty')).toHaveLength(1)
  })

  it('keeps every coin empty when the restaurant has no reviews', () => {
    const slots = getDiscoveryAdelinaSlotStates({
      reviewCount: 0,
      reviewRatingSum: 0,
    })

    expect(slots.every((slot) => slot === 'empty')).toBe(true)
  })
})

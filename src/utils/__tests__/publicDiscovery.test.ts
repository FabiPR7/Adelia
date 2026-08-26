import { describe, expect, it } from 'vitest'
import {
  getDiscoveryAdelinaSlotStates,
  restaurantMatchesVenueKind,
} from '../publicDiscovery'

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

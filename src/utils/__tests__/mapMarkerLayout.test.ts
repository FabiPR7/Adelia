import { describe, expect, it } from 'vitest'
import {
  countPromotionsByCompany,
  markerSizeForGap,
  nearestNeighborDistances,
  promoTierForCount,
} from '../mapMarkerLayout'

describe('nearestNeighborDistances', () => {
  it('measures each point against its closest neighbour', () => {
    const distances = nearestNeighborDistances([
      { x: 0, y: 0 },
      { x: 30, y: 40 },
      { x: 300, y: 0 },
    ])

    expect(distances[0]).toBe(50)
    expect(distances[1]).toBe(50)
    expect(Math.round(distances[2])).toBe(273)
  })

  it('treats a lonely point as having all the room it needs', () => {
    expect(nearestNeighborDistances([{ x: 10, y: 10 }])).toEqual([Number.POSITIVE_INFINITY])
  })
})

describe('markerSizeForGap', () => {
  it('shrinks markers as they get closer together', () => {
    expect(markerSizeForGap(Number.POSITIVE_INFINITY)).toBe('large')
    expect(markerSizeForGap(120)).toBe('large')
    expect(markerSizeForGap(80)).toBe('medium')
    expect(markerSizeForGap(20)).toBe('small')
  })
})

describe('promoTierForCount', () => {
  it('caps the highlight at three promotions', () => {
    expect([0, 1, 2, 3, 7].map(promoTierForCount)).toEqual([0, 1, 2, 3, 3])
  })
})

describe('countPromotionsByCompany', () => {
  it('counts active promotions per restaurant', () => {
    expect(
      countPromotionsByCompany([{ companyId: 'a' }, { companyId: 'b' }, { companyId: 'a' }]),
    ).toEqual({ a: 2, b: 1 })
  })
})

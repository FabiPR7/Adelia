import { describe, expect, it } from 'vitest'
import type { MissionProgress } from '../../types/gamification'
import type { PublicDiscoveryRestaurant } from '../publicDiscovery'
import { applyQuickFilters, missionFilterLabel, missionSearchFocus, type QuickFilterId } from '../discoveryQuickFilters'

const restaurant = (id: string, overrides: Partial<PublicDiscoveryRestaurant> = {}): PublicDiscoveryRestaurant => ({
  id,
  name: id,
  slug: id,
  location: '',
  municipality: '',
  country: '',
  latitude: null,
  longitude: null,
  photoUrl: '',
  characteristics: [],
  venueTypes: [],
  amenities: [],
  priceRange: '' as PublicDiscoveryRestaurant['priceRange'],
  searchText: id,
  reviewCount: 0,
  reviewRatingSum: 0,
  reviewAdelinas: 0,
  discoveryFeatured: false,
  reservationMode: 'optional',
  ...overrides,
})

const missionOf = (id: string): MissionProgress => ({
  mission: { id, name: 'Misión', description: '', xp: 50, cadence: 'weekly', icon: '🏅', target: 1 },
  current: 0,
  completed: false,
  progress: 0,
})

const all = [
  restaurant('a'),
  restaurant('b', { reservationMode: 'none' }),
  restaurant('c', { reviewCount: 4, reviewRatingSum: 20 }),
  restaurant('d', { reviewCount: 4, reviewRatingSum: 12 }),
]
const on = (...ids: QuickFilterId[]) => new Set(ids)
const ids = (list: PublicDiscoveryRestaurant[]) => list.map((item) => item.id)

describe('discovery quick filters', () => {
  it('keeps only restaurants with an active promotion', () => {
    expect(ids(applyQuickFilters(all, on('promo'), { promoCounts: { a: 2, c: 1 } }))).toEqual(['a', 'c'])
    expect(applyQuickFilters(all, on('promo'), {})).toEqual([])
  })

  it('keeps only restaurants that take reservations', () => {
    expect(ids(applyQuickFilters(all, on('reservable'), {}))).toEqual(['a', 'c', 'd'])
  })

  it('shows restaurants the diner has not visited yet', () => {
    expect(ids(applyQuickFilters(all, on('unvisited'), { visitedCompanyIds: ['a', 'd'] }))).toEqual(['b', 'c'])
  })

  it('sorts by rating without dropping anyone, unless the order must be kept', () => {
    expect(ids(applyQuickFilters(all, on('topRated'), {}))[0]).toBe('c')
    expect(ids(applyQuickFilters(all, on('topRated'), {}, { keepOrder: true }))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('combines filters', () => {
    expect(ids(applyQuickFilters(all, on('promo', 'reservable'), { promoCounts: { a: 1, b: 1 } }))).toEqual(['a'])
  })

  it('narrows to what helps the closest mission', () => {
    expect(missionSearchFocus(missionOf('consumo_sin_reserva_semana').mission)).toBe('promo')
    expect(missionSearchFocus(missionOf('critico_foto').mission)).toBe('visited')
    expect(missionSearchFocus(missionOf('reserva_confirmada_semana').mission)).toBe('reservable')
    expect(missionSearchFocus(missionOf('visita_bar_semana').mission)).toBe('unvisited')

    const reservation = applyQuickFilters(all, on('mission'), { mission: missionOf('reserva_confirmada_semana') })
    expect(ids(reservation)).toEqual(['a', 'c', 'd'])
    const review = applyQuickFilters(all, on('mission'), { mission: missionOf('critico_foto'), visitedCompanyIds: ['c'] })
    expect(ids(review)).toEqual(['c'])
  })

  it('ignores the mission filter when there is no mission', () => {
    expect(applyQuickFilters(all, on('mission'), { mission: null })).toHaveLength(4)
  })

  it('labels the mission filter with the mission name', () => {
    expect(missionFilterLabel(missionOf('reserva_confirmada_semana').mission)).toBe('Para «Misión» · con reserva')
  })
})

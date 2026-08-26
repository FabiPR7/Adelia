import { describe, expect, it } from 'vitest'
import {
  migrateAmenitiesFromCharacteristics,
  migrateVenueTypesFromCharacteristics,
  parseCompanyProfileFacilities,
  sanitizeCompanyAmenities,
  sanitizeCompanyPriceRange,
  sanitizeCompanyVenueTypes,
  stripMigratedCharacteristics,
  venueTypesIncludeKind,
} from '../companyProfileFacilities'

describe('companyProfileFacilities', () => {
  it('acepta servicios y tipos válidos y descarta el resto', () => {
    expect(sanitizeCompanyAmenities(['wifi', 'parking', 'hack'])).toEqual(['wifi', 'parking'])
    expect(sanitizeCompanyVenueTypes(['bar', 'restaurant', 'restaurant', 'foo'])).toEqual(['bar', 'restaurant'])
    expect(sanitizeCompanyPriceRange('3')).toBe('3')
    expect(sanitizeCompanyPriceRange('caro')).toBe('')
  })

  it('migra características antiguas a servicios y tipo de local', () => {
    const old = ['Tapas', 'Parking', 'Cafetería', 'Pet friendly', 'Italiana']
    expect(migrateAmenitiesFromCharacteristics(old)).toEqual(['parking', 'pet_friendly'])
    expect(migrateVenueTypesFromCharacteristics(old)).toEqual(['cafe'])
    expect(stripMigratedCharacteristics(old)).toEqual(['Tapas', 'Italiana'])
  })

  it('usa los campos guardados si ya existen', () => {
    const parsed = parseCompanyProfileFacilities(
      { amenities: ['wifi'], venueTypes: ['bar'], priceRange: '2' },
      ['Parking', 'Tapas'],
    )
    expect(parsed.amenities).toEqual(['wifi'])
    expect(parsed.venueTypes).toEqual(['bar'])
    expect(parsed.priceRange).toBe('2')
    expect(parsed.characteristics).toEqual(['Tapas'])
  })

  it('un local entra en bares, restaurantes o ambos según su tipo', () => {
    expect(venueTypesIncludeKind(['bar'], 'bar')).toBe(true)
    expect(venueTypesIncludeKind(['bar'], 'restaurant')).toBe(false)
    expect(venueTypesIncludeKind(['restaurant'], 'restaurant')).toBe(true)
    expect(venueTypesIncludeKind(['restaurant'], 'bar')).toBe(false)
    expect(venueTypesIncludeKind(['bar', 'restaurant'], 'bar')).toBe(true)
    expect(venueTypesIncludeKind(['bar', 'restaurant'], 'restaurant')).toBe(true)
    expect(venueTypesIncludeKind(['gastrobar'], 'bar')).toBe(false)
    expect(venueTypesIncludeKind(['gastrobar'], 'restaurant')).toBe(true)
    expect(venueTypesIncludeKind(['cafe'], 'bar')).toBe(false)
    expect(venueTypesIncludeKind(['cafe'], 'restaurant')).toBe(false)
    expect(venueTypesIncludeKind([], 'bar')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  CITY_MIN_RESTAURANTS,
  cityTier,
  countryTiers,
  normalizeCountry,
  tierReached,
  tierTarget,
} from '../restaurantCollection.ts'

describe('mapa gastronómico', () => {
  it('la ciudad se completa visitando todos, solo si hay suficientes restaurantes', () => {
    const tier = cityTier('logrono', 'Logroño')
    expect(tierReached(tier, 97, 97)).toBe(true)
    expect(tierReached(tier, 96, 97)).toBe(false)
    expect(tierTarget(tier, CITY_MIN_RESTAURANTS - 1)).toBe(0)
    expect(tierReached(tier, 3, 3)).toBe(false)
  })

  it('los tramos del país piden porcentaje y un mínimo de visitas', () => {
    const [ten, quarter, half, all] = countryTiers('espana', 'España')
    expect(tierTarget(ten, 976)).toBe(98)
    expect(tierTarget(ten, 20)).toBe(5)
    expect(tierReached(quarter, 244, 976)).toBe(true)
    expect(tierReached(half, 487, 976)).toBe(false)
    expect(tierTarget(all, 976)).toBe(976)
    // Con menos restaurantes que el mínimo, el tramo no se puede conseguir.
    expect(tierReached(all, 10, 10)).toBe(false)
  })

  it('normaliza el país', () => {
    expect(normalizeCountry('  España ')).toBe('espana')
  })
})

import { describe, expect, it } from 'vitest'
import { cityKey, distanceKm, encodeGeohash, geohashPrefixesForRadius } from '../geohash.ts'

describe('geohash', () => {
  it('coincide con valores conocidos', () => {
    // Ejemplo clásico de geohash.org.
    expect(encodeGeohash(57.64911, 10.40744, 11)).toBe('u4pruydqqvj')
    // Puerta del Sol, Madrid.
    expect(encodeGeohash(40.4169, -3.7035, 5)).toBe('ezjmg')
  })

  it('los prefijos de un radio contienen al restaurante cercano y no al lejano', () => {
    const logrono = { lat: 42.4627, lng: -2.445 }
    const cerca = { lat: 42.47, lng: -2.43 } // ~1,5 km
    const lejos = { lat: 40.4169, lng: -3.7035 } // Madrid
    const prefixes = geohashPrefixesForRadius(logrono.lat, logrono.lng, 25)
    const hit = (p: { lat: number; lng: number }) =>
      prefixes.some((prefix) => encodeGeohash(p.lat, p.lng).startsWith(prefix))
    expect(hit(cerca)).toBe(true)
    expect(hit(lejos)).toBe(false)
    expect(prefixes.length).toBeLessThanOrEqual(9)
  })

  it('distancia y clave de ciudad', () => {
    expect(Math.round(distanceKm({ lat: 42.4627, lng: -2.445 }, { lat: 40.4169, lng: -3.7035 }))).toBe(250)
    expect(cityKey('  Logroño ')).toBe('logrono')
    expect(cityKey('A Coruña')).toBe('a coruna')
  })
})

/**
 * Geohash para el índice público de restaurantes ("cerca de ti" sin leer toda la
 * colección). Copia de server/utils/geohash.ts: mantener las dos iguales.
 */
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

export const GEOHASH_PRECISION = 9

export function encodeGeohash(lat: number, lng: number, precision = GEOHASH_PRECISION): string {
  let latMin = -90
  let latMax = 90
  let lngMin = -180
  let lngMax = 180
  let hash = ''
  let bit = 0
  let ch = 0
  let evenBit = true

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2
      if (lng >= mid) {
        ch = (ch << 1) | 1
        lngMin = mid
      } else {
        ch <<= 1
        lngMax = mid
      }
    } else {
      const mid = (latMin + latMax) / 2
      if (lat >= mid) {
        ch = (ch << 1) | 1
        latMin = mid
      } else {
        ch <<= 1
        latMax = mid
      }
    }
    evenBit = !evenBit
    bit += 1
    if (bit === 5) {
      hash += BASE32[ch]
      bit = 0
      ch = 0
    }
  }

  return hash
}

/** Clave de ciudad para buscar por igualdad: minúsculas, sin tildes ni espacios sobrantes. */
export function cityKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Geohash: convierte lat/lng en un texto cuyo prefijo común = cercanía. Permite
 * buscar "restaurantes cerca" en Firestore con consultas de rango sobre un campo,
 * sin leer toda la colección. (Copia en src/utils/geohash.ts para la web.)
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

/** Tamaño aproximado de una celda (grados) para cada precisión. */
function cellSize(precision: number): { lat: number; lng: number } {
  const bits = precision * 5
  const lngBits = Math.ceil(bits / 2)
  const latBits = Math.floor(bits / 2)
  return { lat: 180 / 2 ** latBits, lng: 360 / 2 ** lngBits }
}

/**
 * Prefijos que cubren un círculo: la celda del centro y sus vecinas, con la
 * precisión más fina cuya celda sigue siendo mayor que el radio.
 */
export function geohashPrefixesForRadius(lat: number, lng: number, radiusKm: number): string[] {
  const latKm = 111
  const lngKm = Math.max(1, 111 * Math.cos((lat * Math.PI) / 180))
  let precision = 1
  for (let candidate = 9; candidate >= 1; candidate -= 1) {
    const size = cellSize(candidate)
    if (size.lat * latKm >= radiusKm && size.lng * lngKm >= radiusKm) {
      precision = candidate
      break
    }
  }

  const size = cellSize(precision)
  const prefixes = new Set<string>()
  for (const dLat of [-1, 0, 1]) {
    for (const dLng of [-1, 0, 1]) {
      const pLat = Math.max(-89.999, Math.min(89.999, lat + dLat * size.lat))
      let pLng = lng + dLng * size.lng
      if (pLng > 180) pLng -= 360
      if (pLng < -180) pLng += 360
      prefixes.add(encodeGeohash(pLat, pLng, precision))
    }
  }
  return [...prefixes]
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
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

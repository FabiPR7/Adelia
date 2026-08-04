import type { GeoCoordinates } from './geo'

export function isValidMapCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return false
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return false
  }

  return !(latitude === 0 && longitude === 0)
}

export function toGeoCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): GeoCoordinates | null {
  if (!isValidMapCoordinates(latitude, longitude)) {
    return null
  }

  return {
    lat: latitude as number,
    lng: longitude as number,
  }
}

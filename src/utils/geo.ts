export interface GeoCoordinates {
  lat: number
  lng: number
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

/** Distancia en línea recta entre dos puntos (km). */
export function haversineDistanceKm(from: GeoCoordinates, to: GeoCoordinates): number {
  const earthRadiusKm = 6371
  const deltaLat = toRadians(to.lat - from.lat)
  const deltaLng = toRadians(to.lng - from.lng)
  const lat1 = toRadians(from.lat)
  const lat2 = toRadians(to.lat)

  const haversine =
    Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export function formatDistanceKm(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.max(50, Math.round(distanceKm * 1000))} m`
  }

  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)} km`
  }

  return `${Math.round(distanceKm)} km`
}

/** Radio para el mapa «Cerca tuyo» en exploración. */
export const DISCOVERY_NEARBY_MAX_KM = 20

/** Radio para ofertas cercanas en la pestaña de promociones. */
export const PROMO_NEARBY_MAX_KM = 35

/** Tiempo estimado de desplazamiento según distancia en línea recta. */
export function estimateTravelMinutes(distanceKm: number, mode: 'driving' | 'walking'): number {
  const speedKmh = mode === 'driving' ? 35 : 5
  return Math.max(1, Math.round((distanceKm / speedKmh) * 60))
}

export function formatTravelMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`
}

export function buildGoogleMapsDirectionsUrl(
  origin: GeoCoordinates,
  destination: GeoCoordinates,
  travelMode: 'driving' | 'walking' = 'driving',
): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: travelMode,
  })

  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/**
 * Puntos de la zona con más locales (los que quedan a `radiusKm` del punto con
 * más vecinos). Sirve para encuadrar el mapa sin que un local suelto en otra
 * ciudad obligue a alejarlo hasta ver media España.
 */
export function densestClusterPoints<T extends GeoCoordinates>(points: T[], radiusKm = 40): T[] {
  if (points.length <= 2) {
    return points
  }

  let best = points[0]
  let bestCount = -1
  for (const candidate of points) {
    const count = points.filter((other) => haversineDistanceKm(candidate, other) <= radiusKm).length
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }

  return points.filter((point) => haversineDistanceKm(best, point) <= radiusKm)
}

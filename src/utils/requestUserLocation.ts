import { geocodePlace } from '../services/geocoding'
import type { GeoCoordinates } from './geo'

export type UserLocationSource = 'gps' | 'city'

export interface UserLocationResult {
  source: UserLocationSource
  coords: GeoCoordinates
  cityLabel?: string
}

function readPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

async function readGpsLocation(): Promise<GeoCoordinates | null> {
  if (!navigator.geolocation) {
    return null
  }

  const attempts: PositionOptions[] = [
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 },
    { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
  ]

  for (const options of attempts) {
    try {
      const position = await readPosition(options)

      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }
    } catch {
      // Siguiente intento con otra precisión.
    }
  }

  return null
}

export async function requestUserLocation(cityFallbackLabel = ''): Promise<UserLocationResult> {
  if (!window.isSecureContext) {
    throw new Error('SECURE_CONTEXT_REQUIRED')
  }

  const gpsCoords = await readGpsLocation()

  if (gpsCoords) {
    return {
      source: 'gps',
      coords: gpsCoords,
    }
  }

  const trimmedCity = cityFallbackLabel.trim()

  if (trimmedCity) {
    const cityCoords = await geocodePlace(trimmedCity)

    if (cityCoords) {
      return {
        source: 'city',
        coords: cityCoords,
        cityLabel: trimmedCity,
      }
    }
  }

  throw new Error('LOCATION_UNAVAILABLE')
}

export function getLocationErrorMessage(error: unknown, hasCitySelected: boolean): string {
  if (error instanceof Error && error.message === 'SECURE_CONTEXT_REQUIRED') {
    return 'La ubicación solo funciona en HTTPS o en localhost.'
  }

  if (hasCitySelected) {
    return 'No pudimos usar tu GPS ni localizar la ciudad. Revisa permisos e inténtalo otra vez.'
  }

  return 'Permite ubicación en el navegador o elige una ciudad para ordenar por distancia.'
}

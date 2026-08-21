/**
 * Servicio de geolocalización mejorado
 * Detecta automáticamente país, ciudad y coordenadas del usuario
 */

export interface GeolocationResult {
  latitude: number
  longitude: number
  city: string
  municipality: string
  country: string
  postalCode: string
  error?: string
}

/**
 * Obtiene la ubicación actual del usuario usando la API de geolocalización del navegador
 */
export async function getCurrentLocation(): Promise<{
  latitude: number
  longitude: number
} | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocalización no disponible en este navegador')
      resolve(null)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => {
        console.warn('Error obteniendo geolocalización:', error)
        resolve(null)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutos de caché
      }
    )
  })
}

/**
 * Reverse geocoding: convierte coordenadas en dirección usando Nominatim (OpenStreetMap)
 * API gratuita y sin límites estrictos
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeolocationResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=es`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Adelia-App', // Nominatim requiere User-Agent
      },
    })

    if (!response.ok) {
      throw new Error('Error en geocodificación inversa')
    }

    const data = await response.json()

    if (!data.address) {
      return null
    }

    const address = data.address

    return {
      latitude,
      longitude,
      city: address.city || address.town || address.village || address.hamlet || '',
      municipality: address.municipality || address.city || address.town || address.village || '',
      country: address.country || '',
      postalCode: address.postcode || '',
    }
  } catch (error) {
    console.error('Error en reverse geocoding:', error)
    return null
  }
}

/**
 * Geocoding: convierte una dirección en coordenadas usando Nominatim
 */
export async function geocodeAddress(address: string): Promise<{
  latitude: number
  longitude: number
  city: string
  country: string
} | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&accept-language=es&limit=1`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Adelia-App',
      },
    })

    if (!response.ok) {
      throw new Error('Error en geocodificación')
    }

    const data = await response.json()

    if (!data || data.length === 0) {
      return null
    }

    const result = data[0]

    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      city: result.address?.city || result.address?.town || result.display_name.split(',')[0] || '',
      country: result.address?.country || '',
    }
  } catch (error) {
    console.error('Error en geocoding:', error)
    return null
  }
}

/**
 * Detecta automáticamente la ubicación completa del usuario
 * 1. Obtiene coordenadas del navegador
 * 2. Hace reverse geocoding para obtener dirección
 */
export async function detectUserLocation(): Promise<GeolocationResult | null> {
  // Paso 1: Obtener coordenadas
  const coords = await getCurrentLocation()
  
  if (!coords) {
    return null
  }

  // Paso 2: Reverse geocoding
  const location = await reverseGeocode(coords.latitude, coords.longitude)
  
  return location
}

/**
 * Valida si las coordenadas son válidas
 */
export function areValidCoordinates(
  latitude: number | null,
  longitude: number | null
): boolean {
  if (latitude === null || longitude === null) {
    return false
  }

  return (
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude)
  )
}

import type { GeoCoordinates } from '../utils/geo'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import { buildRestaurantGeocodeQuery } from '../utils/publicDiscovery'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const geocodeCache = new Map<string, GeoCoordinates>()

export async function geocodePlace(query: string): Promise<GeoCoordinates | null> {
  const trimmed = query.trim()

  if (trimmed.length < 2) {
    return null
  }

  const cacheKey = trimmed.toLowerCase()
  const cached = geocodeCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const url = `${API_BASE}/api/public/geocode?q=${encodeURIComponent(trimmed)}`
  const response = await fetch(url)

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as {
    lat?: number | null
    lng?: number | null
    error?: string
  }

  if (typeof payload.lat !== 'number' || typeof payload.lng !== 'number') {
    return null
  }

  const coordinates = { lat: payload.lat, lng: payload.lng }
  geocodeCache.set(cacheKey, coordinates)
  return coordinates
}

export interface AddressSuggestion {
  id: string
  title: string
  subtitle: string
  label: string
  lat: number
  lng: number
  /** Por partes (solo en sugerencias nuevas del servidor). */
  street?: string
  houseNumber?: string
  postalCode?: string
  city?: string
  region?: string
  country?: string
}

export async function suggestAddresses(
  query: string,
  near: GeoCoordinates | null,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim()

  if (trimmed.length < 3) {
    return []
  }

  const params = new URLSearchParams({ q: trimmed })
  if (near) {
    params.set('lat', near.lat.toFixed(4))
    params.set('lng', near.lng.toFixed(4))
  }

  const response = await fetch(`${API_BASE}/api/public/geocode/suggest?${params.toString()}`, { signal })

  if (!response.ok) {
    return []
  }

  const payload = (await response.json()) as { suggestions?: AddressSuggestion[] }
  return payload.suggestions ?? []
}

export async function resolveRestaurantCoordinates(
  restaurants: PublicDiscoveryRestaurant[],
): Promise<Record<string, GeoCoordinates>> {
  const coordinates: Record<string, GeoCoordinates> = {}

  for (const restaurant of restaurants) {
    const query = buildRestaurantGeocodeQuery(restaurant)
    const result = await geocodePlace(query)

    if (result) {
      coordinates[restaurant.slug] = result
    }

    // Pequeña pausa para no saturar el servicio de geocodificación.
    await new Promise((resolve) => {
      window.setTimeout(resolve, 80)
    })
  }

  return coordinates
}

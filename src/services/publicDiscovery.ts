import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import { parseCompanyReservationMode } from '../data/companyReservationMode'
import {
  parseCompanyProfileFacilities,
  sanitizeCompanyPriceRange,
  sanitizeCompanyVenueTypes,
} from '../data/companyProfileFacilities'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const DISCOVERY_CACHE_MS = 120_000

export interface DiscoveryOptions {
  /** Restaurantes cerca de este punto (radio en km; por defecto 25). */
  near?: { lat: number; lng: number; radiusKm?: number }
  /** Restaurantes de esta ciudad. */
  city?: string
  /** Siguiente página del listado general (lo devuelve la página anterior). */
  cursor?: string
}

export interface DiscoveryResult {
  restaurants: PublicDiscoveryRestaurant[]
  nextCursor: string | null
  /** Sin internet: es la copia guardada en el navegador (fecha en ms). */
  offlineAt?: number
}

const cache = new Map<string, { at: number; result: DiscoveryResult }>()
const inflight = new Map<string, Promise<DiscoveryResult>>()

function discoveryQueryString(options: DiscoveryOptions): string {
  const params = new URLSearchParams()
  if (options.near) {
    // ~1 km de precisión: misma URL para vecinos cercanos (caché del CDN).
    params.set('lat', options.near.lat.toFixed(2))
    params.set('lng', options.near.lng.toFixed(2))
    if (options.near.radiusKm) params.set('radiusKm', String(Math.round(options.near.radiusKm)))
  } else if (options.city?.trim()) {
    params.set('city', options.city.trim())
  } else if (options.cursor) {
    params.set('cursor', options.cursor)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

function mapApiRestaurant(raw: Record<string, unknown>): PublicDiscoveryRestaurant | null {
  const id = typeof raw.id === 'string' ? raw.id : ''
  const name = typeof raw.name === 'string' ? raw.name : ''
  const slug = typeof raw.slug === 'string' ? raw.slug : ''
  if (!id || !name || !slug) {
    return null
  }

  const characteristics = Array.isArray(raw.characteristics)
    ? raw.characteristics.filter((item): item is string => typeof item === 'string')
    : []
  const parsed = parseCompanyProfileFacilities(raw, characteristics)

  return {
    id,
    name,
    slug,
    location: typeof raw.location === 'string' ? raw.location : '',
    municipality: typeof raw.municipality === 'string' ? raw.municipality : '',
    country: typeof raw.country === 'string' ? raw.country : '',
    latitude: typeof raw.latitude === 'number' ? raw.latitude : null,
    longitude: typeof raw.longitude === 'number' ? raw.longitude : null,
    photoUrl: typeof raw.photoUrl === 'string' ? raw.photoUrl.replace(/^http:\/\//, 'https://') : '',
    characteristics: parsed.characteristics,
    venueTypes: Array.isArray(raw.venueTypes)
      ? sanitizeCompanyVenueTypes(raw.venueTypes)
      : [],
    amenities: parsed.amenities,
    priceRange: parsed.priceRange || sanitizeCompanyPriceRange(raw.priceRange),
    searchText: typeof raw.searchText === 'string' ? raw.searchText : '',
    reviewCount: typeof raw.reviewCount === 'number' ? raw.reviewCount : 0,
    reviewRatingSum: typeof raw.reviewRatingSum === 'number' ? raw.reviewRatingSum : 0,
    reviewAdelinas: typeof raw.reviewAdelinas === 'number' ? raw.reviewAdelinas : 0,
    discoveryFeatured: raw.discoveryFeatured === true,
    ...(typeof raw.prestigeLevel === 'number' ? { prestigeLevel: raw.prestigeLevel } : {}),
    ...(raw.leagueTop10 === true ? { leagueTop10: true } : {}),
    reservationMode: parseCompanyReservationMode(raw.reservationMode),
    canReserve: raw.canReserve === true,
  }
}

/**
 * Listado público de restaurantes. Sin opciones: los más valorados (primera
 * página). Con `near` o `city`: los de esa zona, aunque haya miles en total.
 */
const OFFLINE_PREFIX = 'adelia-offline:discovery:'

function toResult(payload: { restaurants?: unknown; nextCursor?: unknown }, offlineAt?: number): DiscoveryResult {
  const rawList = Array.isArray(payload.restaurants) ? payload.restaurants : []
  return {
    restaurants: rawList
      .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
      .map(mapApiRestaurant)
      .filter((item): item is PublicDiscoveryRestaurant => item !== null),
    nextCursor: offlineAt ? null : typeof payload.nextCursor === 'string' ? payload.nextCursor : null,
    ...(offlineAt ? { offlineAt } : {}),
  }
}

function saveOfflineDiscovery(key: string, payload: unknown): void {
  try {
    localStorage.setItem(OFFLINE_PREFIX + key, JSON.stringify({ at: Date.now(), value: payload }))
  } catch {
    // Sin espacio o almacenamiento bloqueado: solo no habrá copia.
  }
}

function loadOfflineDiscovery(key: string): { at: number; value: { restaurants?: unknown; nextCursor?: unknown } } | null {
  try {
    const raw = localStorage.getItem(OFFLINE_PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function fetchPublicDiscoveryPage(options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
  const key = discoveryQueryString(options)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < DISCOVERY_CACHE_MS) {
    return hit.result
  }
  const running = inflight.get(key)
  if (running) {
    return running
  }

  const request = (async () => {
    try {
      let response: Response
      try {
        response = await fetch(`${API_BASE}/api/public/discovery${key}`)
      } catch {
        // Sin internet (igual que la app): la última lista guardada de esta búsqueda.
        const stored = loadOfflineDiscovery(key)
        if (stored) return toResult(stored.value, stored.at)
        throw new Error('Sin conexión a internet. Comprueba tu conexión e inténtalo de nuevo.')
      }
      if (!response.ok) {
        throw new Error('No se pudo cargar el listado de restaurantes.')
      }
      const payload = await response.json() as { restaurants?: unknown; nextCursor?: unknown }
      saveOfflineDiscovery(key, payload)
      const result = toResult(payload)
      cache.set(key, { at: Date.now(), result })
      return result
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, request)
  return request
}

/** Atajo para quien solo quiere la lista (sin paginación). */
export async function fetchPublicDiscoveryRestaurants(options: DiscoveryOptions = {}): Promise<PublicDiscoveryRestaurant[]> {
  return (await fetchPublicDiscoveryPage(options)).restaurants
}

/** Restaurantes por su dirección (slug): los favoritos se guardan así. */
export async function fetchDiscoveryRestaurantsBySlugs(slugs: string[]): Promise<PublicDiscoveryRestaurant[]> {
  const unique = [...new Set(slugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean))].slice(0, 30)
  if (unique.length === 0) return []
  const response = await fetch(`${API_BASE}/api/public/discovery/by-slugs?slugs=${encodeURIComponent(unique.join(','))}`)
  if (!response.ok) return []
  const payload = (await response.json()) as { restaurants?: unknown[] }
  return (payload.restaurants ?? [])
    .filter((raw): raw is Record<string, unknown> => Boolean(raw) && typeof raw === 'object')
    .map(mapApiRestaurant)
    .filter((item): item is PublicDiscoveryRestaurant => item !== null)
}

/** Junta listas sin repetir restaurantes (la primera manda en el orden). */
export function mergeDiscoveryRestaurants(
  base: PublicDiscoveryRestaurant[],
  extra: PublicDiscoveryRestaurant[],
): PublicDiscoveryRestaurant[] {
  const seen = new Set(base.map((item) => item.id))
  return [...base, ...extra.filter((item) => !seen.has(item.id))]
}

export interface FeaturedReviewEntry<TReview> {
  slug: string
  review: TReview
}

/**
 * «Últimas valoraciones» en una sola llamada: la mejor reseña reciente de hasta 8
 * locales (el servidor la guarda 10 minutos).
 */
export async function fetchFeaturedReviews<TReview>(slugs: string[]): Promise<FeaturedReviewEntry<TReview>[]> {
  const unique = [...new Set(slugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean))].slice(0, 8).sort()
  if (unique.length === 0) return []
  const response = await fetch(`${API_BASE}/api/public/discovery/featured-reviews?slugs=${encodeURIComponent(unique.join(','))}`)
  if (!response.ok) return []
  const payload = (await response.json()) as { items?: FeaturedReviewEntry<TReview>[] }
  return Array.isArray(payload.items) ? payload.items : []
}

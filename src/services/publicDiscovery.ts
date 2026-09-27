import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import { parseCompanyReservationMode } from '../data/companyReservationMode'
import {
  parseCompanyProfileFacilities,
  sanitizeCompanyPriceRange,
  sanitizeCompanyVenueTypes,
} from '../data/companyProfileFacilities'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const DISCOVERY_CACHE_MS = 120_000

let cached: { at: number; items: PublicDiscoveryRestaurant[] } | null = null
let inflight: Promise<PublicDiscoveryRestaurant[]> | null = null

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
    reservationMode: parseCompanyReservationMode(raw.reservationMode),
  }
}

export async function fetchPublicDiscoveryRestaurants(): Promise<PublicDiscoveryRestaurant[]> {
  if (cached && Date.now() - cached.at < DISCOVERY_CACHE_MS) {
    return cached.items
  }
  if (inflight) {
    return inflight
  }

  inflight = (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/public/discovery`)
      if (!response.ok) {
        throw new Error('No se pudo cargar el listado de restaurantes.')
      }
      const payload = await response.json() as { restaurants?: unknown }
      const rawList = Array.isArray(payload.restaurants) ? payload.restaurants : []
      const items = rawList
        .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
        .map(mapApiRestaurant)
        .filter((item): item is PublicDiscoveryRestaurant => item !== null)
      cached = { at: Date.now(), items }
      return items
    } finally {
      inflight = null
    }
  })()

  return inflight
}

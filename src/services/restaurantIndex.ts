import { doc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import { parseCompanyProfileFacilities, sanitizeCompanyPriceRange, sanitizeCompanyVenueTypes } from '../data/companyProfileFacilities'
import { parseCompanyReservationMode } from '../data/companyReservationMode'


function mapIndexDoc(id: string, data: Record<string, unknown>): PublicDiscoveryRestaurant | null {
  if (data.hasProfile === false) {
    return null
  }

  // El dueño ha desactivado la ficha: fuera de descubrir y de cualquier listado.
  if (data.deactivated === true) {
    return null
  }

  const characteristics = Array.isArray(data.characteristics) ? data.characteristics as string[] : []
  const parsed = parseCompanyProfileFacilities(data, characteristics)

  const restaurant = {
    id,
    name: typeof data.name === 'string' ? data.name : '',
    slug: typeof data.slug === 'string' ? data.slug : '',
    location: typeof data.location === 'string' ? data.location : '',
    municipality: typeof data.municipality === 'string' ? data.municipality : '',
    country: typeof data.country === 'string' ? data.country : '',
    latitude: typeof data.latitude === 'number' ? data.latitude : null,
    longitude: typeof data.longitude === 'number' ? data.longitude : null,
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl.replace(/^http:\/\//, 'https://') : '',
    characteristics: parsed.characteristics,
    venueTypes: Array.isArray(data.venueTypes)
      ? sanitizeCompanyVenueTypes(data.venueTypes)
      : [],
    amenities: parsed.amenities,
    priceRange: parsed.priceRange || sanitizeCompanyPriceRange(data.priceRange),
    searchText: typeof data.searchText === 'string' ? data.searchText : '',
    reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 0,
    reviewRatingSum: typeof data.reviewRatingSum === 'number' ? data.reviewRatingSum : 0,
    reviewAdelinas: typeof data.reviewAdelinas === 'number' ? data.reviewAdelinas : 0,
    discoveryFeatured: data.discoveryFeatured === true,
    reservationMode: parseCompanyReservationMode(data.reservationMode),
    canReserve: data.canReserve === true,
  } satisfies PublicDiscoveryRestaurant

  return restaurant.name && restaurant.slug ? restaurant : null
}


export async function fetchRestaurantIndex(): Promise<PublicDiscoveryRestaurant[]> {
  // El listado público va por /api/public/discovery (Admin SDK + rate limit).
  // Aquí no se hace list client-side: las reglas de Firestore ya no lo permiten.
  return []
}

export async function fetchRestaurantIndexByIds(ids: string[]): Promise<PublicDiscoveryRestaurant[]> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 40)
  if (unique.length === 0) {
    return []
  }

  const snaps = await Promise.all(unique.map((id) => getDoc(doc(db, 'restaurantIndex', id))))
  return snaps
    .map((snap) => snap.exists() ? mapIndexDoc(snap.id, snap.data() as Record<string, unknown>) : null)
    .filter((item): item is PublicDiscoveryRestaurant => item !== null)
}

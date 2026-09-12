import { doc, getDoc, getDocs, collection, limit, query, setDoc, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../config/firebase'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import { companyFacilitySearchTerms, parseCompanyProfileFacilities, sanitizeCompanyPriceRange, sanitizeCompanyVenueTypes, type CompanyPriceRange } from '../data/companyProfileFacilities'
import { DISCOVERY_INDEX_LIMIT } from './firestoreQuery'
import { parseCompanyReservationMode } from '../data/companyReservationMode'

export function restaurantIndexPayload(company: {
  id: string
  name: string
  slug: string
  location?: string
  municipality?: string
  country?: string
  postalCode?: string
  latitude?: number | null
  longitude?: number | null
  logoUrl?: string
  photos?: string[]
  videos?: string[]
  characteristics?: string[]
  venueTypes?: string[]
  amenities?: string[]
  priceRange?: CompanyPriceRange
  description?: string
  reviewCount?: number
  reviewRatingSum?: number
  reviewAdelinas?: number
  discoveryFeatured?: boolean
  deactivated?: boolean
  reservationMode?: import('../data/companyReservationMode').CompanyReservationMode
}, options?: { persistFeatured?: boolean }) {
  const photos = company.photos ?? []
  const characteristics = company.characteristics ?? []
  const venueTypes = company.venueTypes ?? []
  const amenities = company.amenities ?? []
  const priceRange = company.priceRange ?? ''
  const photoUrl = photos[0] ?? company.logoUrl ?? ''
  const description = company.description ?? ''

  return {
    companyId: company.id,
    name: company.name,
    slug: company.slug,
    location: company.location ?? '',
    municipality: company.municipality ?? '',
    country: company.country ?? '',
    postalCode: company.postalCode ?? '',
    latitude: company.latitude ?? null,
    longitude: company.longitude ?? null,
    photoUrl,
    logoUrl: company.logoUrl ?? '',
    characteristics,
    venueTypes,
    amenities,
    priceRange,
    searchText: [
      company.name,
      company.location,
      company.municipality,
      company.country,
      description,
      ...characteristics,
      ...companyFacilitySearchTerms(venueTypes, amenities, priceRange),
    ]
      .join(' ')
      .toLowerCase(),
    reviewCount: company.reviewCount ?? 0,
    reviewRatingSum: company.reviewRatingSum ?? 0,
    reviewAdelinas: company.reviewAdelinas ?? 0,
    reservationMode: parseCompanyReservationMode(company.reservationMode),
    deactivated: company.deactivated === true,
    hasProfile: Boolean(
      description
      || company.municipality
      || company.postalCode
      || company.country
      || characteristics.length
      || venueTypes.length
      || amenities.length
      || photos.length
      || (company.videos?.length ?? 0),
    ),
    ...(options?.persistFeatured && typeof company.discoveryFeatured === 'boolean'
      ? { discoveryFeatured: company.discoveryFeatured }
      : {}),
    updatedAt: serverTimestamp(),
  }
}

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
  } satisfies PublicDiscoveryRestaurant

  return restaurant.name && restaurant.slug ? restaurant : null
}

export async function syncRestaurantIndexFromCompany(
  company: Parameters<typeof restaurantIndexPayload>[0],
): Promise<void> {
  await setDoc(doc(db, 'restaurantIndex', company.id), restaurantIndexPayload(company), { merge: true })
}

export async function fetchRestaurantIndex(): Promise<PublicDiscoveryRestaurant[]> {
  try {
    const indexed = collection(db, 'restaurantIndex')
    const snapshot = await getDocs(
      query(indexed, where('hasProfile', '==', true), limit(DISCOVERY_INDEX_LIMIT)),
    ).catch(() => getDocs(query(indexed, limit(DISCOVERY_INDEX_LIMIT))))

    return snapshot.docs
      .map((item) => mapIndexDoc(item.id, item.data() as Record<string, unknown>))
      .filter((item): item is PublicDiscoveryRestaurant => item !== null)
      .sort((left, right) => {
        if (left.discoveryFeatured !== right.discoveryFeatured) {
          return left.discoveryFeatured ? -1 : 1
        }
        return left.name.localeCompare(right.name, 'es')
      })
  } catch {
    return []
  }
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

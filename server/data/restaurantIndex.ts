import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from './collections.ts'
import { parseCompanyReservationMode } from '../utils.ts'

/** Cap duro de lecturas por request de discovery (Admin SDK). */
export const PUBLIC_DISCOVERY_LIMIT = 80

export interface RestaurantIndexDoc {
  companyId: string
  name: string
  slug: string
  location: string
  municipality: string
  country: string
  postalCode: string
  latitude: number | null
  longitude: number | null
  photoUrl: string
  logoUrl: string
  characteristics: string[]
  venueTypes: string[]
  amenities: string[]
  priceRange: string
  searchText: string
  reviewCount: number
  reviewRatingSum: number
  reviewAdelinas: number
  reservationMode?: 'required' | 'optional' | 'none'
  hasProfile: boolean
  discoveryFeatured?: boolean
  updatedAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp
}

export interface PublicDiscoveryRestaurantPayload {
  id: string
  name: string
  slug: string
  location: string
  municipality: string
  country: string
  latitude: number | null
  longitude: number | null
  photoUrl: string
  characteristics: string[]
  venueTypes: string[]
  amenities: string[]
  priceRange: string
  searchText: string
  reviewCount: number
  reviewRatingSum: number
  reviewAdelinas: number
  discoveryFeatured: boolean
  reservationMode: 'required' | 'optional' | 'none'
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asStringArray(value: unknown, max = 40): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 80))
    .slice(0, max)
}

export function mapRestaurantIndexDoc(
  id: string,
  data: FirebaseFirestore.DocumentData,
): PublicDiscoveryRestaurantPayload | null {
  if (data.hasProfile === false || data.deactivated === true) {
    return null
  }

  const name = asString(data.name).trim()
  const slug = asString(data.slug).trim()
  if (!name || !slug) {
    return null
  }

  const photoUrl = asString(data.photoUrl).replace(/^http:\/\//, 'https://')

  return {
    id,
    name,
    slug,
    location: asString(data.location),
    municipality: asString(data.municipality),
    country: asString(data.country),
    latitude: asNumber(data.latitude),
    longitude: asNumber(data.longitude),
    photoUrl,
    characteristics: asStringArray(data.characteristics),
    venueTypes: asStringArray(data.venueTypes),
    amenities: asStringArray(data.amenities),
    priceRange: asString(data.priceRange).slice(0, 40),
    searchText: asString(data.searchText),
    reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 0,
    reviewRatingSum: typeof data.reviewRatingSum === 'number' ? data.reviewRatingSum : 0,
    reviewAdelinas: typeof data.reviewAdelinas === 'number' ? data.reviewAdelinas : 0,
    discoveryFeatured: data.discoveryFeatured === true,
    reservationMode: parseCompanyReservationMode(data.reservationMode),
  }
}

export async function listPublicDiscoveryRestaurants(
  limit = PUBLIC_DISCOVERY_LIMIT,
): Promise<PublicDiscoveryRestaurantPayload[]> {
  const capped = Math.min(Math.max(1, Math.floor(limit)), PUBLIC_DISCOVERY_LIMIT)
  const indexed = adminDb.collection(COLLECTIONS.restaurantIndex)

  let snapshot: FirebaseFirestore.QuerySnapshot
  try {
    snapshot = await indexed
      .where('hasProfile', '==', true)
      .limit(capped)
      .get()
  } catch {
    snapshot = await indexed.limit(capped).get()
  }

  return snapshot.docs
    .map((docSnap) => mapRestaurantIndexDoc(docSnap.id, docSnap.data()))
    .filter((item): item is PublicDiscoveryRestaurantPayload => item !== null)
    .sort((left, right) => {
      if (left.discoveryFeatured !== right.discoveryFeatured) {
        return left.discoveryFeatured ? -1 : 1
      }
      return left.name.localeCompare(right.name, 'es')
    })
}

export function buildRestaurantIndexPayload(
  companyId: string,
  data: FirebaseFirestore.DocumentData,
): RestaurantIndexDoc {
  const name = asString(data.name)
  const location = asString(data.location)
  const municipality = asString(data.municipality)
  const country = asString(data.country)
  const postalCode = asString(data.postalCode)
  const description = asString(data.description)
  const photos = Array.isArray(data.photos) ? data.photos.filter((p): p is string => typeof p === 'string') : []
  const videos = Array.isArray(data.videos) ? data.videos.filter((p): p is string => typeof p === 'string') : []
  const characteristics = asStringArray(data.characteristics)
  const venueTypes = asStringArray(data.venueTypes)
  const amenities = asStringArray(data.amenities)
  const priceRange = asString(data.priceRange)
  const logoUrl = asString(data.logoUrl)
  const photoUrl = photos[0] ?? logoUrl

  return {
    companyId,
    name,
    slug: asString(data.slug),
    location,
    municipality,
    country,
    postalCode,
    latitude: asNumber(data.latitude),
    longitude: asNumber(data.longitude),
    photoUrl,
    logoUrl,
    characteristics,
    venueTypes,
    amenities,
    priceRange,
    searchText: [name, location, municipality, country, description, priceRange, ...characteristics, ...venueTypes, ...amenities]
      .join(' ')
      .toLowerCase(),
    reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 0,
    reviewRatingSum: typeof data.reviewRatingSum === 'number' ? data.reviewRatingSum : 0,
    reviewAdelinas: typeof data.reviewAdelinas === 'number' ? data.reviewAdelinas : 0,
    reservationMode: data.reservationMode === 'required' || data.reservationMode === 'none'
      ? data.reservationMode
      : 'optional',
    hasProfile: Boolean(
      description
      || municipality
      || postalCode
      || country
      || characteristics.length
      || venueTypes.length
      || amenities.length
      || photos.length
      || videos.length,
    ),
    ...(typeof data.discoveryFeatured === 'boolean'
      ? { discoveryFeatured: data.discoveryFeatured === true }
      : {}),
    updatedAt: FieldValue.serverTimestamp(),
  }
}

export async function syncRestaurantIndex(
  companyId: string,
  data?: FirebaseFirestore.DocumentData | null,
): Promise<void> {
  const indexRef = adminDb.collection(COLLECTIONS.restaurantIndex).doc(companyId)
  if (!data) {
    await indexRef.delete().catch(() => undefined)
    return
  }
  await indexRef.set(buildRestaurantIndexPayload(companyId, data), { merge: true })
}

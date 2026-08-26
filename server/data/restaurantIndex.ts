import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from './collections.ts'

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

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function buildRestaurantIndexPayload(
  companyId: string,
  data: FirebaseFirestore.DocumentData,
): RestaurantIndexDoc {
  const photos = Array.isArray(data.photos) ? data.photos.filter((item): item is string => typeof item === 'string') : []
  const characteristics = Array.isArray(data.characteristics)
    ? data.characteristics.filter((item): item is string => typeof item === 'string').slice(0, 10)
    : []
  const venueTypes = Array.isArray(data.venueTypes)
    ? data.venueTypes.filter((item): item is string => typeof item === 'string').slice(0, 3)
    : []
  const amenities = Array.isArray(data.amenities)
    ? data.amenities.filter((item): item is string => typeof item === 'string').slice(0, 40)
    : []
  const priceRange = typeof data.priceRange === 'string' ? data.priceRange : ''
  const logoUrl = asString(data.logoUrl)
  const photoUrl = photos[0] ?? logoUrl
  const name = asString(data.name)
  const location = asString(data.location)
  const municipality = asString(data.municipality)
  const country = asString(data.country)
  const description = asString(data.description)
  const postalCode = asString(data.postalCode)
  const videos = Array.isArray(data.videos) ? data.videos : []

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

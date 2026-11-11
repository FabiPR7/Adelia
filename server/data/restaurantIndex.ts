import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from './collections.ts'
import { parseCompanyReservationMode } from '../utils.ts'
import { cityKey, distanceKm, encodeGeohash, geohashPrefixesForRadius } from '../utils/geohash.ts'

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
  /** Para "cerca de ti": consultas por rango sin leer toda la colección. */
  geohash?: string
  /** Ciudad normalizada (sin tildes ni mayúsculas) para buscar por igualdad. */
  municipalityKey: string
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

/**
 * "Mayor visibilidad" va incluida en estos planes: se lee del plan actual para
 * que empiece y termine con la suscripción, sin tocar `discoveryFeatured`, que
 * es la marca manual del administrador. Se guarda 10 min en memoria: antes se
 * leían todas las empresas de pago en cada visita.
 */
const FEATURED_CACHE_MS = 10 * 60_000
let featuredCache: { ids: Set<string>; at: number } | null = null

async function loadCompanyIdsWithFeaturedPlan(): Promise<Set<string>> {
  if (featuredCache && Date.now() - featuredCache.at < FEATURED_CACHE_MS) {
    return featuredCache.ids
  }
  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.companies)
      .where('planId', 'in', ['premium', 'premium_plus'])
      .select()
      .limit(2000)
      .get()
    featuredCache = { ids: new Set(snapshot.docs.map((docSnap) => docSnap.id)), at: Date.now() }
    return featuredCache.ids
  } catch (error) {
    console.error('Discovery featured plans error:', error)
    return featuredCache?.ids ?? new Set()
  }
}

export interface DiscoveryQuery {
  /** Cerca de este punto (radio en km). */
  near?: { lat: number; lng: number; radiusKm: number }
  /** Solo esta ciudad. */
  city?: string
  /** Id del último restaurante de la página anterior (modo general). */
  cursor?: string
  limit?: number
}

export interface DiscoveryPage {
  restaurants: PublicDiscoveryRestaurantPayload[]
  nextCursor: string | null
}

function sortDiscovery(
  items: PublicDiscoveryRestaurantPayload[],
  near?: { lat: number; lng: number },
): PublicDiscoveryRestaurantPayload[] {
  return items.sort((left, right) => {
    if (left.discoveryFeatured !== right.discoveryFeatured) {
      return left.discoveryFeatured ? -1 : 1
    }
    if (near && left.latitude != null && left.longitude != null && right.latitude != null && right.longitude != null) {
      return distanceKm(near, { lat: left.latitude, lng: left.longitude })
        - distanceKm(near, { lat: right.latitude, lng: right.longitude })
    }
    return right.reviewCount - left.reviewCount || left.name.localeCompare(right.name, 'es')
  })
}

/**
 * Listado público, pensado para miles de restaurantes: nunca lee la colección
 * entera. Tres modos: cerca de un punto (celdas geohash), por ciudad, o los más
 * valorados de toda España por páginas.
 */
export async function listPublicDiscoveryRestaurants(query: DiscoveryQuery = {}): Promise<DiscoveryPage> {
  const capped = Math.min(Math.max(1, Math.floor(query.limit ?? PUBLIC_DISCOVERY_LIMIT)), PUBLIC_DISCOVERY_LIMIT)
  const indexed = adminDb.collection(COLLECTIONS.restaurantIndex)
  const featuredByPlan = await loadCompanyIdsWithFeaturedPlan()
  const toPayload = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => docs
    .map((docSnap) => mapRestaurantIndexDoc(docSnap.id, docSnap.data()))
    .filter((item): item is PublicDiscoveryRestaurantPayload => item !== null)
    .map((item) => (featuredByPlan.has(item.id) ? { ...item, discoveryFeatured: true } : item))

  if (query.near) {
    const { lat, lng, radiusKm } = query.near
    const prefixes = geohashPrefixesForRadius(lat, lng, radiusKm)
    const perCell = Math.max(10, Math.ceil(capped * 1.5 / prefixes.length))
    const snapshots = await Promise.all(prefixes.map((prefix) => indexed
      .orderBy('geohash')
      .startAt(prefix)
      .endAt(`${prefix}`)
      .limit(perCell)
      .get()))
    const unique = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
    for (const snap of snapshots) {
      for (const docSnap of snap.docs) unique.set(docSnap.id, docSnap)
    }
    const inRadius = toPayload([...unique.values()]).filter((item) => (
      item.latitude != null
      && item.longitude != null
      && distanceKm({ lat, lng }, { lat: item.latitude, lng: item.longitude }) <= radiusKm
    ))
    return { restaurants: sortDiscovery(inRadius, { lat, lng }).slice(0, capped), nextCursor: null }
  }

  if (query.city) {
    const snapshot = await indexed.where('municipalityKey', '==', cityKey(query.city)).limit(capped).get()
    return { restaurants: sortDiscovery(toPayload(snapshot.docs)), nextCursor: null }
  }

  // General: los más valorados, por páginas (índice simple de un campo, sin compuesto).
  let ranked = indexed.orderBy('reviewCount', 'desc').limit(capped)
  if (query.cursor && /^[A-Za-z0-9_-]{1,128}$/.test(query.cursor)) {
    const cursorSnap = await indexed.doc(query.cursor).get()
    if (cursorSnap.exists) {
      ranked = ranked.startAfter(cursorSnap)
    }
  }
  const snapshot = await ranked.get()
  const nextCursor = snapshot.size === capped ? snapshot.docs[snapshot.docs.length - 1].id : null
  return { restaurants: sortDiscovery(toPayload(snapshot.docs)), nextCursor }
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
  const latitude = asNumber(data.latitude)
  const longitude = asNumber(data.longitude)

  return {
    companyId,
    name,
    slug: asString(data.slug),
    location,
    municipality,
    country,
    postalCode,
    latitude,
    longitude,
    ...(latitude != null && longitude != null ? { geohash: encodeGeohash(latitude, longitude) } : {}),
    municipalityKey: cityKey(municipality),
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

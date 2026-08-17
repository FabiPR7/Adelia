import { doc, getDocs, collection, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'

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
  description?: string
  reviewCount?: number
  reviewRatingSum?: number
  reviewAdelinas?: number
}) {
  const photos = company.photos ?? []
  const characteristics = company.characteristics ?? []
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
    searchText: [
      company.name,
      company.location,
      company.municipality,
      company.country,
      description,
      ...characteristics,
    ]
      .join(' ')
      .toLowerCase(),
    reviewCount: company.reviewCount ?? 0,
    reviewRatingSum: company.reviewRatingSum ?? 0,
    reviewAdelinas: company.reviewAdelinas ?? 0,
    hasProfile: Boolean(
      description
      || company.municipality
      || company.postalCode
      || company.country
      || characteristics.length
      || photos.length
      || (company.videos?.length ?? 0),
    ),
    updatedAt: serverTimestamp(),
  }
}

export async function syncRestaurantIndexFromCompany(
  company: Parameters<typeof restaurantIndexPayload>[0],
): Promise<void> {
  await setDoc(doc(db, 'restaurantIndex', company.id), restaurantIndexPayload(company), { merge: true })
}

export async function fetchRestaurantIndex(): Promise<PublicDiscoveryRestaurant[]> {
  try {
    const snapshot = await getDocs(collection(db, 'restaurantIndex'))
    return snapshot.docs
      .map((item) => {
        const data = item.data()
        if (data.hasProfile === false) {
          return null
        }
        return {
          id: item.id,
          name: typeof data.name === 'string' ? data.name : '',
          slug: typeof data.slug === 'string' ? data.slug : '',
          location: typeof data.location === 'string' ? data.location : '',
          municipality: typeof data.municipality === 'string' ? data.municipality : '',
          country: typeof data.country === 'string' ? data.country : '',
          latitude: typeof data.latitude === 'number' ? data.latitude : null,
          longitude: typeof data.longitude === 'number' ? data.longitude : null,
          photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl.replace(/^http:\/\//, 'https://') : '',
          characteristics: Array.isArray(data.characteristics) ? data.characteristics as string[] : [],
          searchText: typeof data.searchText === 'string' ? data.searchText : '',
          reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 0,
          reviewRatingSum: typeof data.reviewRatingSum === 'number' ? data.reviewRatingSum : 0,
          reviewAdelinas: typeof data.reviewAdelinas === 'number' ? data.reviewAdelinas : 0,
        } satisfies PublicDiscoveryRestaurant
      })
      .filter((item): item is PublicDiscoveryRestaurant => item !== null && Boolean(item.name && item.slug))
  } catch {
    return []
  }
}

import type { Company } from '../types'
import type { PublicBookingCompany } from '../services/publicApi'
import { ADELINA_RATING_SLOTS, computeAverageReviewRating, getAdelinaSlotStates, type AdelinaSlotState } from '../types/review'
import { haversineDistanceKm } from './geo'
import { isValidMapCoordinates } from './mapCoordinates'
import { ensureHttpsUrl } from './cloudinaryUrl'
import {
  companyFacilitySearchTerms,
  venueTypesIncludeKind,
  type DiscoveryVenueKind,
} from '../data/companyProfileFacilities'
import { parseCompanyReservationMode } from '../data/companyReservationMode'

export interface PublicDiscoveryRestaurant {
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
  priceRange: import('../data/companyProfileFacilities').CompanyPriceRange
  searchText: string
  reviewCount: number
  reviewRatingSum: number
  reviewAdelinas: number
  discoveryFeatured: boolean
  reservationMode: import('../data/companyReservationMode').CompanyReservationMode
}

export function getDiscoveryAverageRating(
  restaurant: Pick<PublicDiscoveryRestaurant, 'reviewCount' | 'reviewRatingSum'>,
): number {
  return computeAverageReviewRating(restaurant.reviewRatingSum, restaurant.reviewCount)
}

export function getDiscoveryAdelinaSlotStates(
  restaurant: Pick<PublicDiscoveryRestaurant, 'reviewCount' | 'reviewRatingSum'>,
): AdelinaSlotState[] {
  if (restaurant.reviewCount <= 0) {
    return Array.from({ length: ADELINA_RATING_SLOTS }, () => 'empty')
  }

  return getAdelinaSlotStates(getDiscoveryAverageRating(restaurant), restaurant.reviewCount)
}

export function getDiscoveryReviewAdelinas(
  restaurant: Pick<PublicDiscoveryRestaurant, 'reviewAdelinas'>,
): number {
  return Math.max(0, restaurant.reviewAdelinas)
}

export function formatDiscoveryRatingBadge(
  restaurant: Pick<PublicDiscoveryRestaurant, 'reviewCount' | 'reviewRatingSum'>,
): string | null {
  if (restaurant.reviewCount <= 0) {
    return null
  }

  return getDiscoveryAverageRating(restaurant).toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

export function mapCompanyToPublicBooking(company: Company): PublicBookingCompany {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    phone: company.phone,
    contactEmail: company.contactEmail,
    location: company.location,
    municipality: company.municipality,
    country: company.country,
    postalCode: company.postalCode,
    description: company.description,
    logoUrl: company.logoUrl,
    photos: company.photos ?? [],
    mainPhotoIndex: company.mainPhotoIndex ?? 0,
    videos: company.videos ?? [],
    characteristics: company.characteristics ?? [],
    venueTypes: company.venueTypes ?? [],
    amenities: company.amenities ?? [],
    priceRange: company.priceRange ?? '',
    latitude: company.latitude,
    longitude: company.longitude,
    timeSlotMinutes: company.timeSlotMinutes,
    reservationMode: parseCompanyReservationMode(company.reservationMode),
    schedule: company.schedule,
    floorPlan: company.floorPlan,
    floorPlans: company.floorPlans?.length ? company.floorPlans : [company.floorPlan],
    reviewCount: company.reviewCount ?? 0,
    reviewRatingSum: company.reviewRatingSum ?? 0,
    reviewAdelinas: company.reviewAdelinas ?? 0,
    depositMinPax: company.depositMinPax ?? null,
    depositPerGuestCents: company.depositPerGuestCents ?? null,
    depositEnabled: company.depositEnabled ?? false,
    depositCancellationHours: company.depositCancellationHours ?? null,
    stripeAccountId: company.stripeAccountId ?? null,
    stripeChargesEnabled: company.stripeChargesEnabled ?? false,
    stripeDetailsSubmitted: company.stripeDetailsSubmitted ?? false,
  }
}

export function mapCompanyToDiscoveryRestaurant(company: Company): PublicDiscoveryRestaurant {
  const photoUrl = ensureHttpsUrl(company.photos?.[0] ?? company.logoUrl ?? '')
  const hasPin = isValidMapCoordinates(company.latitude, company.longitude)

  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    location: company.location,
    municipality: company.municipality,
    country: company.country,
    latitude: hasPin ? (company.latitude as number) : null,
    longitude: hasPin ? (company.longitude as number) : null,
    photoUrl,
    characteristics: company.characteristics ?? [],
    venueTypes: company.venueTypes ?? [],
    amenities: company.amenities ?? [],
    priceRange: company.priceRange ?? '',
    searchText: [
      company.name,
      company.location,
      company.municipality,
      company.country,
      company.description,
      ...(company.characteristics ?? []),
      ...companyFacilitySearchTerms(
        company.venueTypes ?? [],
        company.amenities ?? [],
        company.priceRange ?? '',
      ),
    ]
      .join(' ')
      .toLowerCase(),
    reviewCount: company.reviewCount ?? 0,
    reviewRatingSum: company.reviewRatingSum ?? 0,
    reviewAdelinas: company.reviewAdelinas ?? 0,
    discoveryFeatured: company.discoveryFeatured === true,
    reservationMode: parseCompanyReservationMode(company.reservationMode),
  }
}

export function restaurantHasMapPin(restaurant: Pick<PublicDiscoveryRestaurant, 'latitude' | 'longitude'>): boolean {
  return isValidMapCoordinates(restaurant.latitude, restaurant.longitude)
}

export function pickNearbyRestaurants(
  restaurants: PublicDiscoveryRestaurant[],
  origin: { lat: number; lng: number },
  maxKm: number,
  fallbackCount = 12,
): Array<PublicDiscoveryRestaurant & { distanceKm: number }> {
  const withDistance = restaurants
    .filter(restaurantHasMapPin)
    .map((restaurant) => ({
      ...restaurant,
      distanceKm: haversineDistanceKm(origin, {
        lat: restaurant.latitude as number,
        lng: restaurant.longitude as number,
      }),
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm)

  const within = withDistance.filter((restaurant) => restaurant.distanceKm <= maxKm)
  if (within.length > 0) {
    return within.slice(0, 40)
  }

  return withDistance.slice(0, fallbackCount)
}

function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function restaurantMatchesVenueKind(
  restaurant: Pick<PublicDiscoveryRestaurant, 'venueTypes'>,
  kind: DiscoveryVenueKind | '',
): boolean {
  if (!kind) {
    return true
  }

  const primaryType = restaurant.venueTypes[0]
  if (!primaryType) {
    return kind === 'restaurant'
  }

  return venueTypesIncludeKind([primaryType], kind)
}

export function filterDiscoveryRestaurants(
  restaurants: PublicDiscoveryRestaurant[],
  query: string,
  zone: string,
): PublicDiscoveryRestaurant[] {
  const normalizedQuery = normalizeSearch(query)
  const normalizedZone = normalizeSearch(zone)

  return restaurants.filter((restaurant) => {
    const matchesZone = !normalizedZone
      || normalizeSearch(restaurant.municipality) === normalizedZone
      || normalizeSearch(restaurant.location).includes(normalizedZone)
      || normalizeSearch(restaurant.municipality).includes(normalizedZone)

    if (!matchesZone) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    return restaurant.searchText.includes(normalizedQuery)
  })
}

export function restaurantsForDiscoveryMap(
  restaurants: PublicDiscoveryRestaurant[],
  origin: { lat: number; lng: number } | null,
  limit = 40,
): Array<PublicDiscoveryRestaurant & { distanceKm?: number }> {
  if (!origin) {
    return restaurants.filter(restaurantHasMapPin).slice(0, limit)
  }

  return pickNearbyRestaurants(restaurants, origin, Number.POSITIVE_INFINITY, limit)
}

export function splitRestaurantsForCarousels(restaurants: PublicDiscoveryRestaurant[]) {
  if (restaurants.length <= 1) {
    return {
      primary: restaurants,
      secondary: [],
    }
  }

  const midpoint = Math.ceil(restaurants.length / 2)

  return {
    primary: restaurants.slice(0, midpoint),
    secondary: [...restaurants.slice(midpoint)].reverse(),
  }
}

export function collectPopularCharacteristics(
  restaurants: PublicDiscoveryRestaurant[],
  limit = 10,
): string[] {
  const fallback = [
    'Tapas',
    'Terraza',
    'Italiana',
    'Mediterránea',
    'Brunch',
    'Mariscos',
    'Gastronómico',
    'Vegano',
    'Romántico',
    'Grupos',
    'Pizza',
    'Cocina de mercado',
  ]

  const counts = new Map<string, number>()

  for (const restaurant of restaurants) {
    for (const characteristic of restaurant.characteristics) {
      const trimmed = characteristic.trim()

      if (!trimmed) {
        continue
      }

      counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1)
    }
  }

  const ranked = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'es'))
    .map(([name]) => name)

  const merged = [...ranked]

  for (const option of fallback) {
    if (merged.length >= limit) {
      break
    }

    if (!merged.includes(option)) {
      merged.push(option)
    }
  }

  return merged.slice(0, limit)
}

export function buildRestaurantGeocodeQuery(restaurant: PublicDiscoveryRestaurant): string {
  const parts = [restaurant.location, restaurant.municipality, restaurant.country]
    .map((value) => value.trim())
    .filter(Boolean)

  return parts.join(', ') || restaurant.name
}

export function sortRestaurantsByDistance(
  restaurants: PublicDiscoveryRestaurant[],
  distancesKm: Record<string, number>,
): PublicDiscoveryRestaurant[] {
  return [...restaurants].sort((left, right) => {
    const leftDistance = distancesKm[left.slug] ?? Number.POSITIVE_INFINITY
    const rightDistance = distancesKm[right.slug] ?? Number.POSITIVE_INFINITY
    return leftDistance - rightDistance
  })
}

export function collectDiscoveryZones(restaurants: PublicDiscoveryRestaurant[]): string[] {
  const zones = new Set<string>()

  for (const restaurant of restaurants) {
    if (restaurant.municipality.trim()) {
      zones.add(restaurant.municipality.trim())
    } else if (restaurant.location.trim()) {
      zones.add(restaurant.location.trim())
    }
  }

  return [...zones].sort((left, right) => left.localeCompare(right, 'es'))
}

export function sortRestaurantsByReviewAdelinas(
  restaurants: PublicDiscoveryRestaurant[],
): PublicDiscoveryRestaurant[] {
  return [...restaurants].sort(
    (left, right) => getDiscoveryReviewAdelinas(right) - getDiscoveryReviewAdelinas(left)
      || getDiscoveryAverageRating(right) - getDiscoveryAverageRating(left),
  )
}

export function sortRestaurantsByReviewRating(
  restaurants: PublicDiscoveryRestaurant[],
): PublicDiscoveryRestaurant[] {
  return [...restaurants].sort(
    (left, right) => getDiscoveryAverageRating(right) - getDiscoveryAverageRating(left)
      || getDiscoveryReviewAdelinas(right) - getDiscoveryReviewAdelinas(left),
  )
}

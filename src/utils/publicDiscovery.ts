import type { Company } from '../types'
import type { PublicBookingCompany } from '../services/publicApi'
import { isValidMapCoordinates } from './mapCoordinates'

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
  searchText: string
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
    videos: company.videos ?? [],
    characteristics: company.characteristics ?? [],
    timeSlotMinutes: company.timeSlotMinutes,
    schedule: company.schedule,
    floorPlan: company.floorPlan,
  }
}

export function mapCompanyToDiscoveryRestaurant(company: Company): PublicDiscoveryRestaurant {
  const photoUrl = company.photos?.[0] ?? company.logoUrl ?? ''
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
    searchText: [
      company.name,
      company.location,
      company.municipality,
      company.country,
      company.description,
      ...(company.characteristics ?? []),
    ]
      .join(' ')
      .toLowerCase(),
  }
}

export function restaurantHasMapPin(restaurant: Pick<PublicDiscoveryRestaurant, 'latitude' | 'longitude'>): boolean {
  return isValidMapCoordinates(restaurant.latitude, restaurant.longitude)
}

function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

export function splitRestaurantsForCarousels(restaurants: PublicDiscoveryRestaurant[]) {
  if (restaurants.length <= 1) {
    return {
      primary: restaurants,
      secondary: restaurants,
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

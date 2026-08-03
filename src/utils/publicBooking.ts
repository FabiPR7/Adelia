import type { PublicBookingCompany } from '../services/publicApi'

export function hasRestaurantProfile(company: PublicBookingCompany): boolean {
  return Boolean(
    company.description
    || company.municipality
    || company.postalCode
    || company.country
    || company.characteristics.length > 0
    || company.photos.length > 0
    || company.videos.length > 0,
  )
}

export function formatRestaurantLocation(company: PublicBookingCompany): string {
  return [company.location, company.municipality, company.postalCode, company.country]
    .filter(Boolean)
    .join(' · ')
}

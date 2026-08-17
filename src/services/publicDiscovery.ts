import { getAllCompanies, getFirestoreErrorMessage } from './firestore'
import { fetchRestaurantIndex } from './restaurantIndex'
import { mapCompanyToDiscoveryRestaurant, mapCompanyToPublicBooking, type PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import { hasRestaurantProfile } from '../utils/publicBooking'

export async function fetchPublicDiscoveryRestaurants(): Promise<PublicDiscoveryRestaurant[]> {
  try {
    const indexed = await fetchRestaurantIndex()
    if (indexed.length > 0) {
      return indexed.sort((left, right) => left.name.localeCompare(right.name, 'es'))
    }

    const companies = await getAllCompanies()
    return companies
      .filter((company) => hasRestaurantProfile(mapCompanyToPublicBooking(company)))
      .map(mapCompanyToDiscoveryRestaurant)
  } catch (error) {
    throw new Error(getFirestoreErrorMessage(error))
  }
}

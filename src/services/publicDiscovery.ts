import { getAllCompanies, getFirestoreErrorMessage } from './firestore'
import {
  mapCompanyToDiscoveryRestaurant,
  mapCompanyToPublicBooking,
  type PublicDiscoveryRestaurant,
} from '../utils/publicDiscovery'
import { hasRestaurantProfile } from '../utils/publicBooking'

export async function fetchPublicDiscoveryRestaurants(): Promise<PublicDiscoveryRestaurant[]> {
  try {
    const companies = await getAllCompanies()

    return companies
      .filter((company) => hasRestaurantProfile(mapCompanyToPublicBooking(company)))
      .map(mapCompanyToDiscoveryRestaurant)
  } catch (error) {
    throw new Error(getFirestoreErrorMessage(error))
  }
}

import { getFirestoreErrorMessage } from './firestore'
import { fetchRestaurantIndex } from './restaurantIndex'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'

const DISCOVERY_CACHE_MS = 120_000

let cached: { at: number; items: PublicDiscoveryRestaurant[] } | null = null
let inflight: Promise<PublicDiscoveryRestaurant[]> | null = null

export async function fetchPublicDiscoveryRestaurants(): Promise<PublicDiscoveryRestaurant[]> {
  if (cached && Date.now() - cached.at < DISCOVERY_CACHE_MS) {
    return cached.items
  }
  if (inflight) {
    return inflight
  }

  inflight = (async () => {
    try {
      const items = await fetchRestaurantIndex()
      cached = { at: Date.now(), items }
      return items
    } catch (error) {
      throw new Error(getFirestoreErrorMessage(error))
    } finally {
      inflight = null
    }
  })()

  return inflight
}

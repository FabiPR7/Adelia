import { useSyncExternalStore } from 'react'
import { getIdToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

/** «Tu mapa gastronómico»: restaurantes visitados de tu ciudad y de tu país. */
export interface CollectionArea {
  name: string
  total: number
  visited: number
}

export interface CollectionBadge {
  id: string
  name: string
  description: string
  scope: 'city' | 'country'
  earnedAt: string
}

export interface CollectionTier {
  key: string
  scope: 'city' | 'country'
  badgeId: string
  badgeName: string
  badgeDescription: string
  percent: number
  target: number
  visited: number
  total: number
  reward: string
  earned: boolean
  available: boolean
}

export interface RestaurantCollection {
  city: (CollectionArea & { key: string }) | null
  country: CollectionArea
  /** slug → veces que has ido (reserva a la que fuiste o consumo validado). */
  visits: Record<string, number>
  badges: CollectionBadge[]
  newlyEarned: CollectionBadge[]
  tiers: CollectionTier[]
}

let current: RestaurantCollection | null = null
let currentCity = ''
let loadedAt = 0
let inFlight: Promise<RestaurantCollection | null> | null = null
const listeners = new Set<() => void>()
const FRESH_MS = 60_000

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function loadRestaurantCollection(city = '', force = false): Promise<RestaurantCollection | null> {
  const wanted = city.trim()
  if (!force && current && currentCity === wanted && Date.now() - loadedAt < FRESH_MS) return current
  if (inFlight && currentCity === wanted && !force) return inFlight

  currentCity = wanted
  inFlight = (async () => {
    try {
      const token = await getIdToken()
      if (!token) return null
      const query = wanted ? `?city=${encodeURIComponent(wanted)}` : ''
      const response = await fetch(`${API_BASE}/api/customer/collection${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) return current
      current = (await response.json()) as RestaurantCollection
      loadedAt = Date.now()
      emit()
      return current
    } catch {
      return current
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

/** Último mapa cargado (lo comparten Buscar, las tarjetas y la ficha). */
export function useRestaurantCollection(): RestaurantCollection | null {
  return useSyncExternalStore(subscribe, () => current, () => null)
}

export function visitsForSlug(collection: RestaurantCollection | null, slug: string): number {
  if (!collection || !slug) return 0
  return collection.visits[slug] ?? 0
}

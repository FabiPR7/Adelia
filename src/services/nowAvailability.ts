import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import { mapApiRestaurant } from './publicDiscovery'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

/** La mesa libre para «ahora» de un local (la calcula el servidor). */
export interface NowSlot {
  date: string
  time: string
  /** Minutos desde ya (negativo = empezó hace poco y aún llegas). */
  minutesFromNow: number
  freeTableCount: number
  freeTableIds: string[]
}

export interface NowRestaurant extends PublicDiscoveryRestaurant {
  now: NowSlot
}

export interface NowResult {
  pax: number
  graceMinutes: number
  windowMinutes: number
  radiusKm: number | null
  restaurants: NowRestaurant[]
}

/**
 * «Comer ahora»: locales cercanos con mesa libre para ya o en unos minutos.
 * Se guarda 30 s por zona y personas (el servidor ya guarda 60 s).
 */
const cache = new Map<string, { at: number; result: NowResult }>()

export async function fetchNowRestaurants(
  where: { near: { lat: number; lng: number } } | { city: string },
  pax: number,
): Promise<NowResult> {
  const params = new URLSearchParams({ pax: String(pax) })
  if ('near' in where) {
    params.set('lat', where.near.lat.toFixed(2))
    params.set('lng', where.near.lng.toFixed(2))
  } else {
    params.set('city', where.city.trim())
  }
  const key = params.toString()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < 30_000) return hit.result

  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/public/discovery/now?${key}`)
  } catch {
    throw new Error('Sin conexión. Revisa internet e inténtalo de nuevo.')
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'No se pudieron buscar mesas para ahora.')
  }
  const restaurants = (Array.isArray(data.restaurants) ? data.restaurants : []).flatMap((raw) => {
    const row = raw as Record<string, unknown>
    const base = mapApiRestaurant(row)
    const now = row.now as Record<string, unknown> | undefined
    if (!base || !now || typeof now.time !== 'string') return []
    return [{
      ...base,
      now: {
        date: String(now.date ?? ''),
        time: now.time,
        minutesFromNow: typeof now.minutesFromNow === 'number' ? now.minutesFromNow : 0,
        freeTableCount: typeof now.freeTableCount === 'number' ? now.freeTableCount : 1,
        freeTableIds: Array.isArray(now.freeTableIds) ? now.freeTableIds.filter((id): id is string => typeof id === 'string') : [],
      },
    }]
  })
  const result: NowResult = {
    pax: typeof data.pax === 'number' ? data.pax : pax,
    graceMinutes: typeof data.graceMinutes === 'number' ? data.graceMinutes : 5,
    windowMinutes: typeof data.windowMinutes === 'number' ? data.windowMinutes : 30,
    radiusKm: typeof data.radiusKm === 'number' ? data.radiusKm : null,
    restaurants,
  }
  cache.set(key, { at: Date.now(), result })
  return result
}

/** «Ya», «en 5 min» o «empezó hace 2 min»: cómo de pronto es la mesa. */
export function nowSlotLabel(slot: NowSlot): string {
  if (slot.minutesFromNow <= 0) {
    return slot.minutesFromNow < 0 ? `A las ${slot.time} · aún llegas` : `A las ${slot.time} · ya`
  }
  return `A las ${slot.time} · en ${slot.minutesFromNow} min`
}

/** Enlace a la reserva con hoy, la hora, las personas y las mesas libres ya puestos. */
export function nowBookingHref(restaurant: NowRestaurant, pax: number): string {
  const params = new URLSearchParams({
    reservar: '1',
    ahora: restaurant.now.time,
    pax: String(pax),
    mesas: restaurant.now.freeTableIds.join(','),
  })
  return `/reservar/${encodeURIComponent(restaurant.slug)}?${params.toString()}`
}

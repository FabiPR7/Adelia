import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import { mapApiRestaurant } from './publicDiscovery'

// «Comer ahora»: lo calcula el servidor; aquí solo se pide y se pinta. Igual en web y app.
const API_BASE = import.meta.env.VITE_API_URL ?? ''

/** La mesa libre para «ahora» de un local (la calcula el servidor). */
export interface NowSlot {
  time: string
  startsAt: string
  freeTableCount: number
  freeTableIds: string[]
  maxSeats: number
}

/** book: se puede reservar ya · missed: hora pasada sin reservar · ask: sin reserva ahora, hay que preguntar. */
export type NowState = 'book' | 'missed' | 'ask'

export interface NowRestaurant extends PublicDiscoveryRestaurant {
  state: NowState
  now: NowSlot | null
  missedTime: string
  phone: string
  closesAt: string
  /** false = el local no ha puesto su horario: no sabemos si está abierto. */
  hoursKnown: boolean
  /** El local tiene mesas para reservar en Adelia (aunque ahora no se pueda). */
  usesBooking: boolean
}

export interface NowPage {
  graceMinutes: number
  windowMinutes: number
  restaurants: NowRestaurant[]
  nextCursor: string | null
}

export type NowWhere = { near: { lat: number; lng: number } } | { city: string }

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function mapNowRestaurant(raw: unknown): NowRestaurant | null {
  const row = (raw ?? {}) as Record<string, unknown>
  const base = mapApiRestaurant(row)
  const slot = row.now as Record<string, unknown> | undefined
  const missed = row.missed as Record<string, unknown> | undefined
  const state = row.state
  if (!base || (state !== 'book' && state !== 'missed' && state !== 'ask')) return null
  const now = slot && text(slot.time)
    ? {
        time: text(slot.time),
        startsAt: text(slot.startsAt),
        freeTableCount: typeof slot.freeTableCount === 'number' ? slot.freeTableCount : 1,
        freeTableIds: Array.isArray(slot.freeTableIds) ? slot.freeTableIds.filter((id): id is string => typeof id === 'string') : [],
        maxSeats: typeof slot.maxSeats === 'number' ? slot.maxSeats : 0,
      }
    : null
  if (state === 'book' && !now) return null
  return { ...base, state, now, missedTime: text(missed?.time), phone: text(row.phone), closesAt: text(row.closesAt), hoursKnown: row.hoursKnown === true, usesBooking: row.usesBooking === true }
}

function nowQuery(where: NowWhere, pax: number | null, cursor: string | null): string {
  const params = new URLSearchParams()
  if ('near' in where) {
    params.set('lat', where.near.lat.toFixed(2))
    params.set('lng', where.near.lng.toFixed(2))
  } else {
    params.set('city', where.city.trim())
  }
  if (pax != null) params.set('pax', String(pax))
  if (cursor) params.set('cursor', cursor)
  return params.toString()
}

/** Una página de sitios abiertos ahora. `pax` null = da igual cuántos seáis. */
export async function fetchNowPage(where: NowWhere, pax: number | null, cursor: string | null): Promise<NowPage> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/public/discovery/now?${nowQuery(where, pax, cursor)}`)
  } catch {
    throw new Error('Sin conexión. Revisa internet e inténtalo de nuevo.')
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    throw new Error(text(data.error) || 'No se pudieron buscar mesas para ahora.')
  }
  return {
    graceMinutes: typeof data.graceMinutes === 'number' ? data.graceMinutes : 5,
    windowMinutes: typeof data.windowMinutes === 'number' ? data.windowMinutes : 30,
    restaurants: (Array.isArray(data.restaurants) ? data.restaurants : [])
      .map(mapNowRestaurant)
      .filter((item): item is NowRestaurant => item !== null),
    nextCursor: text(data.nextCursor) || null,
  }
}

/** Lo que se sabe de ese local ahora mismo: título y detalle. */
export function nowStatus(item: NowRestaurant): { title: string; detail: string } {
  if (item.state === 'book' && item.now) {
    const minutes = Math.round((new Date(item.now.startsAt).getTime() - Date.now()) / 60_000)
    const when = minutes > 0 ? `en ${minutes} min` : minutes < 0 ? 'aún llegas' : 'ya'
    const tables = item.now.freeTableCount === 1 ? '1 mesa libre' : `${item.now.freeTableCount} mesas libres`
    return { title: `A las ${item.now.time} · ${when}`, detail: `${tables} · la mayor, para ${item.now.maxSeats}` }
  }
  if (item.state === 'missed') {
    return {
      title: `A las ${item.missedTime} quedó mesa sin reservar`,
      detail: 'Puede que siga libre: llama o acércate.',
    }
  }
  return {
    title: item.hoursKnown && item.closesAt ? `Abierto hasta las ${item.closesAt}` : 'Horario sin confirmar',
    detail: item.usesBooking
      ? 'Ahora mismo no se puede reservar. Puede que esté lleno.'
      : item.hoursKnown
        ? 'Aquí no se reserva por Adelia. Puede que esté lleno.'
        : 'Aquí no se reserva por Adelia. Llama antes: puede estar cerrado o lleno.',
  }
}

/** Enlace a la reserva con hoy, la hora y las mesas libres ya puestas. */
export function nowBookingHref(item: NowRestaurant, pax: number | null): string {
  const params = new URLSearchParams({
    reservar: '1',
    ahora: item.now?.time ?? '',
    mesas: item.now?.freeTableIds.join(',') ?? '',
  })
  if (pax != null) params.set('pax', String(pax))
  return `/reservar/${encodeURIComponent(item.slug)}?${params.toString()}`
}

/** Con reserva (o con una hora recién libre) por un lado; sin reserva, por otro. */
export function splitNow(items: NowRestaurant[]): { booking: NowRestaurant[]; walkIn: NowRestaurant[] } {
  return {
    booking: items.filter((item) => item.state !== 'ask'),
    walkIn: items.filter((item) => item.state === 'ask'),
  }
}

export const NOW_SECTIONS = {
  booking: { title: 'Con reserva', hint: 'Reservas tu mesa ahora mismo.' },
  walkIn: { title: 'Sin reserva', hint: 'Puedes acercarte, pero hay riesgo de que esté lleno o cerrado.' },
}

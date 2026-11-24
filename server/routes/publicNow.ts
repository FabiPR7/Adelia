import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { listPublicDiscoveryRestaurants, type PublicDiscoveryRestaurantPayload } from '../data/restaurantIndex.ts'
import { readCompanyOps } from '../data/companyOps.ts'
import { allowPublicCache } from '../security/httpCache.ts'
import { ensureBusinessRules, getBusinessRules } from '../config/businessRules.ts'
import { companyAcceptsReservations, defaultSchedule } from '../utils.ts'
import { distanceKm } from '../utils/geohash.ts'
import { madridDayRange, madridHour, madridYmd } from '../utils/madridDateTime.ts'
import { parseBookingDate } from '../reservationSlots.ts'
import { closesAtIfOpen, findMissedSlot, findNowSlot, hasOwnSchedule, hasTableFreeNow, type NowReservation, type NowTable } from '../reservations/nowAvailability.ts'
import { loadBookableTables } from './public.ts'

/**
 * «Comer ahora»: GET /api/public/discovery/now?lat=&lng=  (o ?city=) [&pax=] [&cursor=]
 * Todos los locales abiertos cerca, por páginas. De cada uno se dice lo que se sabe:
 *  - book:   mesa libre que se puede reservar ya (campo `now`).
 *  - missed: una hora que acaba de pasar y nadie reservó; puede que haya sitio.
 *  - ask:    sin reserva ahora; se puede llamar o acercarse, con riesgo de que esté lleno.
 * `hoursKnown` false = el local no ha puesto su horario (tiene el automático): no se
 * dice que está abierto. `usesBooking` = el local tiene mesas para reservar en Adelia.
 * Los cerrados y los que tienen todas las mesas cogidas no salen.
 * `pax` es opcional: sin él valen todas las mesas.
 *
 * Lecturas: cada página mira solo los locales que hace falta (tope 3 tandas); lo leído de
 * cada local se guarda 45 s y sirve para cualquier número de personas.
 */
const router = Router()

const LIST_CACHE_MS = 60_000
const VENUE_CACHE_MS = 45_000
const MAX_ROUNDS = 3
const listCache = new Map<string, { at: number; items: PublicDiscoveryRestaurantPayload[] }>()
const venueCache = new Map<string, { at: number; value: Promise<Venue | null> }>()

interface Venue {
  schedule: ReturnType<typeof defaultSchedule>
  duration: number
  hoursKnown: boolean
  phone: string
  accepts: boolean
  tables: NowTable[]
  reservations: NowReservation[]
}

function finite(value: unknown): number | null {
  const parsed = typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

function trim(map: Map<string, unknown>, max: number): void {
  while (map.size > max) map.delete(map.keys().next().value as string)
}

async function readVenue(item: PublicDiscoveryRestaurantPayload, windowMinutes: number): Promise<Venue | null> {
  const data = await readCompanyOps(item.id)
  if (!data || data.deactivated === true) return null
  const schedule = (data.schedule ?? defaultSchedule()) as Venue['schedule']
  const venue: Venue = {
    schedule,
    duration: typeof data.timeSlotMinutes === 'number' ? data.timeSlotMinutes : 120,
    hoursKnown: hasOwnSchedule(data.schedule as Venue['schedule'] | undefined, defaultSchedule()),
    phone: typeof data.phone === 'string' ? data.phone.trim() : '',
    accepts: companyAcceptsReservations(data.reservationMode) && item.canReserve !== false,
    tables: [],
    reservations: [],
  }
  if (!venue.accepts) return venue
  // Ni abierto ni a punto de abrir: no hace falta leer sus mesas ni sus reservas.
  const now = Date.now()
  if (!closesAtIfOpen(schedule, now) && !closesAtIfOpen(schedule, now + (windowMinutes + 1) * 60_000)) return venue
  const { start, end } = madridDayRange(new Date(now))
  const [tables, snap] = await Promise.all([
    loadBookableTables(item.id, data.planId),
    adminDb.collection('reservations')
      .where('companyId', '==', item.id)
      .where('startTime', '>=', Timestamp.fromDate(start))
      .where('startTime', '<', Timestamp.fromDate(end))
      .limit(600)
      .get(),
  ])
  venue.tables = tables.map((table) => ({ id: table.id, capacity: table.capacity }))
  venue.reservations = snap.docs.flatMap((docSnap) => {
    const row = docSnap.data()
    const startTime = row.startTime?.toDate?.() as Date | undefined
    const endTime = row.endTime?.toDate?.() as Date | undefined
    if (!startTime || !endTime || row.status === 'cancelled') return []
    return [{ id: docSnap.id, tableId: String(row.tableId ?? ''), startTime, endTime, status: String(row.status ?? '') }]
  })
  return venue
}

function cachedVenue(item: PublicDiscoveryRestaurantPayload, windowMinutes: number): Promise<Venue | null> {
  const hit = venueCache.get(item.id)
  if (hit && Date.now() - hit.at < VENUE_CACHE_MS) return hit.value
  const value = readVenue(item, windowMinutes)
  venueCache.delete(item.id)
  venueCache.set(item.id, { at: Date.now(), value })
  trim(venueCache, 500)
  value.catch(() => venueCache.delete(item.id))
  return value
}

async function candidates(
  near: { lat: number; lng: number } | null,
  city: string,
  radiusKm: number,
  max: number,
): Promise<PublicDiscoveryRestaurantPayload[]> {
  const key = near ? `${near.lat},${near.lng}` : `c:${city.toLowerCase()}`
  const hit = listCache.get(key)
  if (hit && Date.now() - hit.at < LIST_CACHE_MS) return hit.items
  const page = await listPublicDiscoveryRestaurants(near ? { near: { ...near, radiusKm }, limit: max } : { city, limit: max })
  const far = (item: PublicDiscoveryRestaurantPayload) => (
    near && item.latitude != null && item.longitude != null
      ? distanceKm(near, { lat: item.latitude, lng: item.longitude })
      : 0
  )
  // Primero los que se pueden reservar; en cada grupo, del más cercano al más lejano.
  const items = [...page.restaurants].sort((left, right) => (
    Number(right.canReserve !== false) - Number(left.canReserve !== false) || far(left) - far(right)
  ))
  listCache.set(key, { at: Date.now(), items })
  trim(listCache, 300)
  return items
}

router.get('/now', async (req: Request, res: Response) => {
  try {
    await ensureBusinessRules()
    const rules = getBusinessRules()
    const rawPax = finite(req.query.pax)
    const pax = rawPax == null ? null : Math.min(20, Math.max(1, Math.trunc(rawPax)))
    const lat = finite(req.query.lat)
    const lng = finite(req.query.lng)
    const near = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 }
      : null
    const city = !near && typeof req.query.city === 'string' ? req.query.city.trim().slice(0, 80) : ''
    if (!near && !city) {
      res.status(400).json({ error: 'Activa tu ubicación o elige una ciudad.' })
      return
    }

    const list = await candidates(near, city, rules.nowRadiusKm, rules.nowMaxRestaurants)
    let offset = Math.max(0, Math.trunc(finite(req.query.cursor) ?? 0))
    const now = Date.now()
    const todayYmd = madridYmd(new Date(now))
    const today = parseBookingDate(todayYmd)
    const window = { graceMinutes: rules.nowGraceMinutes, windowMinutes: rules.nowWindowMinutes }
    const hour = madridHour(new Date(now))
    const plausibleHour = hour >= rules.nowUnknownFromHour && hour < rules.nowUnknownToHour
    const found: Array<Record<string, unknown> & { rank: number }> = []

    for (let round = 0; round < MAX_ROUNDS && offset < list.length && found.length < rules.nowPageSize; round += 1) {
      const batch = list.slice(offset, offset + rules.nowPageSize - found.length)
      offset += batch.length
      const results = await Promise.all(batch.map(async (item) => {
        try {
          const venue = await cachedVenue(item, rules.nowWindowMinutes)
          if (!venue) return null
          const open = closesAtIfOpen(venue.schedule, now)
          const usesBooking = venue.accepts && venue.tables.length > 0
          const base = {
            ...item,
            phone: venue.phone,
            hoursKnown: venue.hoursKnown,
            usesBooking,
            closesAt: venue.hoursKnown ? open?.time ?? null : null,
          }
          if (usesBooking) {
            const input = {
              date: today,
              schedule: venue.schedule,
              durationMinutes: venue.duration,
              tables: venue.tables,
              pax,
              reservations: venue.reservations,
              now,
            }
            const slot = findNowSlot({ ...input, window })
            if (slot) return { ...base, rank: 0, state: 'book', now: { ...slot, date: todayYmd } }
            if (!open) return null
            const missed = findMissedSlot({ ...input, missedMinutes: rules.nowMissedMinutes })
            if (missed) return { ...base, rank: 1, state: 'missed', missed }
            // Con mesas en Adelia y todas cogidas (o ninguna de ese tamaño): no se ofrece.
            if (!hasTableFreeNow(venue.tables, venue.reservations, pax, now)) return null
          }
          // Sin horario propio no sabemos si abre: se enseña avisando, a horas razonables.
          const show = venue.hoursKnown ? Boolean(open) : usesBooking ? Boolean(open) : plausibleHour
          return show ? { ...base, rank: 2, state: 'ask' } : null
        } catch (error) {
          console.warn('now: local saltado', item.id, error instanceof Error ? error.message : error)
          return null
        }
      }))
      for (const item of results) if (item) found.push(item)
    }

    // Dentro de la página: primero lo que se puede reservar; a igualdad, lo más cercano.
    found.sort((left, right) => left.rank - right.rank)
    allowPublicCache(res, 20)
    res.json({
      pax,
      graceMinutes: window.graceMinutes,
      windowMinutes: window.windowMinutes,
      restaurants: found.map(({ rank: _rank, ...item }) => item),
      nextCursor: offset < list.length ? String(offset) : null,
    })
  } catch (error) {
    console.error('discovery now error:', error)
    res.status(500).json({ error: 'No se pudieron buscar mesas para ahora.' })
  }
})

export default router

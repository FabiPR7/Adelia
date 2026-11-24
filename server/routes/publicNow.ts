import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { listPublicDiscoveryRestaurants } from '../data/restaurantIndex.ts'
import { readCompanyOps } from '../data/companyOps.ts'
import { allowPublicCache } from '../security/httpCache.ts'
import { ensureBusinessRules, getBusinessRules } from '../config/businessRules.ts'
import { companyAcceptsReservations, defaultSchedule } from '../utils.ts'
import { madridDayRange, madridYmd } from '../utils/madridDateTime.ts'
import { nowCandidateTimes, parseBookingDate } from '../reservationSlots.ts'
import { findNowSlot, type NowReservation } from '../reservations/nowAvailability.ts'
import { loadBookableTables } from './public.ts'

/**
 * «Comer ahora»: GET /api/public/discovery/now?lat=&lng=&pax=  (o ?city=)
 * Los locales cercanos con mesa libre para ya mismo o en los próximos minutos.
 * Las reglas (margen para llegar tarde, ventana, radio) salen de appConfig/businessRules.
 *
 * Lecturas: se miran como mucho `nowMaxRestaurants` locales; a los que están
 * cerrados no se les leen ni mesas ni reservas, y la respuesta se guarda 60 s por
 * zona (~1 km) y número de personas.
 */
const router = Router()

const CACHE_MS = 60_000
const CACHE_MAX = 300
const cache = new Map<string, { at: number; body: unknown }>()

function finite(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

router.get('/now', async (req: Request, res: Response) => {
  try {
    await ensureBusinessRules()
    const rules = getBusinessRules()
    const pax = Math.min(20, Math.max(1, Math.trunc(finite(req.query.pax) ?? 2)))
    const lat = finite(req.query.lat)
    const lng = finite(req.query.lng)
    const near = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100, radiusKm: rules.nowRadiusKm }
      : null
    const city = !near && typeof req.query.city === 'string' ? req.query.city.trim().slice(0, 80) : ''
    if (!near && !city) {
      res.status(400).json({ error: 'Activa tu ubicación o elige una ciudad.' })
      return
    }

    const key = `${near ? `${near.lat},${near.lng}` : `c:${city.toLowerCase()}`}|${pax}`
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < CACHE_MS) {
      allowPublicCache(res, 30)
      res.json(hit.body)
      return
    }

    const window = { graceMinutes: rules.nowGraceMinutes, windowMinutes: rules.nowWindowMinutes }
    const page = await listPublicDiscoveryRestaurants(
      near ? { near, limit: rules.nowMaxRestaurants } : { city, limit: rules.nowMaxRestaurants },
    )
    const candidates = page.restaurants.filter((item) => item.canReserve !== false).slice(0, rules.nowMaxRestaurants)

    const now = Date.now()
    const today = parseBookingDate(madridYmd(new Date(now)))
    const { start: dayStart, end: dayEnd } = madridDayRange(new Date(now))

    const found = await Promise.all(candidates.map(async (restaurant) => {
      try {
        const data = await readCompanyOps(restaurant.id)
        if (!data || data.deactivated === true || !companyAcceptsReservations(data.reservationMode)) return null
        const schedule = data.schedule ?? defaultSchedule()
        const duration = typeof data.timeSlotMinutes === 'number' ? data.timeSlotMinutes : 120
        // Cerrado ahora (ninguna hora posible): no se gastan más lecturas en este local.
        if (nowCandidateTimes(today, schedule, duration, window, now).length === 0) return null

        const [tables, reservationsSnap] = await Promise.all([
          loadBookableTables(restaurant.id, data.planId),
          adminDb.collection('reservations')
            .where('companyId', '==', restaurant.id)
            .where('startTime', '>=', Timestamp.fromDate(dayStart))
            .where('startTime', '<', Timestamp.fromDate(dayEnd))
            .limit(600)
            .get(),
        ])
        const reservations: NowReservation[] = reservationsSnap.docs.flatMap((docSnap) => {
          const row = docSnap.data()
          const startTime = row.startTime?.toDate?.() as Date | undefined
          const endTime = row.endTime?.toDate?.() as Date | undefined
          if (!startTime || !endTime || row.status === 'cancelled') return []
          return [{ id: docSnap.id, tableId: String(row.tableId ?? ''), startTime, endTime, status: String(row.status ?? '') }]
        })
        const slot = findNowSlot({
          date: today,
          schedule,
          durationMinutes: duration,
          tables: tables.map((table) => ({ id: table.id, capacity: table.capacity })),
          pax,
          reservations,
          window,
          now,
        })
        return slot ? { ...restaurant, now: { ...slot, date: madridYmd(new Date(now)) } } : null
      } catch (error) {
        console.warn('now: local saltado', restaurant.id, error instanceof Error ? error.message : error)
        return null
      }
    }))

    const restaurants = found
      .filter((item): item is NonNullable<typeof item> => item !== null)
      // Primero los que tienen mesa antes; a igual hora, el orden de cercanía de antes.
      .sort((left, right) => Math.max(0, left.now.minutesFromNow) - Math.max(0, right.now.minutesFromNow))

    const body = {
      pax,
      graceMinutes: window.graceMinutes,
      windowMinutes: window.windowMinutes,
      radiusKm: near ? rules.nowRadiusKm : null,
      restaurants,
    }
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
    cache.set(key, { at: Date.now(), body })
    allowPublicCache(res, 30)
    res.json(body)
  } catch (error) {
    console.error('discovery now error:', error)
    res.status(500).json({ error: 'No se pudieron buscar mesas para ahora.' })
  }
})

export default router

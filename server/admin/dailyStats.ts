import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { madridDayRange, madridHour, madridWeekday, madridYmd, utcNoonFromYmd } from '../utils/madridDateTime.ts'

/**
 * Resumen de cada día (hora de Madrid) para el panel de administración:
 * `adminStats/{yyyy-mm-dd}`. Se calcula una vez por día leyendo solo las altas
 * de ese día, así el panel no tiene que leer todas las reservas cada vez que se
 * abre, aunque haya millones.
 */
export const ADMIN_STATS_COLLECTION = 'adminStats'
const TOP_COMPANIES = 15
const MAX_DOCS_PER_DAY = 20_000

export interface AdminDayStats {
  day: string
  reservations: number
  pax: number
  confirmed: number
  completed: number
  cancelled: number
  fromCustomers: number
  withPromotion: number
  newCustomers: number
  newCompanies: number
  byHour: number[]
  weekday: number
  topCompanies: Record<string, number>
  computedAt?: string
}

export function addDaysYmd(ymd: string, delta: number): string {
  const base = utcNoonFromYmd(ymd)
  base.setUTCDate(base.getUTCDate() + delta)
  return base.toISOString().slice(0, 10)
}

export function emptyDayStats(day: string): AdminDayStats {
  return {
    day,
    reservations: 0,
    pax: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    fromCustomers: 0,
    withPromotion: 0,
    newCustomers: 0,
    newCompanies: 0,
    byHour: Array.from({ length: 24 }, () => 0),
    weekday: madridWeekday(utcNoonFromYmd(day)),
    topCompanies: {},
  }
}

/** Suma las reservas de un día. Exportado para probarlo sin base de datos. */
export function summarizeReservations(
  day: string,
  reservations: Array<Record<string, unknown>>,
): AdminDayStats {
  const stats = emptyDayStats(day)
  const perCompany = new Map<string, number>()
  for (const data of reservations) {
    stats.reservations += 1
    const pax = typeof data.pax === 'number' && Number.isFinite(data.pax) ? data.pax : 0
    stats.pax += Math.max(0, Math.min(pax, 500))
    if (data.status === 'confirmed') stats.confirmed += 1
    else if (data.status === 'completed') stats.completed += 1
    else if (data.status === 'cancelled') stats.cancelled += 1
    if (typeof data.customerUid === 'string' && data.customerUid) stats.fromCustomers += 1
    if (typeof data.promotionId === 'string' && data.promotionId) stats.withPromotion += 1
    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null
    if (createdAt) stats.byHour[madridHour(createdAt)] += 1
    if (typeof data.companyId === 'string' && data.companyId) {
      perCompany.set(data.companyId, (perCompany.get(data.companyId) ?? 0) + 1)
    }
  }
  stats.topCompanies = Object.fromEntries(
    [...perCompany.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_COMPANIES),
  )
  return stats
}

async function countRange(collection: string, start: Date, end: Date, role?: string): Promise<number> {
  let query = adminDb
    .collection(collection)
    .where('createdAt', '>=', Timestamp.fromDate(start))
    .where('createdAt', '<', Timestamp.fromDate(end))
  if (role) {
    query = query.where('role', '==', role)
  }
  try {
    const snap = await query.count().get()
    return snap.data().count
  } catch {
    // Sin índice para role + createdAt: se cuentan a mano (pocas altas por día).
    const snap = await adminDb
      .collection(collection)
      .where('createdAt', '>=', Timestamp.fromDate(start))
      .where('createdAt', '<', Timestamp.fromDate(end))
      .select('role')
      .limit(MAX_DOCS_PER_DAY)
      .get()
    return role ? snap.docs.filter((doc) => doc.get('role') === role).length : snap.size
  }
}

export async function computeDayStats(day: string): Promise<AdminDayStats> {
  const { start, end } = madridDayRange(utcNoonFromYmd(day))
  const [reservationsSnap, newCustomers, newCompanies] = await Promise.all([
    adminDb
      .collection('reservations')
      .where('createdAt', '>=', Timestamp.fromDate(start))
      .where('createdAt', '<', Timestamp.fromDate(end))
      .select('pax', 'status', 'customerUid', 'promotionId', 'createdAt', 'companyId')
      .limit(MAX_DOCS_PER_DAY)
      .get(),
    countRange('users', start, end, 'customer'),
    countRange('companies', start, end),
  ])
  const stats = summarizeReservations(day, reservationsSnap.docs.map((doc) => doc.data()))
  stats.newCustomers = newCustomers
  stats.newCompanies = newCompanies
  return stats
}

export async function saveDayStats(stats: AdminDayStats): Promise<void> {
  await adminDb.collection(ADMIN_STATS_COLLECTION).doc(stats.day).set({
    ...stats,
    computedAt: new Date().toISOString(),
  })
}

function parseDayStats(day: string, data: FirebaseFirestore.DocumentData | undefined): AdminDayStats | null {
  if (!data || typeof data.reservations !== 'number') {
    return null
  }
  const base = emptyDayStats(day)
  return {
    ...base,
    ...data,
    day,
    byHour: Array.isArray(data.byHour) && data.byHour.length === 24 ? data.byHour : base.byHour,
    topCompanies: data.topCompanies && typeof data.topCompanies === 'object' ? data.topCompanies : {},
  } as AdminDayStats
}

/**
 * Devuelve los últimos `days` días (el último es hoy). Hoy se calcula en vivo;
 * los días pasados se leen ya hechos y, si falta alguno, se calcula y se guarda
 * (como mucho `maxBuild` por llamada para no alargar la respuesta).
 */
export async function loadDailyStats(days: number, maxBuild = 31): Promise<AdminDayStats[]> {
  const today = madridYmd(new Date())
  const keys = Array.from({ length: days }, (_, index) => addDaysYmd(today, index - days + 1))
  const pastKeys = keys.slice(0, -1)
  const refs = pastKeys.map((key) => adminDb.collection(ADMIN_STATS_COLLECTION).doc(key))
  const snaps = refs.length > 0 ? await adminDb.getAll(...refs) : []

  const result: AdminDayStats[] = []
  let built = 0
  for (let index = 0; index < pastKeys.length; index += 1) {
    const key = pastKeys[index]
    const parsed = parseDayStats(key, snaps[index]?.data())
    if (parsed) {
      result.push(parsed)
    } else if (built < maxBuild) {
      built += 1
      const stats = await computeDayStats(key)
      await saveDayStats(stats).catch(() => undefined)
      result.push(stats)
    } else {
      result.push(emptyDayStats(key))
    }
  }
  result.push(await computeDayStats(today))
  return result
}

/**
 * Tarea nocturna: rehace los últimos días (las reservas cambian de estado después
 * de crearse) y rellena huecos de hasta 90 días.
 */
export async function refreshRecentDailyStats(recentDays = 3, backfillDays = 90): Promise<number> {
  const today = madridYmd(new Date())
  let written = 0
  for (let offset = 1; offset <= recentDays; offset += 1) {
    await saveDayStats(await computeDayStats(addDaysYmd(today, -offset)))
    written += 1
  }
  const keys = Array.from({ length: backfillDays - recentDays }, (_, index) => addDaysYmd(today, -(recentDays + 1 + index)))
  if (keys.length > 0) {
    const snaps = await adminDb.getAll(...keys.map((key) => adminDb.collection(ADMIN_STATS_COLLECTION).doc(key)))
    for (let index = 0; index < keys.length; index += 1) {
      if (!snaps[index]?.exists) {
        await saveDayStats(await computeDayStats(keys[index]))
        written += 1
      }
    }
  }
  return written
}

/**
 * Liga Adelia: cada mes los restaurantes compiten en cuatro clasificaciones
 * (por ciudad y en toda España). Se calcula a partir de los datos reales del
 * mes y se guarda un rato en memoria; los meses cerrados se guardan en
 * `leagueResults/{AAAA-MM}` para los trofeos.
 */
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { getCompanyLevelForXp } from '../gamification/companyCatalog.ts'

export type LeagueId = 'reservations' | 'promotions' | 'rating' | 'rising'

export const LEAGUES: Array<{ id: LeagueId; name: string; rule: string; unit: string }> = [
  { id: 'reservations', name: 'Más reservas', rule: 'Reservas marcadas como «asistió» este mes', unit: 'asistencias' },
  { id: 'promotions', name: 'Más promos', rule: 'Premios canjeados con PIN este mes', unit: 'premios' },
  { id: 'rating', name: 'Mejor valorado', rule: 'Media de las reseñas del mes por cuántas hay (mínimo 5)', unit: 'puntos' },
  { id: 'rising', name: 'Revelación', rule: 'Lo que más crece frente al mes anterior, o el mejor local nuevo', unit: 'asistencias' },
]

/** Para que nadie infle la liga con reservas de una misma cuenta. */
const MAX_VISITS_PER_CUSTOMER = 4
const MIN_REVIEWS_FOR_RATING = 5
const MIN_VISITS_FOR_RISING = 5
const CACHE_MS = 10 * 60 * 1000
const TIME_ZONE = 'Europe/Madrid'

export interface LeagueRestaurant {
  companyId: string
  name: string
  slug: string
  municipality: string
  municipalityKey: string
  photoUrl: string
  level: number
  levelTitle: string
  isNew: boolean
}

export interface LeagueEntry extends LeagueRestaurant {
  rank: number
  score: number
  /** Texto corto del valor: «94», «4,6 ★ · 12». */
  display: string
  /** Desempate: menos faltas mejor. */
  noShows: number
}

export interface LeagueBoard {
  id: LeagueId
  name: string
  rule: string
  unit: string
  entries: LeagueEntry[]
}

interface MonthData {
  month: string
  restaurants: Map<string, LeagueRestaurant>
  visits: Map<string, number>
  previousVisits: Map<string, number>
  noShows: Map<string, number>
  promotions: Map<string, number>
  ratings: Map<string, { sum: number; count: number }>
}

export function currentMonthKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit' }).formatToParts(now)
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  return `${year}-${month}`
}

export function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, mon - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Inicio del mes en Madrid (aprox. con el desfase del día 1, suficiente para agrupar). */
function monthStart(month: string): Date {
  const [year, mon] = month.split('-').map(Number)
  const utc = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0))
  const offsetPart = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, timeZoneName: 'shortOffset' })
    .formatToParts(utc).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+1'
  const hours = Number(offsetPart.replace('GMT', '') || 0)
  return new Date(utc.getTime() - hours * 60 * 60 * 1000)
}

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis()
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string' || typeof value === 'number') {
    const ms = new Date(value).getTime()
    return Number.isNaN(ms) ? 0 : ms
  }
  return 0
}

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by)
}

/** Asistencias por local, con tope por cliente, y faltas. */
async function countVisits(from: Date, to: Date) {
  const snap = await adminDb.collection('reservations')
    .where('startTime', '>=', Timestamp.fromDate(from))
    .where('startTime', '<', Timestamp.fromDate(to))
    .limit(20000)
    .get()
  const perCustomer = new Map<string, number>()
  const visits = new Map<string, number>()
  const noShows = new Map<string, number>()
  for (const doc of snap.docs) {
    const data = doc.data()
    const companyId = typeof data.companyId === 'string' ? data.companyId : ''
    if (!companyId) continue
    if (data.noShow === true) {
      bump(noShows, companyId)
      continue
    }
    if (data.status !== 'confirmed') continue
    const who = String(data.customerUid || data.clientEmail || doc.id).toLowerCase()
    const key = `${companyId}|${who}`
    const used = perCustomer.get(key) ?? 0
    if (used >= MAX_VISITS_PER_CUSTOMER) continue
    perCustomer.set(key, used + 1)
    bump(visits, companyId)
  }
  return { visits, noShows }
}

async function loadMonthData(month: string): Promise<MonthData> {
  const from = monthStart(month)
  const to = monthStart(shiftMonth(month, 1))
  const previousFrom = monthStart(shiftMonth(month, -1))

  const [indexSnap, gamificationSnap, companiesSnap, current, previous, claimsSnap, reviewsSnap] = await Promise.all([
    adminDb.collection('restaurantIndex').limit(5000).get(),
    adminDb.collection('companyGamification').limit(5000).get(),
    adminDb.collection('companies').select('createdAt', 'deactivated').limit(5000).get(),
    countVisits(from, to),
    countVisits(previousFrom, from),
    // claimedAt se guarda como texto ISO: el rango se compara como texto.
    adminDb.collection('promotionClaims')
      .where('claimedAt', '>=', from.toISOString())
      .where('claimedAt', '<', to.toISOString())
      .limit(20000)
      .get(),
    adminDb.collection('reviewIndex')
      .where('createdAt', '>=', Timestamp.fromDate(from))
      .where('createdAt', '<', Timestamp.fromDate(to))
      .limit(20000)
      .get(),
  ])

  const xpByCompany = new Map<string, number>()
  for (const doc of gamificationSnap.docs) {
    const xp = Number(doc.data().xp)
    xpByCompany.set(doc.id, Number.isFinite(xp) ? xp : 0)
  }
  const companyMeta = new Map(companiesSnap.docs.map((doc) => [doc.id, doc.data()]))
  const newSince = to.getTime() - 75 * 24 * 60 * 60 * 1000

  const restaurants = new Map<string, LeagueRestaurant>()
  for (const doc of indexSnap.docs) {
    const data = doc.data()
    const companyId = String(data.companyId || doc.id)
    const meta = companyMeta.get(companyId)
    if (data.deactivated === true || meta?.deactivated === true || !data.name) continue
    const level = getCompanyLevelForXp(xpByCompany.get(companyId) ?? 0)
    restaurants.set(companyId, {
      companyId,
      name: String(data.name),
      slug: String(data.slug ?? ''),
      municipality: String(data.municipality ?? ''),
      municipalityKey: String(data.municipalityKey ?? data.municipality ?? '').toLowerCase(),
      photoUrl: String(data.photoUrl ?? data.logoUrl ?? ''),
      level: level.level,
      levelTitle: level.title,
      isNew: toMillis(meta?.createdAt) >= newSince,
    })
  }

  const promotions = new Map<string, number>()
  for (const doc of claimsSnap.docs) {
    const companyId = String(doc.data().companyId ?? '')
    if (companyId) bump(promotions, companyId)
  }

  const ratings = new Map<string, { sum: number; count: number }>()
  for (const doc of reviewsSnap.docs) {
    const data = doc.data()
    const companyId = String(data.companyId ?? '')
    const rating = Number(data.rating)
    if (!companyId || !Number.isFinite(rating)) continue
    const current = ratings.get(companyId) ?? { sum: 0, count: 0 }
    current.sum += rating
    current.count += 1
    ratings.set(companyId, current)
  }

  return {
    month,
    restaurants,
    visits: current.visits,
    previousVisits: previous.visits,
    noShows: current.noShows,
    promotions,
    ratings,
  }
}

const cache = new Map<string, { at: number; promise: Promise<MonthData> }>()

function monthData(month: string): Promise<MonthData> {
  const hit = cache.get(month)
  const isPast = month < currentMonthKey()
  if (hit && (isPast || Date.now() - hit.at < CACHE_MS)) return hit.promise
  const promise = loadMonthData(month)
  cache.set(month, { at: Date.now(), promise })
  promise.catch(() => cache.delete(month))
  return promise
}

function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function rankEntries(rows: Array<{ restaurant: LeagueRestaurant; score: number; display: string; noShows: number }>): LeagueEntry[] {
  return rows
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.noShows - b.noShows || a.restaurant.name.localeCompare(b.restaurant.name, 'es'))
    .map((row, index) => ({ ...row.restaurant, rank: index + 1, score: row.score, display: row.display, noShows: row.noShows }))
}

/** Las cuatro clasificaciones de un mes, para una ciudad (clave normalizada) o para toda España (null). */
export async function computeLeague(month: string, municipalityKey: string | null): Promise<LeagueBoard[]> {
  const data = await monthData(month)
  const inScope = [...data.restaurants.values()].filter(
    (restaurant) => !municipalityKey || restaurant.municipalityKey === municipalityKey,
  )
  const noShows = (id: string) => data.noShows.get(id) ?? 0

  const boards: Record<LeagueId, LeagueEntry[]> = {
    reservations: rankEntries(inScope.map((restaurant) => {
      const visits = data.visits.get(restaurant.companyId) ?? 0
      return { restaurant, score: visits, display: formatNumber(visits), noShows: noShows(restaurant.companyId) }
    })),
    promotions: rankEntries(inScope.map((restaurant) => {
      const claims = data.promotions.get(restaurant.companyId) ?? 0
      return { restaurant, score: claims, display: formatNumber(claims), noShows: noShows(restaurant.companyId) }
    })),
    rating: rankEntries(inScope.map((restaurant) => {
      const rating = data.ratings.get(restaurant.companyId)
      if (!rating || rating.count < MIN_REVIEWS_FOR_RATING) {
        return { restaurant, score: 0, display: '', noShows: 0 }
      }
      const average = rating.sum / rating.count
      // La media pesa más, pero con más reseñas se gana confianza (log suave).
      const score = Math.round(average * Math.log2(rating.count + 1) * 100) / 100
      return { restaurant, score, display: `${formatNumber(average, 1)} ★ · ${rating.count}`, noShows: noShows(restaurant.companyId) }
    })),
    rising: rankEntries(inScope.map((restaurant) => {
      const now = data.visits.get(restaurant.companyId) ?? 0
      const before = data.previousVisits.get(restaurant.companyId) ?? 0
      if (now < MIN_VISITS_FOR_RISING) return { restaurant, score: 0, display: '', noShows: 0 }
      if (restaurant.isNew || before === 0) {
        return { restaurant, score: now, display: `${formatNumber(now)} · nuevo`, noShows: noShows(restaurant.companyId) }
      }
      const growth = now - before
      if (growth <= 0) return { restaurant, score: 0, display: '', noShows: 0 }
      const percent = Math.round((growth / before) * 100)
      return { restaurant, score: growth, display: `+${formatNumber(percent)} %`, noShows: noShows(restaurant.companyId) }
    })),
  }

  return LEAGUES.map((league) => ({ ...league, entries: boards[league.id] }))
}

/** Niveles agrupados en rangos de prestigio (se ven en la ficha y en Compite). */
export function prestigeForLevel(level: number): { id: 'bronze' | 'silver' | 'gold' | 'diamond'; label: string } {
  if (level >= 9) return { id: 'diamond', label: 'Diamante' }
  if (level >= 7) return { id: 'gold', label: 'Oro' }
  if (level >= 4) return { id: 'silver', label: 'Plata' }
  return { id: 'bronze', label: 'Bronce' }
}

export function previousMonthKey(month: string): string {
  return shiftMonth(month, -1)
}

/**
 * Podio de un mes ya cerrado, guardado una vez para los trofeos. Si aún no
 * existe, se calcula y se guarda (por ciudad y en España, top 3 de cada liga).
 */
export async function closedMonthResults(month: string): Promise<Record<string, unknown> | null> {
  if (!isMonthKey(month) || month >= currentMonthKey()) return null
  const ref = adminDb.collection('leagueResults').doc(month)
  const existing = await ref.get()
  if (existing.exists) return existing.data() ?? null

  const data = await monthData(month)
  const cities = [...new Set([...data.restaurants.values()].map((restaurant) => restaurant.municipalityKey).filter(Boolean))]
  const podium = (boards: LeagueBoard[]) => Object.fromEntries(
    boards.map((board) => [board.id, board.entries.slice(0, 3).map((entry) => ({
      companyId: entry.companyId, name: entry.name, rank: entry.rank, display: entry.display,
    }))]),
  )
  const byCity: Record<string, unknown> = {}
  const cityBoards: LeagueBoard[][] = []
  for (const city of cities) {
    const boards = await computeLeague(month, city)
    cityBoards.push(boards)
    byCity[city] = podium(boards)
  }
  const result = { month, spain: podium(await computeLeague(month, null)), byCity, savedAt: Timestamp.now() }
  try {
    // create() falla si otro proceso ya lo guardó: así los premios se dan una sola vez.
    await ref.create(result)
  } catch {
    const again = await ref.get()
    return again.data() ?? result
  }
  await awardLeaguePrizes(month, cityBoards).catch((error) => console.error('league prizes error:', error))
  return result
}

/** Trofeos de un local en los últimos meses cerrados (los guardados). */
export async function trophiesForCompany(companyId: string, months = 6): Promise<Array<{ month: string; league: LeagueId; rank: number; scope: 'city' | 'spain' }>> {
  const current = currentMonthKey()
  const keys = Array.from({ length: months }, (_, index) => shiftMonth(current, -(index + 1)))
  const trophies: Array<{ month: string; league: LeagueId; rank: number; scope: 'city' | 'spain' }> = []
  for (const month of keys) {
    const result = await closedMonthResults(month).catch(() => null)
    if (!result) continue
    const scan = (podium: unknown, scope: 'city' | 'spain') => {
      if (!podium || typeof podium !== 'object') return
      for (const [league, rows] of Object.entries(podium as Record<string, unknown>)) {
        for (const row of Array.isArray(rows) ? rows : []) {
          if (row && typeof row === 'object' && (row as { companyId?: string }).companyId === companyId) {
            trophies.push({ month, league: league as LeagueId, rank: Number((row as { rank?: number }).rank) || 0, scope })
          }
        }
      }
    }
    scan(result.spain, 'spain')
    for (const podium of Object.values((result.byCity as Record<string, unknown>) ?? {})) scan(podium, 'city')
  }
  return trophies
}

/** Todos los locales activos con su nivel (para «Casas ilustres», tengan o no actividad este mes). */
export async function leagueRestaurants(month: string, municipalityKey: string | null): Promise<LeagueRestaurant[]> {
  const data = await monthData(month)
  return [...data.restaurants.values()].filter(
    (restaurant) => !municipalityKey || restaurant.municipalityKey === municipalityKey,
  )
}

const PRIZE_XP = [500, 300, 200]
const TOP10_XP = 50

/** XP de premio por la liga de su ciudad y aviso al restaurante (solo al guardar el mes). */
async function awardLeaguePrizes(month: string, cityBoards: LeagueBoard[][]): Promise<void> {
  const totals = new Map<string, { xp: number; lines: string[] }>()
  for (const boards of cityBoards) {
    for (const board of boards) {
      for (const entry of board.entries.slice(0, 10)) {
        const xp = PRIZE_XP[entry.rank - 1] ?? TOP10_XP
        const current = totals.get(entry.companyId) ?? { xp: 0, lines: [] }
        current.xp += xp
        current.lines.push(`${entry.rank}.º en «${board.name}»`)
        totals.set(entry.companyId, current)
      }
    }
  }
  const { createCompanyNotification } = await import('../notifications/companyNotifications.ts')
  const [year, mon] = month.split('-').map(Number)
  const monthName = new Date(Date.UTC(year, mon - 1, 15)).toLocaleDateString('es-ES', { month: 'long', timeZone: TIME_ZONE })
  for (const [companyId, prize] of totals) {
    const ref = adminDb.collection('companyGamification').doc(companyId)
    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref)
      const data = snap.data() ?? {}
      const state = (data.state && typeof data.state === 'object' ? data.state : {}) as Record<string, unknown>
      const stateXp = Number(state.xp) || 0
      transaction.set(ref, {
        xp: (Number(data.xp) || stateXp) + prize.xp,
        state: { ...state, xp: stateXp + prize.xp },
        updatedAt: Timestamp.now(),
      }, { merge: true })
    })
    await createCompanyNotification(companyId, {
      type: 'league_result',
      title: `Liga de ${monthName}: +${prize.xp} XP`,
      body: `${prize.lines.join(' · ')}. Tus trofeos ya se ven en tu ficha.`,
      icon: '🏆',
      actionTab: 'compite-ranking',
      actionLabel: 'Ver la liga',
      dedupeKey: `league-${month}`,
    }).catch(() => undefined)
  }
}

export interface DiscoveryBoost {
  level: number
  /** En el Top 10 de su ciudad en alguna liga, este mes o el anterior. */
  top10: boolean
}

let boostCache: { at: number; promise: Promise<Map<string, DiscoveryBoost>> } | null = null

async function loadDiscoveryBoosts(): Promise<Map<string, DiscoveryBoost>> {
  const month = currentMonthKey()
  const data = await monthData(month)
  const boosts = new Map<string, DiscoveryBoost>()
  const cities = new Set<string>()
  for (const restaurant of data.restaurants.values()) {
    boosts.set(restaurant.companyId, { level: restaurant.level, top10: false })
    if (restaurant.municipalityKey) cities.add(restaurant.municipalityKey)
  }
  for (const key of [month, previousMonthKey(month)]) {
    for (const city of cities) {
      const boards = await computeLeague(key, city)
      for (const board of boards) {
        for (const entry of board.entries) {
          if (entry.rank > 10) break
          const boost = boosts.get(entry.companyId)
          if (boost) boost.top10 = true
        }
      }
    }
  }
  return boosts
}

/** Nivel y Top 10 de cada restaurante, para dar ventaja en las búsquedas. Caché de 10 min. */
export function discoveryBoosts(): Promise<Map<string, DiscoveryBoost>> {
  if (!boostCache || Date.now() - boostCache.at > CACHE_MS) {
    const promise = loadDiscoveryBoosts()
    boostCache = { at: Date.now(), promise }
    promise.catch(() => { boostCache = null })
  }
  return boostCache.promise
}

/**
 * Ventaja en las búsquedas (va después de los patrocinados, que siempre se
 * marcan): 3 Diamante (cabeza de Explorar), 2 Oro (prioridad), 1 Plata o Top 10
 * de su ciudad (más arriba), 0 el resto.
 */
export function discoveryBoostTier(boost: DiscoveryBoost | undefined): number {
  if (!boost) return 0
  if (boost.level >= 9) return 3
  if (boost.level >= 7) return 2
  return boost.level >= 4 || boost.top10 ? 1 : 0
}

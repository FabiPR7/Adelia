import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '../config/firebase'

export interface CompanyMonthMetrics {
  month: string
  views: {
    profile: number
    menuZone: number
    menuBoardOpens: number
    promoZone: number
  }
  promo: { views: number; claims: number; reserveClicks: number }
  search: { impressions: number; clicks: number }
  favorites: { add: number; remove: number }
  reservations: { fromPromo: number; fromProfile: number; fromQr: number }
  /** Escaneos de los QR impresos: reservas, carta y promociones. */
  qr: { total: number; reservas: number; carta: number; promo: number }
  menuBoards: Record<string, number>
  qrMenuBoards: Record<string, number>
  promos: Record<string, { views: number; claims: number; reserveClicks: number; reservations: number; qrScans: number }>
  daily: Record<string, { views: number; promoViews: number; claims: number; qrScans: number }>
  uniquesByDay: Record<string, number>
}

function n(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalize(month: string, raw: Record<string, unknown>): CompanyMonthMetrics {
  const views = (raw.views ?? {}) as Record<string, unknown>
  const promo = (raw.promo ?? {}) as Record<string, unknown>
  const search = (raw.search ?? {}) as Record<string, unknown>
  const favorites = (raw.favorites ?? {}) as Record<string, unknown>
  const reservations = (raw.reservations ?? {}) as Record<string, unknown>

  const promos: CompanyMonthMetrics['promos'] = {}
  for (const [id, value] of Object.entries((raw.promos ?? {}) as Record<string, unknown>)) {
    const entry = (value ?? {}) as Record<string, unknown>
    promos[id] = {
      views: n(entry.views),
      claims: n(entry.claims),
      reserveClicks: n(entry.reserveClicks),
      reservations: n(entry.reservations),
      qrScans: n(entry.qrScans),
    }
  }

  const daily: CompanyMonthMetrics['daily'] = {}
  for (const [day, value] of Object.entries((raw.daily ?? {}) as Record<string, unknown>)) {
    const entry = (value ?? {}) as Record<string, unknown>
    daily[day] = {
      views: n(entry.views),
      promoViews: n(entry.promoViews),
      claims: n(entry.claims),
      qrScans: n(entry.qrScans),
    }
  }

  const menuBoards: Record<string, number> = {}
  for (const [id, value] of Object.entries((raw.menuBoards ?? {}) as Record<string, unknown>)) {
    menuBoards[id] = n(value)
  }

  const qrMenuBoards: Record<string, number> = {}
  for (const [id, value] of Object.entries((raw.qrMenuBoards ?? {}) as Record<string, unknown>)) {
    qrMenuBoards[id] = n(value)
  }
  const qr = (raw.qr ?? {}) as Record<string, unknown>

  const uniquesByDay: Record<string, number> = {}
  for (const [day, value] of Object.entries((raw.uniquesByDay ?? {}) as Record<string, unknown>)) {
    uniquesByDay[day] = n(value)
  }

  return {
    month,
    views: {
      profile: n(views.profile),
      menuZone: n(views.menuZone),
      menuBoardOpens: n(views.menuBoardOpens),
      promoZone: n(views.promoZone),
    },
    promo: {
      views: n(promo.views),
      claims: n(promo.claims),
      reserveClicks: n(promo.reserveClicks),
    },
    search: { impressions: n(search.impressions), clicks: n(search.clicks) },
    favorites: { add: n(favorites.add), remove: n(favorites.remove) },
    reservations: {
      fromPromo: n(reservations.fromPromo),
      fromProfile: n(reservations.fromProfile),
      fromQr: n(reservations.fromQr),
    },
    qr: { total: n(qr.total), reservas: n(qr.reservas), carta: n(qr.carta), promo: n(qr.promo) },
    menuBoards,
    qrMenuBoards,
    promos,
    daily,
    uniquesByDay,
  }
}

/** Claves `yyyy-mm` desde `from` hasta `to` (inclusive). */
export function monthKeysInRange(from: Date, to: Date): string[] {
  const keys: string[] = []
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth(), 1)
  while (cursor <= end) {
    keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return keys
}

/** Suma dos árboles de contadores (números en las hojas). */
function sumCounterTrees(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'number') {
      target[key] = (typeof target[key] === 'number' ? target[key] as number : 0) + value
    } else if (value && typeof value === 'object' && !Array.isArray(value) && !('toDate' in value)) {
      const current = target[key] && typeof target[key] === 'object' ? target[key] as Record<string, unknown> : {}
      target[key] = sumCounterTrees(current, value as Record<string, unknown>)
    } else if (!(key in target)) {
      target[key] = value
    }
  }
  return target
}

/**
 * Cada mes son el documento `yyyy-mm` (visitantes únicos y datos antiguos) más
 * los repartidos `yyyy-mm_0..9` (contadores). Se piden todos en una consulta y
 * se suman por mes.
 */
export async function fetchCompanyMonthMetrics(
  companyId: string,
  months: string[],
): Promise<CompanyMonthMetrics[]> {
  if (months.length === 0) {
    return []
  }
  const metricsRef = collection(db, 'companies', companyId, 'metrics')
  const byMonth = new Map<string, Record<string, unknown>>()
  // `in` admite hasta 30 valores: se trocea por si el rango es muy largo.
  for (let index = 0; index < months.length; index += 30) {
    const chunk = months.slice(index, index + 30)
    const snap = await getDocs(query(metricsRef, where('month', 'in', chunk), limit(chunk.length * 12)))
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as Record<string, unknown>
      const month = typeof data.month === 'string' ? data.month : docSnap.id.split('_')[0]
      byMonth.set(month, sumCounterTrees(byMonth.get(month) ?? {}, data))
    }
  }
  return months
    .filter((month) => byMonth.has(month))
    .map((month) => normalize(month, byMonth.get(month)!))
}

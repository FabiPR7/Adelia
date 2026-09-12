import { doc, getDoc } from 'firebase/firestore'
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
  reservations: { fromPromo: number; fromProfile: number }
  menuBoards: Record<string, number>
  promos: Record<string, { views: number; claims: number; reserveClicks: number; reservations: number }>
  daily: Record<string, { views: number; promoViews: number; claims: number }>
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
    }
  }

  const daily: CompanyMonthMetrics['daily'] = {}
  for (const [day, value] of Object.entries((raw.daily ?? {}) as Record<string, unknown>)) {
    const entry = (value ?? {}) as Record<string, unknown>
    daily[day] = {
      views: n(entry.views),
      promoViews: n(entry.promoViews),
      claims: n(entry.claims),
    }
  }

  const menuBoards: Record<string, number> = {}
  for (const [id, value] of Object.entries((raw.menuBoards ?? {}) as Record<string, unknown>)) {
    menuBoards[id] = n(value)
  }

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
    reservations: { fromPromo: n(reservations.fromPromo), fromProfile: n(reservations.fromProfile) },
    menuBoards,
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

export async function fetchCompanyMonthMetrics(
  companyId: string,
  months: string[],
): Promise<CompanyMonthMetrics[]> {
  const snaps = await Promise.all(
    months.map((month) => getDoc(doc(db, 'companies', companyId, 'metrics', month))),
  )
  return snaps
    .filter((snap) => snap.exists())
    .map((snap) => normalize(snap.id, snap.data() as Record<string, unknown>))
}

import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from './collections.ts'

interface MissionCatalogEntry {
  name: string
  icon: string
  xp: number
  cadence: 'weekly' | 'monthly' | 'historical' | null
}

interface LevelCatalogEntry {
  level: number
  name: string
  minXp: number
}

let missionCache = new Map<string, MissionCatalogEntry>()
let levelCache: LevelCatalogEntry[] = []
let cacheAt = 0
const CACHE_MS = 5 * 60 * 1000

async function refreshCatalog(): Promise<void> {
  if (Date.now() - cacheAt < CACHE_MS && (missionCache.size > 0 || levelCache.length > 0)) {
    return
  }

  const [missionsSnap, levelsSnap] = await Promise.all([
    adminDb.collection(COLLECTIONS.missionCatalog).get(),
    adminDb.collection(COLLECTIONS.levelCatalog).get(),
  ])

  const missions = new Map<string, MissionCatalogEntry>()
  for (const item of missionsSnap.docs) {
    const data = item.data()
    const name = typeof data.name === 'string' ? data.name : ''
    if (!name) {
      continue
    }
    missions.set(item.id, {
      name,
      icon: typeof data.icon === 'string' && data.icon ? data.icon : '🏅',
      xp: typeof data.xp === 'number' ? data.xp : 0,
      cadence: data.cadence === 'weekly' || data.cadence === 'monthly' || data.cadence === 'historical'
        ? data.cadence
        : null,
    })
  }

  const levels = levelsSnap.docs
    .map((item) => {
      const data = item.data()
      const level = typeof data.level === 'number' ? data.level : Number(item.id)
      const name = typeof data.name === 'string'
        ? data.name
        : typeof data.title === 'string'
          ? data.title
          : ''
      const minXp = typeof data.minXp === 'number'
        ? data.minXp
        : typeof data.points === 'number'
          ? data.points
          : NaN
      if (!Number.isFinite(level) || !name || !Number.isFinite(minXp)) {
        return null
      }
      return { level, name, minXp }
    })
    .filter((item): item is LevelCatalogEntry => item !== null)
    .sort((left, right) => left.minXp - right.minXp)

  missionCache = missions
  levelCache = levels
  cacheAt = Date.now()
}

export async function getMissionCatalogEntry(missionId: string): Promise<MissionCatalogEntry | null> {
  try {
    await refreshCatalog()
  } catch {
    return null
  }
  return missionCache.get(missionId) ?? null
}

export async function getLevelForXpFromCatalog(xp: number): Promise<number> {
  try {
    await refreshCatalog()
  } catch {
    return fallbackLevelForXp(xp)
  }

  if (levelCache.length === 0) {
    return fallbackLevelForXp(xp)
  }

  let current = levelCache[0].level
  for (const entry of levelCache) {
    if (xp >= entry.minXp) {
      current = entry.level
    }
  }
  return current
}

export function fallbackLevelForXp(xp: number): number {
  if (xp >= 10000) return 7
  if (xp >= 6000) return 6
  if (xp >= 3200) return 5
  if (xp >= 1600) return 4
  if (xp >= 800) return 3
  if (xp >= 300) return 2
  return 1
}

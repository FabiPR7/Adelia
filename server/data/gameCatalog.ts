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
    adminDb.collection(COLLECTIONS.missionCatalog).limit(300).get(),
    adminDb.collection(COLLECTIONS.levelCatalog).limit(40).get(),
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

export async function listMissionCatalogEntries(): Promise<Map<string, MissionCatalogEntry>> {
  try {
    await refreshCatalog()
  } catch {
    return new Map()
  }
  return new Map(missionCache)
}

/**
 * Nivel según `levelCatalog` ya cargado en memoria (para escribirlo dentro de una
 * transacción sin esperar). Si aún no se ha leído, lo pide y devuelve null.
 */
export function cachedLevelForXp(xp: number): number | null {
  if (levelCache.length === 0 || Date.now() - cacheAt >= CACHE_MS) {
    void refreshCatalog().catch(() => undefined)
  }
  if (levelCache.length === 0) {
    return null
  }
  let current = levelCache[0].level
  for (const entry of levelCache) {
    if (xp >= entry.minXp) {
      current = entry.level
    }
  }
  return current
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

/** Respaldo de `levelCatalog` (mismos niveles que la web) para cuando la colección está vacía. */
const FALLBACK_LEVELS: LevelCatalogEntry[] = [
  { level: 1, name: 'Comensal Aficionado', minXp: 0 },
  { level: 2, name: 'Explorador de Sabores', minXp: 300 },
  { level: 3, name: 'Gourmet de Barrio', minXp: 800 },
  { level: 4, name: 'Crítico de la Casa', minXp: 1600 },
  { level: 5, name: 'Maestro de Mesa', minXp: 3200 },
  { level: 6, name: 'Leyenda Gastronómica', minXp: 6000 },
  { level: 7, name: 'Deidad del Paladar', minXp: 10000 },
  { level: 8, name: 'Gran Paladar', minXp: 15000 },
  { level: 9, name: 'Embajador Gourmet', minXp: 22000 },
  { level: 10, name: 'Titán del Menú', minXp: 32000 },
  { level: 11, name: 'Cliente Legendario', minXp: 45000 },
  { level: 12, name: 'Deidad Suprema', minXp: 65000 },
]

export function fallbackLevelForXp(xp: number): number {
  let current = FALLBACK_LEVELS[0].level
  for (const entry of FALLBACK_LEVELS) {
    if (xp >= entry.minXp) {
      current = entry.level
    }
  }
  return current
}

export interface LevelForXp {
  level: number
  title: string
  minXp: number
  maxXp: number | null
  progress: number
}

/** Nivel de un jugador según `levelCatalog`: el mismo que ve en su perfil. */
export async function getLevelDetailsForXp(xp: number): Promise<LevelForXp> {
  let levels = FALLBACK_LEVELS
  try {
    await refreshCatalog()
    if (levelCache.length > 0) {
      levels = levelCache
    }
  } catch {
    // Se usa el respaldo.
  }

  const safeXp = Math.max(0, xp)
  let index = 0
  levels.forEach((entry, at) => {
    if (safeXp >= entry.minXp) {
      index = at
    }
  })
  const entry = levels[index]
  const next = levels[index + 1]
  const maxXp = next ? next.minXp - 1 : null
  const span = maxXp == null ? 1 : maxXp - entry.minXp + 1
  return {
    level: entry.level,
    title: entry.name,
    minXp: entry.minXp,
    maxXp,
    progress: maxXp == null ? 1 : Math.min(1, Math.max(0, (safeXp - entry.minXp) / span)),
  }
}

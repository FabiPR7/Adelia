// Catálogo del juego (misiones, niveles y ajustes) desde la base de datos, para el
// motor de misiones del servidor. Mismo formato que leía la web (services/gameCatalog.ts).
import { adminDb } from '../../firebase-admin.ts'
import { COLLECTIONS } from '../../data/collections.ts'
import { applyMissionCatalog } from './missionsData.ts'
import { applyLevelCatalog } from './levelsData.ts'
import { applyGameConfig, type GamificationLevel, type MissionCadence, type MissionCategory, type MissionDefinition } from './types.ts'

const CADENCES: MissionCadence[] = ['weekly', 'monthly', 'historical']
const CATEGORIES: MissionCategory[] = ['loyalty', 'reviews', 'rewards', 'exploration']
const CACHE_MS = 5 * 60 * 1000

let loadedAt = 0
let inFlight: Promise<void> | null = null

function parseMission(id: string, data: Record<string, unknown>): MissionDefinition | null {
  const cadence = typeof data.cadence === 'string' && CADENCES.includes(data.cadence as MissionCadence)
    ? data.cadence as MissionCadence
    : null
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  const description = typeof data.description === 'string' ? data.description.trim() : ''
  const xp = typeof data.xp === 'number' ? data.xp : Number(data.xp)
  const target = typeof data.target === 'number' ? data.target : Number(data.target ?? 1)
  const icon = typeof data.icon === 'string' && data.icon.trim() ? data.icon : '🏅'
  if (!id || !cadence || !name || !description || !Number.isFinite(xp) || !Number.isFinite(target)) return null
  return {
    id,
    name,
    description,
    xp,
    cadence,
    icon,
    target,
    category: typeof data.category === 'string' && CATEGORIES.includes(data.category as MissionCategory)
      ? data.category as MissionCategory
      : undefined,
  }
}

function parseLevel(id: string, data: Record<string, unknown>): (GamificationLevel & { reward?: string }) | null {
  const level = typeof data.level === 'number' ? data.level : Number(id)
  const title = typeof data.name === 'string' && data.name.trim()
    ? data.name.trim()
    : typeof data.title === 'string' ? data.title.trim() : ''
  const minXp = typeof data.minXp === 'number'
    ? data.minXp
    : typeof data.points === 'number' ? data.points : Number(data.minXp)
  const maxXp = data.maxXp == null ? null : typeof data.maxXp === 'number' ? data.maxXp : Number(data.maxXp)
  const colors = Array.isArray(data.colors) ? data.colors.filter((item): item is string => typeof item === 'string') : []
  if (!Number.isFinite(level) || !title || !Number.isFinite(minXp)) return null
  return {
    level,
    title,
    minXp,
    maxXp: maxXp != null && Number.isFinite(maxXp) ? maxXp : null,
    colors: [colors[0] ?? '#FFFFFF', colors[1] ?? colors[0] ?? '#E0E0E0'],
    styleClass: typeof data.styleClass === 'string' && data.styleClass.trim() ? data.styleClass : `level${level}`,
    reward: typeof data.reward === 'string' && data.reward.trim() ? data.reward.trim() : undefined,
  }
}

async function refresh(): Promise<void> {
  const [missionsSnap, levelsSnap, configSnap] = await Promise.all([
    adminDb.collection(COLLECTIONS.missionCatalog).limit(300).get(),
    adminDb.collection(COLLECTIONS.levelCatalog).limit(40).get(),
    adminDb.collection('gameConfig').doc('adelia').get(),
  ])
  applyMissionCatalog(
    missionsSnap.docs
      .map((item) => parseMission(item.id, item.data()))
      .filter((item): item is MissionDefinition => item !== null)
      .sort((left, right) => left.id.localeCompare(right.id, 'es')),
  )
  const levels = levelsSnap.docs
    .map((item) => parseLevel(item.id, item.data()))
    .filter((item): item is GamificationLevel & { reward?: string } => item !== null)
    .sort((left, right) => left.level - right.level)
  applyLevelCatalog(
    levels,
    levels.filter((level) => level.reward).map((level) => ({ level: level.level, reward: level.reward as string })),
  )
  const config = configSnap.data()
  if (config) {
    applyGameConfig({
      weeklyBonusXp: typeof config.weeklyBonusXp === 'number' ? config.weeklyBonusXp : undefined,
      weeklyBonusTarget: typeof config.weeklyBonusTarget === 'number' ? config.weeklyBonusTarget : undefined,
      confirmedReservationXp: typeof config.confirmedReservationXp === 'number' ? config.confirmedReservationXp : undefined,
    })
  }
  loadedAt = Date.now()
}

/** Carga (o refresca cada 5 minutos) el catálogo. Si falla, se sigue con el último bueno. */
export async function ensureMissionCatalog(): Promise<void> {
  if (loadedAt > 0 && Date.now() - loadedAt < CACHE_MS) return
  if (!inFlight) {
    inFlight = refresh().catch((error) => {
      console.error('Mission catalog load error:', error)
    }).finally(() => {
      inFlight = null
    })
  }
  await inFlight
}

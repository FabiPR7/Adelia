import { collection, doc, getDoc, getDocs, limit, query } from 'firebase/firestore'
import { db } from '../config/firebase'
import { applyMissionCatalog } from '../data/gamificationMissions'
import { applyLevelCatalog } from '../data/gamificationLevels'
import { applyGameConfig } from '../types/gamification'
import type { GamificationLevel, MissionCadence, MissionCategory, MissionDefinition } from '../types/gamification'

const CADENCES: MissionCadence[] = ['weekly', 'monthly', 'historical']
const CATEGORIES: MissionCategory[] = ['loyalty', 'reviews', 'rewards', 'exploration']

function asCadence(value: unknown): MissionCadence | null {
  return typeof value === 'string' && CADENCES.includes(value as MissionCadence)
    ? (value as MissionCadence)
    : null
}

function asCategory(value: unknown): MissionCategory | undefined {
  return typeof value === 'string' && CATEGORIES.includes(value as MissionCategory)
    ? (value as MissionCategory)
    : undefined
}

function parseMission(id: string, data: Record<string, unknown>): MissionDefinition | null {
  const cadence = asCadence(data.cadence)
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  const description = typeof data.description === 'string' ? data.description.trim() : ''
  const xp = typeof data.xp === 'number' ? data.xp : Number(data.xp)
  const target = typeof data.target === 'number' ? data.target : Number(data.target ?? 1)
  const icon = typeof data.icon === 'string' && data.icon.trim() ? data.icon : '🏅'

  if (!id || !cadence || !name || !description || !Number.isFinite(xp) || !Number.isFinite(target)) {
    return null
  }

  return {
    id,
    name,
    description,
    xp,
    cadence,
    icon,
    target,
    category: asCategory(data.category),
  }
}

function parseLevel(id: string, data: Record<string, unknown>): (GamificationLevel & { reward?: string }) | null {
  const level = typeof data.level === 'number' ? data.level : Number(id)
  const title = typeof data.name === 'string' && data.name.trim()
    ? data.name.trim()
    : typeof data.title === 'string'
      ? data.title.trim()
      : ''
  const minXp = typeof data.minXp === 'number'
    ? data.minXp
    : typeof data.points === 'number'
      ? data.points
      : Number(data.minXp)
  const maxXp = data.maxXp == null ? null : typeof data.maxXp === 'number' ? data.maxXp : Number(data.maxXp)
  const colors = Array.isArray(data.colors)
    ? data.colors.filter((item): item is string => typeof item === 'string')
    : []
  const styleClass = typeof data.styleClass === 'string' && data.styleClass.trim()
    ? data.styleClass
    : `level${level}`

  if (!Number.isFinite(level) || !title || !Number.isFinite(minXp)) {
    return null
  }

  return {
    level,
    title,
    minXp,
    maxXp: Number.isFinite(maxXp) ? maxXp : null,
    colors: [colors[0] ?? '#FFFFFF', colors[1] ?? colors[0] ?? '#E0E0E0'],
    styleClass,
    reward: typeof data.reward === 'string' && data.reward.trim() ? data.reward.trim() : undefined,
  }
}

let catalogPromise: Promise<void> | null = null

export function loadGameCatalog(): Promise<void> {
  if (!catalogPromise) {
    catalogPromise = hydrateGameCatalog().catch(() => {
      catalogPromise = null
    })
  }
  return catalogPromise
}

async function hydrateGameCatalog(): Promise<void> {
  const [missionsSnap, levelsSnap, configSnap] = await Promise.all([
    getDocs(query(collection(db, 'missionCatalog'), limit(80))),
    getDocs(query(collection(db, 'levelCatalog'), limit(40))),
    getDoc(doc(db, 'gameConfig', 'adelia')),
  ])

  const missions = missionsSnap.docs
    .map((item) => parseMission(item.id, item.data() as Record<string, unknown>))
    .filter((item): item is MissionDefinition => item !== null)
    .sort((left, right) => left.id.localeCompare(right.id, 'es'))

  applyMissionCatalog(missions)

  const levels = levelsSnap.docs
    .map((item) => parseLevel(item.id, item.data() as Record<string, unknown>))
    .filter((item): item is GamificationLevel & { reward?: string } => item !== null)
    .sort((left, right) => left.level - right.level)

  applyLevelCatalog(
    levels,
    levels
      .filter((level) => typeof level.reward === 'string' && level.reward)
      .map((level) => ({ level: level.level, reward: level.reward as string })),
  )

  if (configSnap.exists()) {
    const data = configSnap.data() as Record<string, unknown>
    applyGameConfig({
      weeklyBonusXp: typeof data.weeklyBonusXp === 'number' ? data.weeklyBonusXp : undefined,
      weeklyBonusTarget: typeof data.weeklyBonusTarget === 'number' ? data.weeklyBonusTarget : undefined,
      confirmedReservationXp: typeof data.confirmedReservationXp === 'number'
        ? data.confirmedReservationXp
        : undefined,
    })
  }
}

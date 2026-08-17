import { allMissionDefinitions } from '../data/gamificationMissions'
import {
  WEEKLY_LEADERBOARD,
  buildLeaderboardWithUser,
  getUserRank,
} from '../data/gamificationLeaderboard'
import { getLevelForXp } from './gamificationProgress'

export type CelebrationKind =
  | 'xp_gain'
  | 'rank_up'
  | 'surpassed'
  | 'level_up'
  | 'mission_complete'

export interface CelebrationEvent {
  id: string
  kind: CelebrationKind
  title: string
  message: string
  xpGained?: number
  previousRank?: number
  newRank?: number
  surpassedName?: string
  levelTitle?: string
  missionName?: string
  missionId?: string
}

export interface GamificationSnapshot {
  xp: number
  rank: number
  level: number
  weeklyCompleted?: string[]
  monthlyCompleted?: string[]
  completedMissions?: string[]
}

export interface CelebrationProgress {
  weeklyCompleted: string[]
  monthlyCompleted: string[]
  completedMissions: string[]
}

const STORAGE_PREFIX = 'adelia-gamification-snapshot'
const RECEIPTS_PREFIX = 'adelia-celebration-receipts'
const WEEKLY_BONUS_ID = 'weekly_bonus'
const UNSET_RANK = 10_000

export interface CelebrationReceipts {
  bootstrapped: boolean
  lastCelebratedLevel: number
  lastCelebratedXp: number
  lastCelebratedRank: number
  missionIds: string[]
}

function uniqueIds(ids: Array<string | undefined | null>): string[] {
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0))]
}

function receiptsKey(userId: string): string {
  return `${RECEIPTS_PREFIX}:${userId}`
}

export function allCompletedMissionIds(progress: CelebrationProgress): string[] {
  return uniqueIds([
    ...progress.weeklyCompleted,
    ...progress.monthlyCompleted,
    ...progress.completedMissions,
  ])
}

export function emptyCelebrationReceipts(): CelebrationReceipts {
  return {
    bootstrapped: false,
    lastCelebratedLevel: 0,
    lastCelebratedXp: 0,
    lastCelebratedRank: UNSET_RANK,
    missionIds: [],
  }
}

export function mergeCelebrationReceipts(
  base: CelebrationReceipts,
  extra: Partial<CelebrationReceipts>,
): CelebrationReceipts {
  return {
    bootstrapped: base.bootstrapped || extra.bootstrapped === true,
    lastCelebratedLevel: Math.max(base.lastCelebratedLevel, extra.lastCelebratedLevel ?? 0),
    lastCelebratedXp: Math.max(base.lastCelebratedXp, extra.lastCelebratedXp ?? 0),
    lastCelebratedRank: Math.min(base.lastCelebratedRank, extra.lastCelebratedRank ?? UNSET_RANK),
    missionIds: uniqueIds([...base.missionIds, ...(extra.missionIds ?? [])]),
  }
}

export function readCelebrationReceipts(userId: string): CelebrationReceipts {
  try {
    const raw = localStorage.getItem(receiptsKey(userId))
    if (!raw) {
      const legacy = readGamificationSnapshot(userId)
      if (!legacy) {
        return emptyCelebrationReceipts()
      }

      return {
        bootstrapped: false,
        lastCelebratedLevel: legacy.level,
        lastCelebratedXp: legacy.xp,
        lastCelebratedRank: legacy.rank,
        missionIds: uniqueIds([
          ...(legacy.weeklyCompleted ?? []),
          ...(legacy.monthlyCompleted ?? []),
          ...(legacy.completedMissions ?? []),
        ]),
      }
    }

    const parsed = JSON.parse(raw) as Partial<CelebrationReceipts>
    return {
      bootstrapped: parsed.bootstrapped === true,
      lastCelebratedLevel: typeof parsed.lastCelebratedLevel === 'number' ? parsed.lastCelebratedLevel : 0,
      lastCelebratedXp: typeof parsed.lastCelebratedXp === 'number' ? parsed.lastCelebratedXp : 0,
      lastCelebratedRank: typeof parsed.lastCelebratedRank === 'number' ? parsed.lastCelebratedRank : UNSET_RANK,
      missionIds: uniqueIds(parsed.missionIds ?? []),
    }
  } catch {
    return emptyCelebrationReceipts()
  }
}

export function writeCelebrationReceipts(userId: string, receipts: CelebrationReceipts): void {
  try {
    localStorage.setItem(receiptsKey(userId), JSON.stringify(receipts))
    writeGamificationSnapshot(userId, {
      xp: receipts.lastCelebratedXp,
      rank: receipts.lastCelebratedRank === UNSET_RANK ? 99 : receipts.lastCelebratedRank,
      level: Math.max(1, receipts.lastCelebratedLevel),
      weeklyCompleted: receipts.missionIds,
      monthlyCompleted: receipts.missionIds,
      completedMissions: receipts.missionIds,
    })
  } catch {
    // Ignore quota errors.
  }
}

export function bootstrapCelebrationReceipts(
  userName: string,
  xp: number,
  level: number,
  levelTitle: string,
  progress: CelebrationProgress,
  extra?: Partial<CelebrationReceipts>,
): CelebrationReceipts {
  return mergeCelebrationReceipts({
    bootstrapped: true,
    lastCelebratedLevel: Math.max(1, level),
    lastCelebratedXp: Math.max(0, xp),
    lastCelebratedRank: getUserRank(userName, xp, level, levelTitle),
    missionIds: allCompletedMissionIds(progress),
  }, extra ?? {})
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export function readGamificationSnapshot(userId: string): GamificationSnapshot | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as GamificationSnapshot
    if (
      typeof parsed.xp !== 'number'
      || typeof parsed.rank !== 'number'
      || typeof parsed.level !== 'number'
    ) {
      return null
    }

    return {
      xp: parsed.xp,
      rank: parsed.rank,
      level: parsed.level,
      weeklyCompleted: stringList(parsed.weeklyCompleted),
      monthlyCompleted: stringList(parsed.monthlyCompleted),
      completedMissions: stringList(parsed.completedMissions),
    }
  } catch {
    return null
  }
}

export function writeGamificationSnapshot(userId: string, snapshot: GamificationSnapshot): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(snapshot))
  } catch {
    // Ignore quota errors.
  }
}

export function findSurpassedPlayers(oldXp: number, newXp: number): string[] {
  if (newXp <= oldXp) {
    return []
  }

  return WEEKLY_LEADERBOARD
    .filter((entry) => entry.xp > oldXp && entry.xp <= newXp)
    .sort((left, right) => right.xp - left.xp)
    .map((entry) => entry.displayName)
}

function newlyCompleted(previous: string[] | undefined, next: string[]): string[] {
  if (!previous) {
    return []
  }

  const seen = new Set(previous)
  return next.filter((id) => !seen.has(id))
}

function missionLabel(id: string): { name: string; xp: number } {
  if (id === WEEKLY_BONUS_ID) {
    return { name: 'Bonus de temporada', xp: 0 }
  }

  const mission = allMissionDefinitions().find((entry) => entry.id === id)
  return {
    name: mission?.name ?? 'una misión',
    xp: mission?.xp ?? 0,
  }
}

export function buildCelebrationEvents(
  snapshot: GamificationSnapshot | null,
  userName: string,
  xp: number,
  level: number,
  levelTitle: string,
  progress?: CelebrationProgress,
): CelebrationEvent[] {
  const newRank = getUserRank(userName, xp, level, levelTitle)
  const events: CelebrationEvent[] = []

  if (!snapshot) {
    return events
  }

  const completedIds = uniqueIds([
    ...newlyCompleted(snapshot.weeklyCompleted, progress?.weeklyCompleted ?? []),
    ...newlyCompleted(snapshot.monthlyCompleted, progress?.monthlyCompleted ?? []),
    ...newlyCompleted(snapshot.completedMissions, progress?.completedMissions ?? []),
  ])

  if (xp <= snapshot.xp && completedIds.length === 0) {
    return events
  }

  for (const missionId of completedIds) {
    const { name, xp: missionXp } = missionLabel(missionId)
    events.push({
      id: `mission:${missionId}`,
      kind: 'mission_complete',
      title: '¡Misión completada!',
      message: missionXp > 0
        ? `${name} · +${missionXp.toLocaleString('es-ES')} XP`
        : name,
      missionName: name,
      missionId,
      xpGained: missionXp > 0 ? missionXp : undefined,
    })
  }

  if (xp > snapshot.xp) {
    const xpGained = xp - snapshot.xp
    events.push({
      id: `xp-${xp}`,
      kind: 'xp_gain',
      title: `+${xpGained.toLocaleString('es-ES')} XP`,
      message: completedIds.length > 0
        ? 'El progreso ya cuenta en tu ranking.'
        : 'Sigue completando misiones para dominar el ranking.',
      xpGained,
    })
  }

  const newLevel = getLevelForXp(xp)
  if (newLevel.level > snapshot.level) {
    // La animación de subida de nivel la gestiona LevelUpCelebrationModal.
  }

  if (newRank < snapshot.rank) {
    events.push({
      id: `rank-${snapshot.rank}-${newRank}`,
      kind: 'rank_up',
      title: '¡Has subido en el ranking!',
      message: `Pasaste del puesto #${snapshot.rank} al #${newRank}. El podio te espera.`,
      previousRank: snapshot.rank,
      newRank,
    })
  }

  for (const surpassedName of findSurpassedPlayers(snapshot.xp, xp)) {
    events.push({
      id: `surpassed-${surpassedName}-${xp}`,
      kind: 'surpassed',
      title: `¡Has superado a ${surpassedName}!`,
      message: 'Sigue sumando reservas y misiones para escalar posiciones.',
      surpassedName,
    })
  }

  return events
}

export function receiptsToSnapshot(receipts: CelebrationReceipts): GamificationSnapshot {
  return {
    xp: receipts.lastCelebratedXp,
    rank: receipts.lastCelebratedRank === UNSET_RANK ? 99 : receipts.lastCelebratedRank,
    level: Math.max(1, receipts.lastCelebratedLevel),
    weeklyCompleted: receipts.missionIds,
    monthlyCompleted: receipts.missionIds,
    completedMissions: receipts.missionIds,
  }
}

export function applyProgressToReceipts(
  receipts: CelebrationReceipts,
  userName: string,
  xp: number,
  level: number,
  levelTitle: string,
  progress: CelebrationProgress,
): CelebrationReceipts {
  return mergeCelebrationReceipts(receipts, {
    bootstrapped: true,
    lastCelebratedXp: xp,
    lastCelebratedRank: getUserRank(userName, xp, level, levelTitle),
    missionIds: allCompletedMissionIds(progress),
  })
}

export function createSnapshot(
  userName: string,
  xp: number,
  level: number,
  levelTitle: string,
  progress?: CelebrationProgress,
): GamificationSnapshot {
  return {
    xp,
    rank: getUserRank(userName, xp, level, levelTitle),
    level,
    weeklyCompleted: [...(progress?.weeklyCompleted ?? [])],
    monthlyCompleted: [...(progress?.monthlyCompleted ?? [])],
    completedMissions: [...(progress?.completedMissions ?? [])],
  }
}

export function getLeaderboardAfterSurpass(
  userName: string,
  xp: number,
  level: number,
  levelTitle: string,
) {
  return buildLeaderboardWithUser(userName, xp, level, levelTitle)
}

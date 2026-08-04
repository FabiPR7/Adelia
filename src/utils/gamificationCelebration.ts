import {
  WEEKLY_LEADERBOARD,
  buildLeaderboardWithUser,
  getUserRank,
} from '../data/gamificationLeaderboard'
import { getLevelForXp } from './gamificationProgress'

export type CelebrationKind = 'xp_gain' | 'rank_up' | 'surpassed' | 'level_up'

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
}

export interface GamificationSnapshot {
  xp: number
  rank: number
  level: number
}

const STORAGE_PREFIX = 'adelia-gamification-snapshot'

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`
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

    return parsed
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

export function buildCelebrationEvents(
  snapshot: GamificationSnapshot | null,
  userName: string,
  xp: number,
  level: number,
  levelTitle: string,
): CelebrationEvent[] {
  const newRank = getUserRank(userName, xp, level, levelTitle)
  const events: CelebrationEvent[] = []

  if (!snapshot) {
    return events
  }

  if (xp <= snapshot.xp) {
    return events
  }

  const xpGained = xp - snapshot.xp
  const newLevel = getLevelForXp(xp)

  events.push({
    id: `xp-${xp}`,
    kind: 'xp_gain',
    title: `+${xpGained.toLocaleString('es-ES')} XP`,
    message: 'Sigue completando misiones para dominar el ranking.',
    xpGained,
  })

  if (newLevel.level > snapshot.level) {
    events.push({
      id: `level-${newLevel.level}`,
      kind: 'level_up',
      title: `¡Nivel ${newLevel.level}!`,
      message: `Has ascendido a ${newLevel.title}. Nuevo estilo desbloqueado para tu perfil.`,
      levelTitle: newLevel.title,
    })
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

export function createSnapshot(
  userName: string,
  xp: number,
  level: number,
  levelTitle: string,
): GamificationSnapshot {
  return {
    xp,
    rank: getUserRank(userName, xp, level, levelTitle),
    level,
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

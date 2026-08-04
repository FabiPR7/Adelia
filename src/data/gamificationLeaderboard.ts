export interface LeaderboardEntry {
  rank: number
  displayName: string
  xp: number
  level: number
  levelTitle: string
  streak: number
  isYou?: boolean
}

export const WEEKLY_LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    displayName: 'Laura G.',
    xp: 4820,
    level: 5,
    levelTitle: 'Maestro de Mesa',
    streak: 12,
  },
  {
    rank: 2,
    displayName: 'Marcos R.',
    xp: 3910,
    level: 4,
    levelTitle: 'Crítico de la Casa',
    streak: 8,
  },
  {
    rank: 3,
    displayName: 'Sofía M.',
    xp: 2840,
    level: 4,
    levelTitle: 'Crítico de la Casa',
    streak: 5,
  },
  {
    rank: 4,
    displayName: 'Diego P.',
    xp: 1760,
    level: 3,
    levelTitle: 'Gourmet de Barrio',
    streak: 3,
  },
  {
    rank: 5,
    displayName: 'Elena V.',
    xp: 920,
    level: 2,
    levelTitle: 'Explorador de Sabores',
    streak: 2,
  },
]

export function buildLeaderboardWithUser(
  userName: string,
  userXp: number,
  userLevel: number,
  userLevelTitle: string,
): LeaderboardEntry[] {
  const userEntry: LeaderboardEntry = {
    rank: 0,
    displayName: userName || 'Tú',
    xp: userXp,
    level: userLevel,
    levelTitle: userLevelTitle,
    streak: 1,
    isYou: true,
  }

  const merged = [...WEEKLY_LEADERBOARD, userEntry]
    .sort((left, right) => right.xp - left.xp)
    .slice(0, 6)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }))

  return merged
}

export function getUserRank(
  userName: string,
  userXp: number,
  userLevel: number,
  userLevelTitle: string,
): number {
  return buildLeaderboardWithUser(userName, userXp, userLevel, userLevelTitle).find(
    (entry) => entry.isYou,
  )?.rank ?? 6
}

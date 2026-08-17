import { getGamificationLevelTitle, GAMIFICATION_LEVELS } from './gamificationLevels'
import { getLevelForXp, getLevelProgress } from '../utils/gamificationProgress'
import { getBadgesForProfile } from '../utils/gamificationBadges'

export type RankingScope = 'country' | 'world'

export interface LeaderboardEntry {
  id?: string
  rank: number
  displayName: string
  xp: number
  level: number
  levelTitle: string
  styleClass: string
  levelProgress: number
  missionsCompleted: number
  streak: number
  photoUrl?: string
  homeCountry: string
  homeCity?: string
  reservationsTotal?: number
  foodPreferences?: string[]
  badgeIds?: string[]
  isYou?: boolean
}

function enrichEntry(
  entry: Omit<LeaderboardEntry, 'rank' | 'styleClass' | 'levelProgress' | 'badgeIds'> & {
    styleClass?: string
    levelProgress?: number
    badgeIds?: string[]
  },
): LeaderboardEntry {
  const levelDef = getLevelForXp(entry.xp)

  return {
    ...entry,
    rank: 0,
    level: entry.level || levelDef.level,
    levelTitle: entry.levelTitle || levelDef.title,
    styleClass: entry.styleClass ?? `level${entry.level || levelDef.level}`,
    levelProgress: entry.levelProgress ?? getLevelProgress(entry.xp, levelDef),
    badgeIds:
      entry.badgeIds
      ?? getBadgesForProfile(
        entry.level || levelDef.level,
        entry.missionsCompleted,
        entry.streak,
      ),
  }
}

/** Demo: un usuario por nivel (1–12) para previsualizar cada diseño de tarjeta. */
const SHOWCASE_USERS: Array<{
  id: string
  displayName: string
  level: number
  xp: number
  streak: number
  missionsCompleted: number
  levelProgress: number
  homeCountry: string
  homeCity: string
  reservationsTotal: number
  foodPreferences: string[]
}> = [
  {
    id: 'marta-l',
    displayName: 'Marta L.',
    level: 1,
    xp: 150,
    streak: 1,
    missionsCompleted: 2,
    levelProgress: 0.5,
    homeCountry: 'España',
    homeCity: 'Madrid',
    reservationsTotal: 3,
    foodPreferences: ['Italiana', 'Tapas'],
  },
  {
    id: 'carlos-a',
    displayName: 'Carlos A.',
    level: 2,
    xp: 420,
    streak: 2,
    missionsCompleted: 4,
    levelProgress: 0.35,
    homeCountry: 'España',
    homeCity: 'Barcelona',
    reservationsTotal: 6,
    foodPreferences: ['Asiática', 'Sushi'],
  },
  {
    id: 'elena-v',
    displayName: 'Elena V.',
    level: 3,
    xp: 980,
    streak: 3,
    missionsCompleted: 7,
    levelProgress: 0.22,
    homeCountry: 'España',
    homeCity: 'Valencia',
    reservationsTotal: 9,
    foodPreferences: ['Mediterránea', 'Vegana'],
  },
  {
    id: 'diego-p',
    displayName: 'Diego P.',
    level: 4,
    xp: 2100,
    streak: 4,
    missionsCompleted: 10,
    levelProgress: 0.31,
    homeCountry: 'México',
    homeCity: 'Ciudad de México',
    reservationsTotal: 14,
    foodPreferences: ['Mexicana', 'Tacos'],
  },
  {
    id: 'sofia-m',
    displayName: 'Sofía M.',
    level: 5,
    xp: 3800,
    streak: 5,
    missionsCompleted: 14,
    levelProgress: 0.2,
    homeCountry: 'España',
    homeCity: 'Sevilla',
    reservationsTotal: 18,
    foodPreferences: ['Andaluza', 'Mariscos'],
  },
  {
    id: 'marcos-r',
    displayName: 'Marcos R.',
    level: 6,
    xp: 7200,
    streak: 7,
    missionsCompleted: 18,
    levelProgress: 0.3,
    homeCountry: 'Argentina',
    homeCity: 'Buenos Aires',
    reservationsTotal: 22,
    foodPreferences: ['Parrilla', 'Vinos'],
  },
  {
    id: 'laura-g',
    displayName: 'Laura G.',
    level: 7,
    xp: 10500,
    streak: 9,
    missionsCompleted: 22,
    levelProgress: 1,
    homeCountry: 'España',
    homeCity: 'Bilbao',
    reservationsTotal: 28,
    foodPreferences: ['Pintxos', 'Gourmet'],
  },
  {
    id: 'pablo-n',
    displayName: 'Pablo N.',
    level: 8,
    xp: 12800,
    streak: 10,
    missionsCompleted: 26,
    levelProgress: 0.55,
    homeCountry: 'Colombia',
    homeCity: 'Bogotá',
    reservationsTotal: 31,
    foodPreferences: ['Colombiana', 'Café'],
  },
  {
    id: 'irene-s',
    displayName: 'Irene S.',
    level: 9,
    xp: 15200,
    streak: 11,
    missionsCompleted: 30,
    levelProgress: 0.62,
    homeCountry: 'España',
    homeCity: 'Málaga',
    reservationsTotal: 35,
    foodPreferences: ['Fusión', 'Brunch'],
  },
  {
    id: 'hugo-t',
    displayName: 'Hugo T.',
    level: 10,
    xp: 18900,
    streak: 13,
    missionsCompleted: 34,
    levelProgress: 0.48,
    homeCountry: 'Chile',
    homeCity: 'Santiago',
    reservationsTotal: 40,
    foodPreferences: ['Chilena', 'Mariscos'],
  },
  {
    id: 'clara-d',
    displayName: 'Clara D.',
    level: 11,
    xp: 23400,
    streak: 15,
    missionsCompleted: 38,
    levelProgress: 0.71,
    homeCountry: 'España',
    homeCity: 'Zaragoza',
    reservationsTotal: 44,
    foodPreferences: ['Aragonesa', 'Vegana'],
  },
  {
    id: 'raul-m',
    displayName: 'Raúl M.',
    level: 12,
    xp: 30000,
    streak: 18,
    missionsCompleted: 42,
    levelProgress: 0.85,
    homeCountry: 'España',
    homeCity: 'Madrid',
    reservationsTotal: 52,
    foodPreferences: ['Gourmet', 'Cócteles'],
  },
]

export const WEEKLY_LEADERBOARD: LeaderboardEntry[] = SHOWCASE_USERS.map((user) =>
  enrichEntry({
    id: user.id,
    displayName: user.displayName,
    xp: user.xp,
    level: user.level,
    levelTitle: getGamificationLevelTitle(user.level),
    streak: user.streak,
    missionsCompleted: user.missionsCompleted,
    levelProgress: user.levelProgress,
    styleClass: `level${user.level}`,
    photoUrl: '',
    homeCountry: user.homeCountry,
    homeCity: user.homeCity,
    reservationsTotal: user.reservationsTotal,
    foodPreferences: user.foodPreferences,
  }),
)

export function getShowcaseProfileById(id: string): LeaderboardEntry | undefined {
  return WEEKLY_LEADERBOARD.find((entry) => entry.id === id)
}

export function searchShowcaseUsers(query: string, excludeIds: string[] = []): LeaderboardEntry[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return []
  }

  return WEEKLY_LEADERBOARD.filter(
    (entry) =>
      !excludeIds.includes(entry.id ?? '')
      && entry.displayName.toLowerCase().includes(normalized),
  )
}

export interface BuildLeaderboardOptions {
  photoUrl?: string
  missionsCompleted?: number
  levelProgress?: number
  homeCountry?: string
  homeCity?: string
  reservationsTotal?: number
  foodPreferences?: string[]
  limit?: number
  scope?: RankingScope
}

function sortAndRank(entries: LeaderboardEntry[], limit: number): LeaderboardEntry[] {
  return [...entries]
    .sort((left, right) => right.xp - left.xp)
    .slice(0, limit)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }))
}

export function buildLeaderboardWithUser(
  userName: string,
  userXp: number,
  userLevel: number,
  userLevelTitle: string,
  options: BuildLeaderboardOptions = {},
): LeaderboardEntry[] {
  const levelDef = GAMIFICATION_LEVELS.find((level) => level.level === userLevel) ?? getLevelForXp(userXp)
  const userCountry = options.homeCountry || 'España'

  const userEntry = enrichEntry({
    id: 'you',
    displayName: userName || 'Tú',
    xp: userXp,
    level: userLevel,
    levelTitle: userLevelTitle,
    streak: 1,
    missionsCompleted: options.missionsCompleted ?? 0,
    photoUrl: options.photoUrl,
    levelProgress: options.levelProgress,
    styleClass: levelDef.styleClass,
    homeCountry: userCountry,
    homeCity: options.homeCity,
    reservationsTotal: options.reservationsTotal ?? 0,
    foodPreferences: options.foodPreferences ?? [],
    isYou: true,
  })

  let pool = import.meta.env.DEV ? WEEKLY_LEADERBOARD : []

  if (options.scope === 'country') {
    pool = pool.filter((entry) => entry.homeCountry === userCountry)
  }

  return sortAndRank([...pool, userEntry], options.limit ?? 13)
}

export function getUserRank(
  userName: string,
  userXp: number,
  userLevel: number,
  userLevelTitle: string,
  options: BuildLeaderboardOptions = {},
): number {
  return buildLeaderboardWithUser(userName, userXp, userLevel, userLevelTitle, options).find(
    (entry) => entry.isYou,
  )?.rank ?? 13
}

export function leaderboardEntryToFriendProfile(entry: LeaderboardEntry): import('../types/friends').FriendProfile {
  return {
    id: entry.id ?? entry.displayName.toLowerCase().replace(/\s+/g, '-'),
    displayName: entry.displayName,
    xp: entry.xp,
    level: entry.level,
    levelTitle: entry.levelTitle,
    levelProgress: entry.levelProgress,
    missionsCompleted: entry.missionsCompleted,
    reservationsTotal: entry.reservationsTotal ?? 0,
    streak: entry.streak,
    photoUrl: entry.photoUrl,
    homeCountry: entry.homeCountry,
    homeCity: entry.homeCity,
    foodPreferences: entry.foodPreferences ?? [],
    badgeIds: entry.badgeIds ?? [],
  }
}

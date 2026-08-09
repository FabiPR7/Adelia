export type MissionCadence = 'weekly' | 'monthly' | 'historical'

export type MissionCategory = 'loyalty' | 'reviews' | 'rewards' | 'exploration'

export interface MissionDefinition {
  id: string
  name: string
  xp: number
  cadence: MissionCadence
  category?: MissionCategory
  description: string
  /** Emoji or `adelina` / `adelina-review` for branded coin icons */
  icon: string
  target: number
}

export interface ClaimedPromotionRecord {
  promotionId: string
  companyId: string
  companyName: string
  companySlug: string
  title: string
  prizeLabel: string
  claimedAt: string
}

export interface CustomerGamificationState {
  xp: number
  adelinas: number
  completedMissions: string[]
  visitedCompanyIds: string[]
  weekKey: string
  weeklyCompleted: string[]
  monthKey: string
  monthlyCompleted: string[]
  reviewsCount: number
  redemptionsCount: number
  helpfulReviewVotes: number
  favoritesAddedThisWeek: number
  awardedReservationXpIds: string[]
  claimedPromotions: ClaimedPromotionRecord[]
  /** Visitas confirmadas acumuladas en el momento del último canje por restaurante. */
  ladderBaselinesByCompany: Record<string, number>
  /** Promo de escalón activa por restaurante (solo una a la vez si hay varias). */
  activeLadderPromotionByCompany: Record<string, string>
}

export interface MissionProgress {
  mission: MissionDefinition
  current: number
  completed: boolean
  progress: number
}

export interface GamificationLevel {
  level: number
  title: string
  minXp: number
  maxXp: number | null
  colors: [string, string]
  styleClass: string
}

export const WEEKLY_MISSION_BONUS_XP = 150
export const WEEKLY_BONUS_TARGET = 5
export const CONFIRMED_RESERVATION_XP = 25

export function defaultGamificationState(): CustomerGamificationState {
  return {
    xp: 0,
    adelinas: 0,
    completedMissions: [],
    visitedCompanyIds: [],
    weekKey: '',
    weeklyCompleted: [],
    monthKey: '',
    monthlyCompleted: [],
    reviewsCount: 0,
    redemptionsCount: 0,
    helpfulReviewVotes: 0,
    favoritesAddedThisWeek: 0,
    awardedReservationXpIds: [],
    claimedPromotions: [],
    ladderBaselinesByCompany: {},
    activeLadderPromotionByCompany: {},
  }
}

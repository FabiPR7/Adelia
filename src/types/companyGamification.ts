import type { GamificationLevel, MissionDefinition, MissionProgress } from './gamification'

export interface CompanyGamificationState {
  xp: number
  weekKey: string
  monthKey: string
  weeklyCompleted: string[]
  monthlyCompleted: string[]
  completedMissions: string[]
  awardedReservationXpIds: string[]
  awardedReviewXpIds: string[]
  awardedReplyXpIds: string[]
  lastCelebratedLevel: number | null
}

export interface CompanyRankingEntry {
  companyId: string
  name: string
  slug: string
  logoUrl: string
  municipality: string
  country: string
  xp: number
  level: number
  levelTitle: string
  reviewAdelinas: number
  reviewCount: number
  averageRating: number
  isYou?: boolean
  rank: number
}

export interface CompanyGamificationSnapshot {
  state: CompanyGamificationState
  level: GamificationLevel
  xpToNext: number | null
  weeklyProgress: MissionProgress[]
  monthlyProgress: MissionProgress[]
  historicalProgress: MissionProgress[]
  weeklyBonus: {
    completedCount: number
    bonusEarned: boolean
    bonusXp: number
  }
}

export function defaultCompanyGamificationState(): CompanyGamificationState {
  return {
    xp: 0,
    weekKey: '',
    monthKey: '',
    weeklyCompleted: [],
    monthlyCompleted: [],
    completedMissions: [],
    awardedReservationXpIds: [],
    awardedReviewXpIds: [],
    awardedReplyXpIds: [],
    lastCelebratedLevel: null,
  }
}

export type { MissionDefinition, MissionProgress, GamificationLevel }

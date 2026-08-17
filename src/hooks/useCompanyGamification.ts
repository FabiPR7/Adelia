import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getCompanyReviews } from '../services/companyReviews'
import { getCompanyPromotions } from '../services/promotions'
import { getReservationsByCompany } from '../services/firestore'
import { syncCompanyGamification } from '../services/companyGamification'
import { defaultCompanyGamificationState } from '../types/companyGamification'
import type { CompanyGamificationState } from '../types/companyGamification'
import type { Reservation } from '../types'
import type { CompanyReview } from '../types/review'
import {
  buildCompanyMissionProgress,
  rotateCompanyMonthlyMissions,
  rotateCompanyWeeklyMissions,
} from '../utils/companyGamificationProgress'
import {
  COMPANY_HISTORICAL_MISSIONS,
  COMPANY_LEVELS,
  COMPANY_WEEKLY_BONUS_TARGET,
  COMPANY_WEEKLY_BONUS_XP,
  getCompanyLevelForXp,
  getCompanyLevelProgress,
  getCompanyXpToNext,
} from '../data/companyGamificationCatalog'

export function useCompanyGamification(enabled: boolean) {
  const { company } = useAuth()
  const companyId = company?.id ?? ''
  const [state, setState] = useState<CompanyGamificationState>(defaultCompanyGamificationState)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [reviews, setReviews] = useState<CompanyReview[]>([])
  const [activePromotionCount, setActivePromotionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!companyId || !enabled) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [nextReservations, nextReviews, promotions, synced] = await Promise.all([
        getReservationsByCompany(companyId),
        getCompanyReviews(companyId),
        getCompanyPromotions(companyId).catch(() => []),
        syncCompanyGamification(),
      ])
      setReservations(nextReservations)
      setReviews(nextReviews)
      setActivePromotionCount(promotions.filter((item) => item.active).length)
      setState(synced.state)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar Compite.')
    } finally {
      setLoading(false)
    }
  }, [companyId, enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const snapshot = useMemo(() => {
    const context = {
      reservations,
      reviews,
      activePromotionCount,
      reviewAdelinas: company?.reviewAdelinas ?? 0,
      reviewCount: company?.reviewCount ?? reviews.length,
      reviewRatingSum: company?.reviewRatingSum ?? reviews.reduce((sum, review) => sum + review.rating, 0),
    }
    const weeklyProgress = buildCompanyMissionProgress(
      rotateCompanyWeeklyMissions(),
      context,
      new Set(state.weeklyCompleted),
      state.xp,
    )
    const monthlyProgress = buildCompanyMissionProgress(
      rotateCompanyMonthlyMissions(),
      context,
      new Set(state.monthlyCompleted),
      state.xp,
    )
    const historicalProgress = buildCompanyMissionProgress(
      COMPANY_HISTORICAL_MISSIONS,
      context,
      new Set(state.completedMissions),
      state.xp,
    )
    const completedCount = weeklyProgress.filter((item) => item.completed).length
    const level = getCompanyLevelForXp(state.xp)
    return {
      state,
      weeklyProgress,
      monthlyProgress,
      historicalProgress,
      weeklyBonus: {
        completedCount,
        bonusEarned: completedCount >= COMPANY_WEEKLY_BONUS_TARGET || state.weeklyCompleted.includes('weekly_bonus'),
        bonusXp: COMPANY_WEEKLY_BONUS_XP,
      },
      level,
      xpToNext: getCompanyXpToNext(state.xp, level),
      levelProgress: getCompanyLevelProgress(state.xp, level),
      nextLevel: COMPANY_LEVELS.find((item) => item.level === level.level + 1) ?? null,
    }
  }, [activePromotionCount, company?.reviewAdelinas, company?.reviewCount, company?.reviewRatingSum, reservations, reviews, state])

  return {
    ...snapshot,
    loading,
    error,
    refresh,
  }
}

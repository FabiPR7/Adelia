import { useEffect, useMemo, useRef, useState } from 'react'
import { HISTORICAL_MISSIONS } from '../data/gamificationMissions'
import { PROFILE_REWARDS } from '../data/gamificationLevels'
import { useAuth } from '../context/AuthContext'
import { updateCustomerGamification } from '../services/firestore'
import { syncGamificationNotifications } from '../services/customerNotifications'
import { mergeMonotonicCelebrations } from '../utils/gamificationCelebration'
import type { Reservation } from '../types'
import type { CustomerGamificationState, MissionProgress } from '../types/gamification'
import { defaultGamificationState } from '../types/gamification'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import {
  buildMissionProgressList,
  computeWeeklyBonusProgress,
  getLevelForXp,
  getLevelProgress,
  getWeekKey,
  getWeeklyFeaturedCategory,
  getXpToNextLevel,
  processGamificationRewards,
  rotateMonthlyMissions,
  rotateWeeklyMissions,
  type GamificationContext,
} from '../utils/gamificationProgress'

interface UseCustomerGamificationOptions {
  reservations: Reservation[]
  favoriteSlugs: string[]
  restaurants: PublicDiscoveryRestaurant[]
  promotionCompanyIds: Set<string>
  enabled: boolean
}

function completedMissionIdsFromState(state: CustomerGamificationState): string[] {
  return [...new Set([
    ...state.weeklyCompleted,
    ...state.monthlyCompleted,
    ...state.completedMissions,
  ])]
}

export function useCustomerGamification({
  reservations,
  favoriteSlugs,
  restaurants,
  promotionCompanyIds,
  enabled,
}: UseCustomerGamificationOptions) {
  const { user, profile, refreshProfile } = useAuth()
  const [state, setState] = useState<CustomerGamificationState>(() =>
    profile?.gamification ?? defaultGamificationState(),
  )
  const [syncing, setSyncing] = useState(false)
  const [evaluatedTick, setEvaluatedTick] = useState(0)
  const persistedRef = useRef<string>('')

  useEffect(() => {
    if (!profile?.gamification) {
      return
    }

    setState((current) => mergeMonotonicCelebrations(current, profile.gamification))
  }, [profile?.gamification])

  const weekKey = getWeekKey()
  const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const context = useMemo((): GamificationContext => {
    const restaurantZones = new Map<string, string>()
    const restaurantCategories = new Map<string, string[]>()

    for (const restaurant of restaurants) {
      restaurantZones.set(restaurant.id, restaurant.municipality || restaurant.location)
      restaurantCategories.set(restaurant.id, restaurant.characteristics ?? [])
    }

    return {
      reservations,
      favoriteSlugs,
      promotionCompanyIds,
      restaurantZones,
      restaurantCategories,
      weeklyFeaturedCategory: getWeeklyFeaturedCategory(),
    }
  }, [reservations, favoriteSlugs, promotionCompanyIds, restaurants, weekKey])

  const weeklyMissions = useMemo(() => rotateWeeklyMissions(), [weekKey])
  const monthlyMissions = useMemo(() => rotateMonthlyMissions(), [monthKey])

  const weeklyCompletedIds = useMemo(
    () => new Set(state.weeklyCompleted),
    [state.weeklyCompleted],
  )
  const monthlyCompletedIds = useMemo(
    () => new Set(state.monthlyCompleted),
    [state.monthlyCompleted],
  )
  const historicalCompletedIds = useMemo(
    () => new Set(state.completedMissions),
    [state.completedMissions],
  )

  const evaluationState = useMemo((): CustomerGamificationState => {
    const sameWeek = state.weekKey === weekKey

    return {
      ...state,
      favoriteSlugsAtWeekStart: sameWeek ? state.favoriteSlugsAtWeekStart : favoriteSlugs,
    }
  }, [state, weekKey, favoriteSlugs])

  const weeklyProgress = useMemo(
    () =>
      buildMissionProgressList(
        weeklyMissions,
        context,
        evaluationState,
        weeklyCompletedIds,
      ),
    [weeklyMissions, context, evaluationState, weeklyCompletedIds],
  )

  const monthlyProgress = useMemo(
    () =>
      buildMissionProgressList(
        monthlyMissions,
        context,
        evaluationState,
        monthlyCompletedIds,
      ),
    [monthlyMissions, context, evaluationState, monthlyCompletedIds],
  )

  const historicalProgress = useMemo(
    () =>
      buildMissionProgressList(
        HISTORICAL_MISSIONS,
        context,
        evaluationState,
        historicalCompletedIds,
      ),
    [context, evaluationState, historicalCompletedIds],
  )

  const weeklyBonus = useMemo(
    () => computeWeeklyBonusProgress(weeklyProgress),
    [weeklyProgress],
  )

  const level = useMemo(() => getLevelForXp(state.xp), [state.xp])
  const levelProgress = useMemo(() => getLevelProgress(state.xp, level), [state.xp, level])
  const xpToNext = useMemo(() => getXpToNextLevel(state.xp, level), [state.xp, level])

  const unlockedRewards = useMemo(
    () => PROFILE_REWARDS.filter((reward) => level.level >= reward.level),
    [level.level],
  )

  useEffect(() => {
    if (!enabled || !user || profile?.role !== 'customer') {
      return
    }

    const nextState = processGamificationRewards(
      evaluationState,
      weeklyProgress,
      monthlyProgress,
      historicalProgress,
      reservations,
      favoriteSlugs,
    )
    setEvaluatedTick((tick) => tick + 1)

    const fingerprint = JSON.stringify({
      xp: nextState.xp,
      weekly: nextState.weeklyCompleted,
      monthly: nextState.monthlyCompleted,
      historical: nextState.completedMissions,
      visited: nextState.visitedCompanyIds,
      awarded: nextState.awardedReservationXpIds,
      claims: nextState.claimedPromotions.map((entry) => entry.promotionId),
      redemptions: nextState.redemptionsCount,
      reviews: nextState.reviewsCount,
      reviewsPhoto: nextState.reviewsWithPhotoCount,
      reviewsText: nextState.textReviewsCount,
      reviewedReservations: nextState.reviewedReservationIds,
      favoritesWeek: nextState.favoritesAddedThisWeek,
      favoriteBaseline: nextState.favoriteSlugsAtWeekStart,
      ladderBaselines: nextState.ladderBaselinesByCompany,
      activeLadder: nextState.activeLadderPromotionByCompany,
      ladderCompletions: nextState.ladderCompletionsByCompany,
      penalty: nextState.xpPenaltyTotal,
      strikes: nextState.cancellationStrikeCount,
      promoLocked: nextState.promoLocked,
      inventory: nextState.inventory,
      grantedItemKeys: nextState.grantedItemKeys,
      tokenCredits: nextState.tokenCreditsByCompany,
      pendingTokenSpend: nextState.pendingTokenSpend,
      celebratedMissions: nextState.celebratedMissionIds,
      celebratedLevel: nextState.lastCelebratedLevel,
      celebrationsBootstrapped: nextState.celebrationsBootstrapped,
    })

    if (fingerprint === persistedRef.current) {
      return
    }

    persistedRef.current = fingerprint
    const merged = mergeMonotonicCelebrations(evaluationState, nextState)
    setState(merged)
    setSyncing(true)

    const beforeGamification = { ...evaluationState }

    void updateCustomerGamification(user.uid, merged)
      .then(async () => {
        const beforeIds = new Set(completedMissionIdsFromState(beforeGamification))
        const newIds = completedMissionIdsFromState(merged).filter((id) => !beforeIds.has(id))
        const looksLikeHistoryReplay = beforeIds.size === 0 && newIds.length > 1
        if (newIds.length > 0 && !looksLikeHistoryReplay) {
          await syncGamificationNotifications(beforeGamification)
        }
        return refreshProfile()
      })
      .catch(() => {
        persistedRef.current = ''
      })
      .finally(() => {
        setSyncing(false)
      })
  }, [
    enabled,
    user,
    profile?.role,
    evaluationState,
    favoriteSlugs,
    refreshProfile,
    weeklyProgress,
    monthlyProgress,
    historicalProgress,
    reservations,
  ])

  return {
    state,
    level,
    levelProgress,
    xpToNext,
    weeklyProgress,
    monthlyProgress,
    historicalProgress,
    weeklyBonus,
    unlockedRewards,
    syncing,
    evaluatedTick,
    weeklyFeaturedCategory: context.weeklyFeaturedCategory,
  }
}

export type CustomerGamificationView = ReturnType<typeof useCustomerGamification>

export function pickFeaturedMissions(progress: MissionProgress[], count = 4): MissionProgress[] {
  const incomplete = progress.filter((item) => !item.completed)
  const completed = progress.filter((item) => item.completed)

  return [...incomplete, ...completed].slice(0, count)
}

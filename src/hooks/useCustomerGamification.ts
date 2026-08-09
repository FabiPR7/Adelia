import { useEffect, useMemo, useRef, useState } from 'react'
import { HISTORICAL_MISSIONS, MONTHLY_MISSIONS } from '../data/gamificationMissions'
import { PROFILE_REWARDS } from '../data/gamificationLevels'
import { useAuth } from '../context/AuthContext'
import { updateCustomerGamification } from '../services/firestore'
import type { Reservation } from '../types'
import type { CustomerGamificationState, MissionProgress } from '../types/gamification'
import { defaultGamificationState } from '../types/gamification'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import {
  buildMissionProgressList,
  computeWeeklyBonusProgress,
  deriveVisitedCompanyIds,
  getLevelForXp,
  getLevelProgress,
  getXpToNextLevel,
  processGamificationRewards,
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
  const persistedRef = useRef<string>('')

  useEffect(() => {
    if (profile?.gamification) {
      setState(profile.gamification)
    }
  }, [profile?.gamification])

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
    }
  }, [reservations, favoriteSlugs, promotionCompanyIds, restaurants])

  const weeklyMissions = useMemo(() => rotateWeeklyMissions(), [])
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

  const enrichedState = useMemo(
    (): CustomerGamificationState => ({
      ...state,
      visitedCompanyIds: [
        ...new Set([...state.visitedCompanyIds, ...deriveVisitedCompanyIds(reservations)]),
      ],
    }),
    [state, reservations],
  )

  const weeklyProgress = useMemo(
    () =>
      buildMissionProgressList(
        weeklyMissions,
        context,
        enrichedState,
        weeklyCompletedIds,
      ),
    [weeklyMissions, context, enrichedState, weeklyCompletedIds],
  )

  const monthlyProgress = useMemo(
    () =>
      buildMissionProgressList(
        MONTHLY_MISSIONS,
        context,
        enrichedState,
        monthlyCompletedIds,
      ),
    [context, enrichedState, monthlyCompletedIds],
  )

  const historicalProgress = useMemo(
    () =>
      buildMissionProgressList(
        HISTORICAL_MISSIONS,
        context,
        enrichedState,
        historicalCompletedIds,
      ),
    [context, enrichedState, historicalCompletedIds],
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
      {
        ...enrichedState,
        favoritesAddedThisWeek: Math.max(
          enrichedState.favoritesAddedThisWeek,
          favoriteSlugs.length >= 3 ? 3 : favoriteSlugs.length,
        ),
      },
      weeklyProgress,
      monthlyProgress,
      historicalProgress,
      reservations,
    )

    const fingerprint = JSON.stringify({
      xp: nextState.xp,
      weekly: nextState.weeklyCompleted,
      monthly: nextState.monthlyCompleted,
      historical: nextState.completedMissions,
      visited: nextState.visitedCompanyIds,
      awarded: nextState.awardedReservationXpIds,
      claims: nextState.claimedPromotions.map((entry) => entry.promotionId),
      redemptions: nextState.redemptionsCount,
      ladderBaselines: nextState.ladderBaselinesByCompany,
      activeLadder: nextState.activeLadderPromotionByCompany,
    })

    if (fingerprint === persistedRef.current) {
      return
    }

    persistedRef.current = fingerprint
    setState(nextState)
    setSyncing(true)

    void updateCustomerGamification(user.uid, nextState)
      .then(() => refreshProfile())
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
    enrichedState,
    favoriteSlugs.length,
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
  }
}

export type CustomerGamificationView = ReturnType<typeof useCustomerGamification>

export function pickFeaturedMissions(progress: MissionProgress[], count = 4): MissionProgress[] {
  const incomplete = progress.filter((item) => !item.completed)
  const completed = progress.filter((item) => item.completed)

  return [...incomplete, ...completed].slice(0, count)
}

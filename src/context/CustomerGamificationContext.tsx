import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import LevelUpCelebrationModal from '../components/LevelUpCelebrationModal'
import GamificationCelebrationToast from '../components/GamificationCelebrationToast'
import { useAuth } from './AuthContext'
import { useFavoriteRestaurants } from './FavoriteRestaurantsContext'
import { listPromotionClaims } from '../services/promotionClaims'
import { fetchPublicDiscoveryRestaurants } from '../services/publicDiscovery'
import {
  acknowledgeCelebrations,
  getCustomerReservations,
  recordPromotionClaim,
  recordTimeLimitedPromotionClaim,
  applyInventoryReservationToken,
  useInventoryItem,
  claimSeasonInventoryPack,
} from '../services/firestore'
import { fetchPublicPromotions, type PublicPromotion } from '../services/publicPromotions'
import { useCustomerGamification } from '../hooks/useCustomerGamification'
import { useLevelUpCelebration } from '../hooks/useLevelUpCelebration'
import { useGamificationCelebrations } from '../hooks/useGamificationCelebrations'
import { useCustomerNotifications } from '../hooks/useCustomerNotifications'
import { getGamificationLevelByNumber } from '../data/gamificationLevels'
import type { Reservation } from '../types'
import type { ClaimedPromotionRecord } from '../types/gamification'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import { buildVerifiedReservationCounts } from '../utils/gamificationProgress'
import { mergeTokenCredits } from '../data/inventoryItems'
import { buildPendingReservationCounts } from '../utils/promotionReservationProgress'
import { resolvePromotionHighlight } from '../utils/promotionOffer'
import { isCustomerPromoLocked, PROMO_LOCK_CLAIM_MESSAGE } from '../data/cancellationPenalties'
import {
  mergeDemoReservationCounts,
  mergeDemoPromotions,
} from '../data/demoNearbyPromotions'
import type { CompanyLadderRuntime } from '../utils/promotionReservationProgress'
import type { CustomerGamificationView } from '../hooks/useCustomerGamification'
import type { LevelUpStep } from '../hooks/useLevelUpCelebration'
import {
  bootstrapCelebrationReceipts,
  mergeCelebrationReceipts,
  readCelebrationReceipts,
  writeCelebrationReceipts,
  type CelebrationEvent,
} from '../utils/gamificationCelebration'

interface CustomerGamificationContextValue extends CustomerGamificationView {
  previewLevelUpCelebration: () => void
  loading: boolean
  reservations: Reservation[]
  restaurants: PublicDiscoveryRestaurant[]
  verifiedReservationCounts: Record<string, number>
  pendingReservationCounts: Record<string, number>
  ladderRuntime: CompanyLadderRuntime
  claimedPromotions: ClaimedPromotionRecord[]
  celebrations: {
    activeEvent: CelebrationEvent | null
    dismissActive: () => void
    rankJustImproved: boolean
    levelJustUp: boolean
  }
  claimPromotion: (
    promotion: PublicPromotion,
    companyLadderPromotions: PublicPromotion[],
  ) => Promise<void>
  claimTimeLimitedPromotion: (
    promotion: PublicPromotion,
    reservationId: string,
  ) => Promise<void>
  applyReservationToken: (itemId: string, companyId: string) => Promise<{
    visits: number
    coverCents: number
    remainderCents: number
    requiredCents: number
  }>
  useOwnedInventoryItem: (itemId: string) => Promise<string>
  claimSeasonPack: (pack: 'weekly_bonus' | 'weekly_clear' | 'monthly_clear') => Promise<void>
  refreshGamificationData: (options?: { silent?: boolean }) => Promise<void>
}

const CustomerGamificationContext = createContext<CustomerGamificationContextValue | null>(null)

export function CustomerGamificationProvider({ children }: { children: ReactNode }) {
  const { user, profile, refreshProfile, patchProfileGamification } = useAuth()
  const isCustomer = profile?.role === 'customer'
  const [restaurants, setRestaurants] = useState<PublicDiscoveryRestaurant[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [promotionCompanyIds, setPromotionCompanyIds] = useState<Set<string>>(new Set())
  const [storedClaims, setStoredClaims] = useState<ClaimedPromotionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [previewStep, setPreviewStep] = useState<LevelUpStep | null>(null)
  const lastRewardNotificationRef = useRef('')

  const refreshGamificationData = useCallback(async (options?: { silent?: boolean }) => {
    if (!isCustomer || !profile?.email) {
      setLoading(false)
      return
    }

    if (!options?.silent) {
      setLoading(true)
    }

    try {
      const [restaurantData, reservationData, promotions, claims] = await Promise.all([
        fetchPublicDiscoveryRestaurants(),
        getCustomerReservations(profile.email, user?.uid),
        fetchPublicPromotions().catch(() => (
          import.meta.env.DEV ? mergeDemoPromotions([]) : []
        )),
        user?.uid ? listPromotionClaims(user.uid) : Promise.resolve([]),
      ])

      setRestaurants(restaurantData)
      setReservations(reservationData)
      setPromotionCompanyIds(new Set(promotions.map((promotion) => promotion.companyId)))
      setStoredClaims(claims)
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }, [isCustomer, profile?.email, user?.uid])

  useEffect(() => {
    void refreshGamificationData()
  }, [refreshGamificationData])

  const { favoriteSlugs } = useFavoriteRestaurants()

  const gamification = useCustomerGamification({
    reservations,
    favoriteSlugs,
    restaurants,
    promotionCompanyIds,
    enabled: isCustomer,
  })

  const hydrated = Boolean(isCustomer && user?.uid && profile)

  useEffect(() => {
    if (!hydrated || !user?.uid || !profile) {
      return
    }

    const progress = {
      weeklyCompleted: gamification.state.weeklyCompleted,
      monthlyCompleted: gamification.state.monthlyCompleted,
      completedMissions: gamification.state.completedMissions,
    }
    const local = readCelebrationReceipts(user.uid)
    const merged = mergeCelebrationReceipts(local, {
      bootstrapped: gamification.state.celebrationsBootstrapped,
      lastCelebratedLevel: gamification.state.lastCelebratedLevel ?? 0,
      missionIds: gamification.state.celebratedMissionIds,
    })

    if (merged.bootstrapped) {
      writeCelebrationReceipts(user.uid, merged)

      if (!gamification.state.celebrationsBootstrapped) {
        const level = Math.max(merged.lastCelebratedLevel, gamification.level.level)
        patchProfileGamification({
          lastCelebratedLevel: level,
          celebratedMissionIds: merged.missionIds,
          celebrationsBootstrapped: true,
        })
        void acknowledgeCelebrations({
          level,
          missionIds: merged.missionIds,
          bootstrapped: true,
        })
      }

      return
    }

    const next = bootstrapCelebrationReceipts(
      profile.displayName ?? '',
      gamification.state.xp,
      gamification.level.level,
      gamification.level.title,
      progress,
      {
        lastCelebratedLevel: gamification.state.lastCelebratedLevel ?? 0,
        missionIds: gamification.state.celebratedMissionIds,
      },
    )

    writeCelebrationReceipts(user.uid, next)
    patchProfileGamification({
      lastCelebratedLevel: next.lastCelebratedLevel,
      celebratedMissionIds: next.missionIds,
      celebrationsBootstrapped: true,
    })
    void acknowledgeCelebrations({
      level: next.lastCelebratedLevel,
      missionIds: next.missionIds,
      bootstrapped: true,
    })
  }, [
    gamification.level.level,
    gamification.level.title,
    gamification.state.celebratedMissionIds,
    gamification.state.celebrationsBootstrapped,
    gamification.state.completedMissions,
    gamification.state.lastCelebratedLevel,
    gamification.state.monthlyCompleted,
    gamification.state.weeklyCompleted,
    gamification.state.xp,
    hydrated,
    patchProfileGamification,
    profile,
    user?.uid,
  ])

  const persistMissionReceipts = useCallback((payload: {
    missionIds: string[]
    bootstrapped: boolean
  }) => {
    patchProfileGamification({
      celebratedMissionIds: payload.missionIds,
      celebrationsBootstrapped: payload.bootstrapped,
    })
    void acknowledgeCelebrations({
      missionIds: payload.missionIds,
      bootstrapped: payload.bootstrapped,
    })
  }, [patchProfileGamification])

  const persistLevelReceipt = useCallback((level: number, missionIds: string[]) => {
    patchProfileGamification({
      lastCelebratedLevel: level,
      celebratedMissionIds: missionIds,
      celebrationsBootstrapped: true,
    })
  }, [patchProfileGamification])

  const levelUpCelebration = useLevelUpCelebration({
    userId: user?.uid,
    gamification: gamification.state,
    currentLevel: gamification.level.level,
    enabled: isCustomer,
    hydrated,
    refreshProfile,
    onAcknowledgedLevel: persistLevelReceipt,
  })

  const activeLevelUpStep = previewStep ?? levelUpCelebration.activeStep

  const celebrations = useGamificationCelebrations({
    userId: user?.uid,
    userName: profile?.displayName ?? '',
    xp: gamification.state.xp,
    level: gamification.level.level,
    levelTitle: gamification.level.title,
    weeklyCompleted: gamification.state.weeklyCompleted,
    monthlyCompleted: gamification.state.monthlyCompleted,
    completedMissions: gamification.state.completedMissions,
    celebratedMissionIds: gamification.state.celebratedMissionIds,
    celebrationsBootstrapped: gamification.state.celebrationsBootstrapped,
    enabled: isCustomer,
    hydrated,
    paused: Boolean(activeLevelUpStep),
    onPersistReceipts: persistMissionReceipts,
  })

  const { unreadNotifications } = useCustomerNotifications()

  useEffect(() => {
    if (!isCustomer) {
      return
    }

    const trigger = unreadNotifications.find((notification) => (
      notification.type === 'reservation_confirmed'
      || notification.type === 'reservation_received'
      || notification.type === 'promotion_claimed'
    ))

    if (!trigger || lastRewardNotificationRef.current === trigger.id) {
      return
    }

    lastRewardNotificationRef.current = trigger.id
    void refreshProfile().then(() => refreshGamificationData({ silent: true }))
  }, [isCustomer, refreshGamificationData, refreshProfile, unreadNotifications])

  const previewLevelUpCelebration = useCallback(() => {
    const current = Math.min(12, Math.max(1, gamification.level.level))
    setPreviewStep({
      fromLevel: Math.max(1, current - 1),
      toLevel: current,
    })
  }, [gamification.level.level])

  const cyclePreviewLevel = useCallback((delta: -1 | 1) => {
    setPreviewStep((current) => {
      const base = current?.toLevel ?? Math.min(12, Math.max(1, gamification.level.level))
      const next = ((base - 1 + delta + 12) % 12) + 1
      return {
        fromLevel: Math.max(1, next - 1),
        toLevel: next,
      }
    })
  }, [gamification.level.level])

  useEffect(() => {
    if (profile?.role !== 'customer') {
      return
    }

    const params = new URLSearchParams(window.location.search)
    if (params.get('previewLevelUp') !== '1') {
      return
    }

    previewLevelUpCelebration()

    params.delete('previewLevelUp')
    const nextSearch = params.toString()
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', nextUrl)
  }, [previewLevelUpCelebration, profile?.role])

  const handleLevelUpDismiss = useCallback(async () => {
    if (previewStep) {
      setPreviewStep(null)
      return
    }

    await levelUpCelebration.dismissActive()
  }, [levelUpCelebration, previewStep])

  const verifiedReservationCounts = useMemo(() => {
    const counts = buildVerifiedReservationCounts(reservations)
    const withCredits = mergeTokenCredits(
      counts,
      gamification.state.tokenCreditsByCompany,
    )
    return import.meta.env.DEV ? mergeDemoReservationCounts(withCredits) : withCredits
  }, [reservations, gamification.state.tokenCreditsByCompany])

  const pendingReservationCounts = useMemo(
    () => buildPendingReservationCounts(reservations),
    [reservations],
  )

  const claimedPromotions = storedClaims.length > 0
    ? storedClaims
    : profile?.gamification.claimedPromotions ?? []

  const ladderRuntime = useMemo(
    (): CompanyLadderRuntime => ({
      ladderBaselinesByCompany: profile?.gamification.ladderBaselinesByCompany ?? {},
      activeLadderPromotionByCompany: profile?.gamification.activeLadderPromotionByCompany ?? {},
      ladderCompletionsByCompany: profile?.gamification.ladderCompletionsByCompany ?? {},
    }),
    [
      profile?.gamification.ladderBaselinesByCompany,
      profile?.gamification.activeLadderPromotionByCompany,
      profile?.gamification.ladderCompletionsByCompany,
    ],
  )

  const claimPromotion = useCallback(async (
    promotion: PublicPromotion,
    companyLadderPromotions: PublicPromotion[],
  ) => {
    if (!user || !profile) {
      return
    }

    if (isCustomerPromoLocked(profile)) {
      throw new Error(PROMO_LOCK_CLAIM_MESSAGE)
    }

    const confirmedCountAtCompany = verifiedReservationCounts[promotion.companyId] ?? 0

    const claim: ClaimedPromotionRecord = {
      promotionId: promotion.id,
      companyId: promotion.companyId,
      companyName: promotion.companyName,
      companySlug: promotion.companySlug,
      title: promotion.title,
      prizeLabel: resolvePromotionHighlight(promotion, 0),
      claimedAt: new Date().toISOString(),
      description: promotion.description,
      detail: promotion.detail,
      photoUrl: promotion.photoUrl,
      companyPhotoUrl: promotion.companyPhotoUrl,
      promotionType: 'reservation_ladder',
    }

    await recordPromotionClaim(
      user.uid,
      claim,
      profile.gamification,
      confirmedCountAtCompany,
      companyLadderPromotions,
    )
    await refreshProfile()
    void refreshGamificationData({ silent: true })
  }, [profile, refreshGamificationData, refreshProfile, user, verifiedReservationCounts])

  const claimTimeLimitedPromotion = useCallback(async (
    promotion: PublicPromotion,
    reservationId: string,
  ) => {
    if (!user || !profile) {
      return
    }

    if (isCustomerPromoLocked(profile)) {
      throw new Error(PROMO_LOCK_CLAIM_MESSAGE)
    }

    const alreadyClaimed = claimedPromotions.some(
      (record) => record.reservationId === reservationId,
    )
    if (alreadyClaimed) {
      return
    }

    const claim: ClaimedPromotionRecord = {
      promotionId: promotion.id,
      companyId: promotion.companyId,
      companyName: promotion.companyName,
      companySlug: promotion.companySlug,
      title: promotion.title,
      prizeLabel: resolvePromotionHighlight(promotion, 0),
      claimedAt: new Date().toISOString(),
      description: promotion.description,
      detail: promotion.detail,
      photoUrl: promotion.photoUrl,
      companyPhotoUrl: promotion.companyPhotoUrl,
      promotionType: 'time_limited',
      reservationId,
    }

    await recordTimeLimitedPromotionClaim(user.uid, claim, profile.gamification)
    await refreshProfile()
    void refreshGamificationData({ silent: true })
  }, [claimedPromotions, profile, refreshGamificationData, refreshProfile, user])

  const applyReservationToken = useCallback(async (itemId: string, companyId: string) => {
    if (!user || !profile) {
      throw new Error('Debes iniciar sesión como cliente.')
    }
    if (isCustomerPromoLocked(profile)) {
      throw new Error(PROMO_LOCK_CLAIM_MESSAGE)
    }
    const result = await applyInventoryReservationToken(itemId, companyId)
    patchProfileGamification({
      inventory: result.inventory,
      tokenCreditsByCompany: result.tokenCreditsByCompany,
      pendingTokenSpend: result.pendingTokenSpend,
    })
    await refreshProfile()
    void refreshGamificationData({ silent: true })
    return result
  }, [patchProfileGamification, profile, refreshGamificationData, refreshProfile, user])

  const useOwnedInventoryItem = useCallback(async (itemId: string) => {
    if (!user || !profile) {
      throw new Error('Debes iniciar sesión como cliente.')
    }
    const result = await useInventoryItem(itemId)
    patchProfileGamification({
      inventory: result.inventory,
      xp: result.xp,
      cancellationStrikeCount: result.cancellationStrikeCount,
      promoLocked: result.promoLocked,
    })
    await refreshProfile()
    void refreshGamificationData({ silent: true })
    return result.message
  }, [patchProfileGamification, profile, refreshGamificationData, refreshProfile, user])

  const claimSeasonPack = useCallback(async (pack: 'weekly_bonus' | 'weekly_clear' | 'monthly_clear') => {
    if (!user || !profile) {
      throw new Error('Debes iniciar sesión como cliente.')
    }
    const result = await claimSeasonInventoryPack(pack)
    patchProfileGamification({
      inventory: result.inventory,
      grantedItemKeys: result.grantedItemKeys,
    })
    await refreshProfile()
    void refreshGamificationData({ silent: true })
  }, [patchProfileGamification, profile, refreshGamificationData, refreshProfile, user])

  const value = useMemo(
    (): CustomerGamificationContextValue => ({
      ...gamification,
      loading,
      reservations,
      restaurants,
      verifiedReservationCounts,
      pendingReservationCounts,
      ladderRuntime,
      claimedPromotions,
      claimPromotion,
      claimTimeLimitedPromotion,
      applyReservationToken,
      useOwnedInventoryItem,
      claimSeasonPack,
      refreshGamificationData,
      previewLevelUpCelebration,
      celebrations: {
        activeEvent: celebrations.activeEvent,
        dismissActive: celebrations.dismissActive,
        rankJustImproved: celebrations.rankJustImproved,
        levelJustUp: celebrations.levelJustUp,
      },
    }),
    [
      gamification,
      loading,
      reservations,
      restaurants,
      verifiedReservationCounts,
      pendingReservationCounts,
      ladderRuntime,
      claimedPromotions,
      claimPromotion,
      claimTimeLimitedPromotion,
      applyReservationToken,
      useOwnedInventoryItem,
      claimSeasonPack,
      refreshGamificationData,
      previewLevelUpCelebration,
      celebrations.activeEvent,
      celebrations.dismissActive,
      celebrations.rankJustImproved,
      celebrations.levelJustUp,
    ],
  )

  return (
    <CustomerGamificationContext.Provider value={value}>
      <LevelUpCelebrationModal
        step={activeLevelUpStep}
        displayName={profile?.displayName ?? 'Tu perfil'}
        handle={profile ? `@${profile.email.split('@')[0] ?? 'usuario'}` : undefined}
        photoUrl={profile?.photoUrl || undefined}
        xp={
          previewStep
            ? Math.max(
              gamification.state.xp,
              getGamificationLevelByNumber(previewStep.toLevel).minXp,
            )
            : gamification.state.xp
        }
        preview={Boolean(previewStep)}
        onPreviewCycle={cyclePreviewLevel}
        onDismiss={() => void handleLevelUpDismiss()}
        dismissing={!previewStep && levelUpCelebration.acknowledging}
      />
      <GamificationCelebrationToast
        event={activeLevelUpStep ? null : celebrations.activeEvent}
        onDismiss={celebrations.dismissActive}
      />
      {children}
    </CustomerGamificationContext.Provider>
  )
}

export function useCustomerGamificationContext(): CustomerGamificationContextValue {
  const context = useContext(CustomerGamificationContext)

  if (!context) {
    throw new Error('useCustomerGamificationContext must be used within CustomerGamificationProvider')
  }

  return context
}

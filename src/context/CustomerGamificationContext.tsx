import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import LevelUpCelebrationModal from '../components/LevelUpCelebrationModal'
import { useAuth } from './AuthContext'
import {
  getAllCompanies,
  getCustomerReservations,
  recordPromotionClaim,
  recordTimeLimitedPromotionClaim,
} from '../services/firestore'
import { fetchPublicPromotions, type PublicPromotion } from '../services/publicPromotions'
import { useCustomerGamification } from '../hooks/useCustomerGamification'
import { useLevelUpCelebration } from '../hooks/useLevelUpCelebration'
import { getGamificationLevelByNumber } from '../data/gamificationLevels'
import type { Reservation } from '../types'
import type { ClaimedPromotionRecord } from '../types/gamification'
import { hasRestaurantProfile } from '../utils/publicBooking'
import {
  mapCompanyToDiscoveryRestaurant,
  mapCompanyToPublicBooking,
  type PublicDiscoveryRestaurant,
} from '../utils/publicDiscovery'
import { buildVerifiedReservationCounts } from '../utils/gamificationProgress'
import { buildPendingReservationCounts } from '../utils/promotionReservationProgress'
import { resolvePromotionHighlight } from '../utils/promotionOffer'
import {
  mergeDemoReservationCounts,
  mergeDemoPromotions,
} from '../data/demoNearbyPromotions'
import type { CompanyLadderRuntime } from '../utils/promotionReservationProgress'
import type { CustomerGamificationView } from '../hooks/useCustomerGamification'
import type { LevelUpStep } from '../hooks/useLevelUpCelebration'

interface CustomerGamificationContextValue extends CustomerGamificationView {
  previewLevelUpCelebration: () => void
  loading: boolean
  reservations: Reservation[]
  verifiedReservationCounts: Record<string, number>
  pendingReservationCounts: Record<string, number>
  ladderRuntime: CompanyLadderRuntime
  claimedPromotions: ClaimedPromotionRecord[]
  claimPromotion: (
    promotion: PublicPromotion,
    companyLadderPromotions: PublicPromotion[],
  ) => Promise<void>
  claimTimeLimitedPromotion: (
    promotion: PublicPromotion,
    reservationId: string,
  ) => Promise<void>
  refreshGamificationData: (options?: { silent?: boolean }) => Promise<void>
}

const CustomerGamificationContext = createContext<CustomerGamificationContextValue | null>(null)

export function CustomerGamificationProvider({ children }: { children: ReactNode }) {
  const { user, profile, refreshProfile } = useAuth()
  const [restaurants, setRestaurants] = useState<PublicDiscoveryRestaurant[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [promotionCompanyIds, setPromotionCompanyIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [previewStep, setPreviewStep] = useState<LevelUpStep | null>(null)

  const refreshGamificationData = useCallback(async (options?: { silent?: boolean }) => {
    if (!profile?.email) {
      setLoading(false)
      return
    }

    if (!options?.silent) {
      setLoading(true)
    }

    try {
      const [restaurantData, reservationData, promotions] = await Promise.all([
        getAllCompanies().then((companies) =>
          companies
            .filter((company) => hasRestaurantProfile(mapCompanyToPublicBooking(company)))
            .map(mapCompanyToDiscoveryRestaurant),
        ),
        getCustomerReservations(profile.email),
        fetchPublicPromotions().catch(() => mergeDemoPromotions([])),
      ])

      setRestaurants(restaurantData)
      setReservations(reservationData)
      setPromotionCompanyIds(new Set(promotions.map((promotion) => promotion.companyId)))
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }, [profile?.email])

  useEffect(() => {
    void refreshGamificationData()
  }, [refreshGamificationData])

  const favoriteSlugs = profile?.favoriteSlugs ?? []

  const gamification = useCustomerGamification({
    reservations,
    favoriteSlugs,
    restaurants,
    promotionCompanyIds,
    enabled: profile?.role === 'customer',
  })

  const levelUpCelebration = useLevelUpCelebration({
    userId: user?.uid,
    gamification: gamification.state,
    currentLevel: gamification.level.level,
    enabled: profile?.role === 'customer',
    refreshProfile,
  })

  const previewLevelUpCelebration = useCallback(() => {
    const toLevel = Math.min(7, Math.max(2, gamification.level.level + 1))
    const fromLevel = Math.max(1, toLevel - 1)
    setPreviewStep({ fromLevel, toLevel })
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

  const activeLevelUpStep = previewStep ?? levelUpCelebration.activeStep

  const handleLevelUpDismiss = useCallback(async () => {
    if (previewStep) {
      setPreviewStep(null)
      return
    }

    await levelUpCelebration.dismissActive()
  }, [levelUpCelebration, previewStep])

  const verifiedReservationCounts = useMemo(() => {
    const counts = buildVerifiedReservationCounts(reservations)
    return mergeDemoReservationCounts(counts)
  }, [reservations])

  const pendingReservationCounts = useMemo(
    () => buildPendingReservationCounts(reservations),
    [reservations],
  )

  const claimedPromotions = profile?.gamification.claimedPromotions ?? []

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

    const alreadyClaimed = profile.gamification.claimedPromotions.some(
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
  }, [profile, refreshGamificationData, refreshProfile, user])

  const value = useMemo(
    (): CustomerGamificationContextValue => ({
      ...gamification,
      loading,
      reservations,
      verifiedReservationCounts,
      pendingReservationCounts,
      ladderRuntime,
      claimedPromotions,
      claimPromotion,
      claimTimeLimitedPromotion,
      refreshGamificationData,
      previewLevelUpCelebration,
    }),
    [
      gamification,
      loading,
      reservations,
      verifiedReservationCounts,
      pendingReservationCounts,
      ladderRuntime,
      claimedPromotions,
      claimPromotion,
      claimTimeLimitedPromotion,
      refreshGamificationData,
      previewLevelUpCelebration,
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
        onDismiss={() => void handleLevelUpDismiss()}
        dismissing={!previewStep && levelUpCelebration.acknowledging}
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

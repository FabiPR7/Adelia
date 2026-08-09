import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import {
  getAllCompanies,
  getCustomerReservations,
  recordPromotionClaim,
} from '../services/firestore'
import { fetchPublicPromotions, type PublicPromotion } from '../services/publicPromotions'
import { useCustomerGamification } from '../hooks/useCustomerGamification'
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

interface CustomerGamificationContextValue extends CustomerGamificationView {
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
  refreshGamificationData: () => Promise<void>
}

const CustomerGamificationContext = createContext<CustomerGamificationContextValue | null>(null)

export function CustomerGamificationProvider({ children }: { children: ReactNode }) {
  const { user, profile, refreshProfile } = useAuth()
  const [restaurants, setRestaurants] = useState<PublicDiscoveryRestaurant[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [promotionCompanyIds, setPromotionCompanyIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const refreshGamificationData = useCallback(async () => {
    if (!profile?.email) {
      setLoading(false)
      return
    }

    setLoading(true)

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
      setLoading(false)
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
    }),
    [profile?.gamification.ladderBaselinesByCompany, profile?.gamification.activeLadderPromotionByCompany],
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
    }

    await recordPromotionClaim(
      user.uid,
      claim,
      profile.gamification,
      confirmedCountAtCompany,
      companyLadderPromotions,
    )
    await refreshProfile()
    await refreshGamificationData()
  }, [profile, refreshGamificationData, refreshProfile, user, verifiedReservationCounts])

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
      refreshGamificationData,
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
      refreshGamificationData,
    ],
  )

  return (
    <CustomerGamificationContext.Provider value={value}>
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

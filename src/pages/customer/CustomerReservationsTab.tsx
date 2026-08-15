import { Link } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import CustomerReservationCard from '../../components/CustomerReservationCard'
import CustomerReviewModal, { type CustomerReviewSubmitInput } from '../../components/CustomerReviewModal'
import MinimumSpendVerificationModal from '../../components/reservations/MinimumSpendVerificationModal'
import { canCustomerVerifyMinimumSpend } from '../../utils/minimumSpendVerification'
import { useAuth } from '../../context/AuthContext'
import { useCustomerGamificationContext } from '../../context/CustomerGamificationContext'
import { getPublicCompanyMenuNodes } from '../../services/companyMenu'
import { fetchPublicPromotions, fetchPublicPromotionsBySlug, type PublicPromotion } from '../../services/publicPromotions'
import {
  deleteCustomerReview,
  getCustomerReviewsByCompanyIds,
  submitCustomerReview,
  updateCustomerReview,
} from '../../services/companyReviews'
import { getAllCompanies, getCustomerReservations } from '../../services/firestore'
import type { Reservation } from '../../types'
import type { CompanyReview } from '../../types/review'
import type { MenuNode } from '../../types/company'
import type { VerifyMinimumSpendResult } from '../../services/minimumSpendApi'
import { hasRestaurantProfile } from '../../utils/publicBooking'
import { splitCustomerReservations } from '../../utils/customerReservations'
import {
  mapCompanyToDiscoveryRestaurant,
  mapCompanyToPublicBooking,
  type PublicDiscoveryRestaurant,
} from '../../utils/publicDiscovery'
import styles from './CustomerReservationsTab.module.css'

type ReservationTab = 'upcoming' | 'past'

function CustomerReservationsTab() {
  const { user, profile, refreshProfile } = useAuth()
  const { refreshGamificationData } = useCustomerGamificationContext()
  const [restaurants, setRestaurants] = useState<PublicDiscoveryRestaurant[]>([])
  const [reservations, setReservations] = useState<Awaited<ReturnType<typeof getCustomerReservations>>>([])
  const [reviewsByCompanyId, setReviewsByCompanyId] = useState<Record<string, CompanyReview>>({})
  const [tab, setTab] = useState<ReservationTab>('upcoming')
  const [loading, setLoading] = useState(true)
  const [verifyReservation, setVerifyReservation] = useState<Reservation | null>(null)
  const [reviewReservation, setReviewReservation] = useState<Reservation | null>(null)
  const [verifyMenuNodes, setVerifyMenuNodes] = useState<MenuNode[]>([])
  const [verifyMenuLoading, setVerifyMenuLoading] = useState(false)
  const [reviewMenuNodes, setReviewMenuNodes] = useState<MenuNode[]>([])
  const [reviewPromotions, setReviewPromotions] = useState<PublicPromotion[]>([])
  const [reviewCatalogLoading, setReviewCatalogLoading] = useState(false)
  const [promotionsById, setPromotionsById] = useState<Record<string, PublicPromotion>>({})

  const loadCustomerReviews = useCallback(async (
    reservationRows: Reservation[],
    customerUid: string,
  ) => {
    const companyIds = [...new Set(
      reservationRows
        .filter((reservation) => reservation.status === 'confirmed')
        .map((reservation) => reservation.companyId),
    )]

    if (companyIds.length === 0) {
      setReviewsByCompanyId({})
      return
    }

    const reviews = await getCustomerReviewsByCompanyIds(companyIds, customerUid)
    setReviewsByCompanyId(reviews)
  }, [])

  useEffect(() => {
    if (!profile || !user) {
      return
    }

    let cancelled = false

    void Promise.all([
      getAllCompanies().then((companies) =>
        companies
          .filter((company) => hasRestaurantProfile(mapCompanyToPublicBooking(company)))
          .map(mapCompanyToDiscoveryRestaurant),
      ),
      getCustomerReservations(profile.email),
      fetchPublicPromotions().catch(() => [] as PublicPromotion[]),
    ])
      .then(async ([restaurantData, reservationData, promotionData]) => {
        if (cancelled) {
          return
        }

        setRestaurants(restaurantData)
        setReservations(reservationData)
        setPromotionsById(Object.fromEntries(promotionData.map((promotion) => [promotion.id, promotion])))
        await loadCustomerReviews(reservationData, user.uid)
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [profile, user, loadCustomerReviews])

  const restaurantById = useMemo(
    () => Object.fromEntries(restaurants.map((restaurant) => [restaurant.id, restaurant])),
    [restaurants],
  )

  const { upcoming, past } = useMemo(
    () => splitCustomerReservations(reservations),
    [reservations],
  )

  const visible = tab === 'upcoming' ? upcoming : past
  const nextReservation = upcoming[0]

  useEffect(() => {
    if (!verifyReservation) {
      setVerifyMenuNodes([])
      return
    }

    let cancelled = false
    setVerifyMenuLoading(true)

    void getPublicCompanyMenuNodes(verifyReservation.companyId)
      .then((nodes) => {
        if (!cancelled) {
          setVerifyMenuNodes(nodes)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setVerifyMenuLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [verifyReservation])

  useEffect(() => {
    if (!reviewReservation) {
      setReviewMenuNodes([])
      setReviewPromotions([])
      return
    }

    const restaurant = restaurantById[reviewReservation.companyId]
    if (!restaurant?.slug) {
      setReviewMenuNodes([])
      setReviewPromotions([])
      return
    }

    let cancelled = false
    setReviewCatalogLoading(true)

    void Promise.all([
      getPublicCompanyMenuNodes(reviewReservation.companyId),
      fetchPublicPromotionsBySlug(restaurant.slug).catch(() => []),
    ])
      .then(([nodes, promotions]) => {
        if (!cancelled) {
          setReviewMenuNodes(nodes)
          setReviewPromotions(promotions)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReviewCatalogLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [reviewReservation, restaurantById])

  const refreshReviewsState = useCallback(async () => {
    if (!user) {
      return
    }

    await loadCustomerReviews(reservations, user.uid)
    await refreshProfile()
  }, [loadCustomerReviews, refreshProfile, reservations, user])

  const handleSubmitReview = async (input: CustomerReviewSubmitInput) => {
    if (!user || !profile?.gamification) {
      throw new Error('Debes iniciar sesión como cliente.')
    }

    await submitCustomerReview(profile.gamification, {
      reservationId: input.reservationId,
      companyId: input.companyId,
      customerUid: user.uid,
      customerName: profile.displayName
        || reservations.find((item) => item.id === input.reservationId)?.clientName
        || 'Cliente',
      rating: input.rating,
      comment: input.comment,
      mediaItems: input.mediaItems,
      taggedProducts: input.taggedProducts,
      taggedPromotions: input.taggedPromotions,
    })
    await refreshReviewsState()
  }

  const handleUpdateReview = async (input: CustomerReviewSubmitInput) => {
    if (!user || !profile?.gamification) {
      throw new Error('Debes iniciar sesión como cliente.')
    }

    await updateCustomerReview(profile.gamification, {
      companyId: input.companyId,
      customerUid: user.uid,
      customerName: profile.displayName
        || reservations.find((item) => item.id === input.reservationId)?.clientName
        || 'Cliente',
      reservationId: input.reservationId,
      rating: input.rating,
      comment: input.comment,
      mediaItems: input.mediaItems,
      taggedProducts: input.taggedProducts,
      taggedPromotions: input.taggedPromotions,
    })
    await refreshReviewsState()
  }

  const handleDeleteReview = async (companyId: string) => {
    if (!user || !profile?.gamification) {
      throw new Error('Debes iniciar sesión como cliente.')
    }

    await deleteCustomerReview(profile.gamification, companyId, user.uid)
    await refreshReviewsState()
  }

  const handleVerifiedMinimumSpend = (
    reservationId: string,
    result: VerifyMinimumSpendResult,
  ) => {
    setReservations((current) =>
      current.map((reservation) =>
        reservation.id === reservationId
          ? {
              ...reservation,
              promotionVisitStatus: result.promotionVisitStatus,
              minSpendVerification: result.minSpendVerification,
            }
          : reservation,
      ),
    )

    if (!result.meetsMinimumSpend) {
      return
    }

    void refreshProfile().then(() => refreshGamificationData({ silent: true }))
  }

  const activeReview = reviewReservation
    ? reviewsByCompanyId[reviewReservation.companyId] ?? null
    : null

  if (!profile || loading) {
    return <div className={styles.loading}>Cargando reservas…</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <p className={styles.eyebrow}>Tus planes</p>
        <h1>Mis reservas</h1>
        <p className={styles.lead}>Todo lo que tienes por vivir y lo que ya disfrutaste.</p>

        <div className={styles.heroStats}>
          <div>
            <strong>{upcoming.length}</strong>
            <span>Por ir</span>
          </div>
          <div>
            <strong>{past.length}</strong>
            <span>Hechas</span>
          </div>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Tipo de reservas">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'upcoming'}
          className={tab === 'upcoming' ? styles.tabActive : styles.tab}
          onClick={() => setTab('upcoming')}
        >
          Por ir
          <span>{upcoming.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'past'}
          className={tab === 'past' ? styles.tabActive : styles.tab}
          onClick={() => setTab('past')}
        >
          Hechas
          <span>{past.length}</span>
        </button>
      </div>

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon} aria-hidden="true">
            {tab === 'upcoming' ? '🍽️' : '📅'}
          </div>
          <h2>
            {tab === 'upcoming'
              ? 'Ninguna reserva pendiente'
              : 'Tu historial está vacío'}
          </h2>
          <p>
            {tab === 'upcoming'
              ? 'Explora restaurantes y reserva tu próxima experiencia.'
              : 'Cuando completes visitas, aparecerán aquí.'}
          </p>
          <Link to="/app/explorar" className={styles.emptyCta}>
            Buscar restaurante
          </Link>
        </div>
      ) : (
        <div className={styles.list}>
          {visible.map((reservation) => (
            <CustomerReservationCard
              key={reservation.id}
              reservation={reservation}
              restaurant={restaurantById[reservation.companyId]}
              promotion={
                reservation.promotionId
                  ? promotionsById[reservation.promotionId] ?? null
                  : null
              }
              bucket={tab}
              isNext={tab === 'upcoming' && reservation.id === nextReservation?.id}
              onVerifyMinimumSpend={(reservation) => {
                if (canCustomerVerifyMinimumSpend(reservation)) {
                  setVerifyReservation(reservation)
                }
              }}
              onLeaveReview={setReviewReservation}
              hasReviewForRestaurant={Boolean(reviewsByCompanyId[reservation.companyId])}
            />
          ))}
        </div>
      )}

      <CustomerReviewModal
        reservation={reviewReservation}
        restaurantName={reviewReservation ? (restaurantById[reviewReservation.companyId]?.name ?? 'Restaurante') : ''}
        restaurantSlug={reviewReservation ? (restaurantById[reviewReservation.companyId]?.slug ?? '') : ''}
        existingReview={activeReview}
        menuProducts={reviewMenuNodes}
        promotions={reviewPromotions}
        catalogLoading={reviewCatalogLoading}
        onClose={() => setReviewReservation(null)}
        onSubmit={handleSubmitReview}
        onUpdate={handleUpdateReview}
        onDelete={handleDeleteReview}
      />

      <MinimumSpendVerificationModal
        reservation={verifyReservation}
        restaurantName={verifyReservation ? (restaurantById[verifyReservation.companyId]?.name ?? 'Restaurante') : ''}
        promotion={
          verifyReservation?.promotionId
            ? promotionsById[verifyReservation.promotionId] ?? null
            : null
        }
        menuNodes={verifyMenuNodes}
        menuLoading={verifyMenuLoading}
        onClose={() => setVerifyReservation(null)}
        onVerified={handleVerifiedMinimumSpend}
      />
    </div>
  )
}

export default CustomerReservationsTab

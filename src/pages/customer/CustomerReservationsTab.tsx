import { Link } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CustomerReservationCard from '../../components/CustomerReservationCard'
import CustomerConsumptionCard from '../../components/CustomerConsumptionCard'
import CustomerReviewModal, { type CustomerReviewSubmitInput } from '../../components/CustomerReviewModal'
import MinimumSpendVerificationModal from '../../components/reservations/MinimumSpendVerificationModal'
import ReservationInvitesModal from '../../components/ReservationInvitesModal'
import PromoVisitCompleteModal from '../../components/promotions/PromoVisitCompleteModal'
import { canCustomerVerifyMinimumSpend } from '../../utils/minimumSpendVerification'
import { pendingTokenSpendForCompany, REVIEW_BOOST_ITEM_ID, inventoryQuantity } from '../../data/inventoryItems'
import { useAuth } from '../../context/AuthContext'
import { useCustomerGamificationContext } from '../../context/CustomerGamificationContext'
import { useReservationChallengeContext } from '../../context/ReservationChallengeContext'
import { getPublicCompanyMenuNodes } from '../../services/companyMenu'
import { fetchPublicPromotionsBySlug, type PublicPromotion } from '../../services/publicPromotions'
import { fetchPublicDiscoveryRestaurants } from '../../services/publicDiscovery'
import { companyAllowsWalkInConsumption } from '../../data/companyReservationMode'
import {
  deleteCustomerReview,
  getCustomerReviewsByCompanyIds,
  submitCustomerReview,
  updateCustomerReview,
} from '../../services/companyReviews'
import {
  acceptReservationInvite,
  fetchReservationInvitesState,
  rejectReservationInvite,
} from '../../services/customerReservationInvites'
import type { Reservation } from '../../types'
import type { ReservationInvite } from '../../types/reservationInvites'
import type { CompanyReview } from '../../types/review'
import type { MenuNode } from '../../types/company'
import type { VerifyMinimumSpendResult } from '../../services/minimumSpendApi'
import type { PublicDiscoveryRestaurant } from '../../utils/publicDiscovery'
import type { RegisterConsumptionInput } from '../../services/firestore'
import styles from './CustomerReservationsTab.module.css'

type ReservationTab = 'upcoming' | 'past'
type PageSection = 'reservations' | 'consumption'

type PlanItem =
  | { kind: 'owned'; reservation: Reservation; startTime: Date }
  | { kind: 'guest'; invite: ReservationInvite; reservation: Reservation; startTime: Date }

function reservationFromInvite(invite: ReservationInvite): Reservation {
  const startTime = new Date(invite.startTime)
  return {
    id: `guest-${invite.id}`,
    companyId: invite.companyId,
    tableId: '',
    clientName: invite.fromDisplayName,
    clientEmail: '',
    clientPhone: '',
    pax: invite.pax,
    notes: '',
    startTime,
    endTime: startTime,
    status: invite.reservationStatus,
    cancelToken: '',
    createdAt: new Date(invite.createdAt),
  }
}

function restaurantFromInvite(
  invite: ReservationInvite,
  restaurantById: Record<string, PublicDiscoveryRestaurant>,
): PublicDiscoveryRestaurant {
  return restaurantById[invite.companyId] ?? {
    id: invite.companyId,
    name: invite.companyName,
    slug: invite.companySlug,
    location: '',
    municipality: '',
    country: '',
    latitude: null,
    longitude: null,
    photoUrl: invite.companyPhotoUrl,
    characteristics: [],
    venueTypes: [],
    amenities: [],
    priceRange: '',
    searchText: invite.companyName,
    reviewCount: 0,
    reviewRatingSum: 0,
    reviewAdelinas: 0,
  }
}

function splitPlanItems(owned: Reservation[], accepted: ReservationInvite[]) {
  const now = Date.now()
  const upcoming: PlanItem[] = []
  const past: PlanItem[] = []

  for (const reservation of owned) {
    const item: PlanItem = { kind: 'owned', reservation, startTime: reservation.startTime }
    if (reservation.status !== 'cancelled' && reservation.startTime.getTime() >= now) {
      upcoming.push(item)
    } else {
      past.push(item)
    }
  }

  for (const invite of accepted) {
    const reservation = reservationFromInvite(invite)
    const item: PlanItem = { kind: 'guest', invite, reservation, startTime: reservation.startTime }
    if (invite.reservationStatus !== 'cancelled' && reservation.startTime.getTime() >= now) {
      upcoming.push(item)
    } else {
      past.push(item)
    }
  }

  upcoming.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  past.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
  return { upcoming, past }
}

function CustomerReservationsTab() {
  const { user, profile, refreshProfile, patchProfileGamification } = useAuth()
  const {
    refreshGamificationData,
    state: gamificationState,
    reservations: loadedReservations,
    consumptions,
    restaurants: loadedRestaurants,
    loading: gamificationLoading,
    registerPromotionConsumption,
  } = useCustomerGamificationContext()
  const { challengeReservation, visibleChallenge, error: challengeError } = useReservationChallengeContext()
  const restaurants = loadedRestaurants
  const reservations = loadedReservations
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
  const [pendingInvites, setPendingInvites] = useState<ReservationInvite[]>([])
  const [acceptedInvites, setAcceptedInvites] = useState<ReservationInvite[]>([])
  const [sentInvites, setSentInvites] = useState<ReservationInvite[]>([])
  const [inviteModalReservationId, setInviteModalReservationId] = useState<string | null>(null)
  const [inviteActionId, setInviteActionId] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [section, setSection] = useState<PageSection>('reservations')
  const consumptionsLoading = gamificationLoading
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [catalogRestaurants, setCatalogRestaurants] = useState<PublicDiscoveryRestaurant[]>([])
  const [pickerError, setPickerError] = useState<string | null>(null)
  const [walkInRestaurant, setWalkInRestaurant] = useState<PublicDiscoveryRestaurant | null>(null)
  const [walkInPromotion, setWalkInPromotion] = useState<PublicPromotion | null>(null)
  const [walkInMenuNodes, setWalkInMenuNodes] = useState<MenuNode[]>([])
  const [walkInMenuLoading, setWalkInMenuLoading] = useState(false)
  const resolvedChallengeRef = useRef('')

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
      fetchReservationInvitesState().catch(() => ({
        pending: [] as ReservationInvite[],
        accepted: [] as ReservationInvite[],
        sent: [] as ReservationInvite[],
      })),
      Promise.all(
        [...new Set(
          loadedReservations
            .filter((row) => row.promotionId)
            .map((row) => loadedRestaurants.find((item) => item.id === row.companyId)?.slug)
            .filter((slug): slug is string => Boolean(slug)),
        )].map((slug) => fetchPublicPromotionsBySlug(slug).catch(() => [] as PublicPromotion[])),
      ),
    ])
      .then(async ([inviteData, promotionGroups]) => {
        if (cancelled) {
          return
        }

        setPromotionsById(Object.fromEntries(
          promotionGroups.flat().map((promotion) => [promotion.id, promotion]),
        ))
        setPendingInvites(inviteData.pending)
        setAcceptedInvites(inviteData.accepted)
        setSentInvites(inviteData.sent)
        await loadCustomerReviews(loadedReservations, user.uid)
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [profile, user, loadCustomerReviews, reloadNonce, loadedReservations, loadedRestaurants])

  useEffect(() => {
    if (!pickerOpen) {
      return
    }

    let cancelled = false
    void fetchPublicDiscoveryRestaurants()
      .then((items) => {
        if (!cancelled) {
          setCatalogRestaurants(items)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalogRestaurants([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [pickerOpen])

  useEffect(() => {
    if (visibleChallenge?.status !== 'resolved' || !visibleChallenge.id) {
      return
    }
    if (resolvedChallengeRef.current === visibleChallenge.id) {
      return
    }
    resolvedChallengeRef.current = visibleChallenge.id
    setReloadNonce((value) => value + 1)
    void refreshGamificationData({ silent: true })
  }, [refreshGamificationData, visibleChallenge?.id, visibleChallenge?.status])

  const handleChallenge = useCallback((invite: ReservationInvite) => {
    if (!invite.reservationId.trim()) {
      return
    }
    void challengeReservation(invite.reservationId).catch(() => undefined)
  }, [challengeReservation])

  const restaurantById = useMemo(
    () => Object.fromEntries(restaurants.map((restaurant) => [restaurant.id, restaurant])),
    [restaurants],
  )

  const pickerRestaurants = useMemo(() => {
    const byId = new Map<string, PublicDiscoveryRestaurant>()
    for (const restaurant of [...loadedRestaurants, ...catalogRestaurants]) {
      byId.set(restaurant.id, restaurant)
    }
    const query = pickerQuery.trim().toLowerCase()
    return [...byId.values()]
      .filter((restaurant) => {
        if (!query) {
          return true
        }
        return restaurant.name.toLowerCase().includes(query)
          || restaurant.searchText.toLowerCase().includes(query)
      })
      .sort((left, right) => left.name.localeCompare(right.name, 'es'))
  }, [catalogRestaurants, loadedRestaurants, pickerQuery])

  const { upcoming, past } = useMemo(
    () => splitPlanItems(reservations, acceptedInvites),
    [reservations, acceptedInvites],
  )

  const sentInvitesByReservation = useMemo(() => {
    const grouped: Record<string, ReservationInvite[]> = {}
    for (const invite of sentInvites) {
      const list = grouped[invite.reservationId] ?? []
      list.push(invite)
      grouped[invite.reservationId] = list
    }
    return grouped
  }, [sentInvites])

  const visible = tab === 'upcoming' ? upcoming : past
  const nextItem = upcoming[0]
  const modalInvites = inviteModalReservationId
    ? sentInvitesByReservation[inviteModalReservationId] ?? []
    : []

  const handleInviteDecision = async (inviteId: string, decision: 'accept' | 'reject') => {
    setInviteActionId(inviteId)
    setInviteError(null)
    try {
      const invite = decision === 'accept'
        ? await acceptReservationInvite(inviteId)
        : await rejectReservationInvite(inviteId)
      setPendingInvites((current) => current.filter((item) => item.id !== inviteId))
      if (decision === 'accept') {
        setAcceptedInvites((current) => [invite, ...current.filter((item) => item.id !== invite.id)])
      }
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'No se pudo responder a la invitación.')
    } finally {
      setInviteActionId(null)
    }
  }

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
    void refreshGamificationData({ silent: true })
  }, [loadCustomerReviews, refreshGamificationData, refreshProfile, reservations, user])

  const handleSubmitReview = async (input: CustomerReviewSubmitInput) => {
    if (!user || !profile?.gamification) {
      throw new Error('Debes iniciar sesión como cliente.')
    }

    const nextGamification = await submitCustomerReview(profile.gamification, {
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
    patchProfileGamification({
      inventory: nextGamification.inventory,
      xp: nextGamification.xp,
      adelinas: nextGamification.adelinas,
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
    _reservationId: string,
    _result: VerifyMinimumSpendResult,
  ) => {
    void refreshGamificationData({ silent: true })
    void refreshProfile()
  }

  const handleOpenPicker = () => {
    setPickerError(null)
    setPickerQuery('')
    setPickerOpen(true)
  }

  const handleSelectWalkInRestaurant = async (restaurant: PublicDiscoveryRestaurant) => {
    setPickerError(null)
    if (!companyAllowsWalkInConsumption(restaurant.reservationMode)) {
      setPickerError('Este restaurante solo admite reservas. Reserva mesa para registrar la visita.')
      return
    }

    setWalkInRestaurant(restaurant)
    setPickerOpen(false)
    setWalkInMenuLoading(true)
    setWalkInMenuNodes([])
    setWalkInPromotion(null)

    try {
      const [nodes, promotions] = await Promise.all([
        getPublicCompanyMenuNodes(restaurant.id),
        restaurant.slug
          ? fetchPublicPromotionsBySlug(restaurant.slug).catch(() => [] as PublicPromotion[])
          : Promise.resolve([] as PublicPromotion[]),
      ])
      const ladder = promotions
        .filter((promotion) => promotion.type === 'reservation_ladder')
        .sort((left, right) => (left.requiredReservations ?? 0) - (right.requiredReservations ?? 0))
      setWalkInMenuNodes(nodes)
      setWalkInPromotion(ladder[0] ?? null)
    } catch {
      setWalkInMenuNodes([])
      setWalkInPromotion(null)
    } finally {
      setWalkInMenuLoading(false)
    }
  }

  const handleRegisterWalkIn = async (payload: RegisterConsumptionInput) => {
    if (!walkInRestaurant) {
      return
    }
    await registerPromotionConsumption(walkInRestaurant.id, payload, walkInPromotion?.id)
  }

  const activeReview = reviewReservation
    ? reviewsByCompanyId[reviewReservation.companyId] ?? null
    : null

  if (!profile || loading || gamificationLoading) {
    return <div className={styles.loading}>Cargando reservas y consumo…</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <p className={styles.eyebrow}>Tus planes</p>
        <h1>Reservas y consumo</h1>
        <p className={styles.lead}>
          Reservas por ir o hechas, y el consumo que el restaurante ya validó con PIN.
        </p>
        {challengeError ? <p className={styles.inviteError}>{challengeError}</p> : null}

        <div className={styles.heroStats}>
          <div>
            <strong>{upcoming.length}</strong>
            <span>Por ir</span>
          </div>
          <div>
            <strong>{past.length}</strong>
            <span>Hechas</span>
          </div>
          <div>
            <strong>{consumptions.length}</strong>
            <span>Consumos</span>
          </div>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Reservas o consumo">
        <button
          type="button"
          role="tab"
          aria-selected={section === 'reservations'}
          className={section === 'reservations' ? styles.tabActive : styles.tab}
          onClick={() => setSection('reservations')}
        >
          Reservas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === 'consumption'}
          className={section === 'consumption' ? styles.tabActive : styles.tab}
          onClick={() => setSection('consumption')}
        >
          Consumo
          <span>{consumptions.length}</span>
        </button>
      </div>

      {section === 'reservations' ? (
        <>
      <div className={styles.subTabs} role="tablist" aria-label="Tipo de reservas">
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

      {pendingInvites.length > 0 ? (
        <section className={styles.pendingInvites} aria-label="Invitaciones pendientes">
          <h2>Te han invitado</h2>
          {inviteError ? <p className={styles.inviteError}>{inviteError}</p> : null}
          <ul>
            {pendingInvites.map((invite) => (
              <li key={invite.id} className={styles.pendingInvite}>
                <div>
                  <strong>{invite.companyName}</strong>
                  <span>
                    {invite.fromDisplayName} te invita ·{' '}
                    {new Date(invite.startTime).toLocaleString('es-ES', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className={styles.pendingActions}>
                  <button
                    type="button"
                    className={styles.acceptInvite}
                    disabled={inviteActionId === invite.id}
                    onClick={() => void handleInviteDecision(invite.id, 'accept')}
                  >
                    Aceptar
                  </button>
                  <button
                    type="button"
                    className={styles.rejectInvite}
                    disabled={inviteActionId === invite.id}
                    onClick={() => void handleInviteDecision(invite.id, 'reject')}
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
          {visible.map((item) => {
            if (item.kind === 'guest') {
              return (
                <CustomerReservationCard
                  key={item.reservation.id}
                  reservation={item.reservation}
                  restaurant={restaurantFromInvite(item.invite, restaurantById)}
                  bucket={tab}
                  variant="guest"
                  hostName={item.invite.fromDisplayName}
                  onChallenge={tab === 'upcoming' ? () => handleChallenge(item.invite) : undefined}
                />
              )
            }

            return (
              <CustomerReservationCard
                key={item.reservation.id}
                reservation={item.reservation}
                restaurant={restaurantById[item.reservation.companyId]}
                promotion={
                  item.reservation.promotionId
                    ? promotionsById[item.reservation.promotionId] ?? null
                    : null
                }
                bucket={tab}
                isNext={tab === 'upcoming' && item.reservation.id === nextItem?.reservation.id && nextItem.kind === 'owned'}
                invites={sentInvitesByReservation[item.reservation.id] ?? []}
                onOpenInvites={() => setInviteModalReservationId(item.reservation.id)}
                onVerifyMinimumSpend={(reservation) => {
                  if (canCustomerVerifyMinimumSpend(reservation)) {
                    setVerifyReservation(reservation)
                  }
                }}
                onLeaveReview={setReviewReservation}
                hasReviewForRestaurant={Boolean(reviewsByCompanyId[item.reservation.companyId])}
              />
            )
          })}
        </div>
      )}
        </>
      ) : (
        <section className={styles.consumptionSection} aria-label="Consumo verificado">
          <div className={styles.registerBar}>
            <div>
              <h2>Historial verificado</h2>
              <p>Solo entra lo que el restaurante valida con su PIN. No puedes apuntar un ticket a mano.</p>
            </div>
            <button type="button" className={styles.registerCta} onClick={handleOpenPicker}>
              Registrar consumo
            </button>
          </div>

          {pickerOpen ? (
            <div className={styles.picker}>
              <label className={styles.pickerSearch}>
                <span>Restaurante</span>
                <input
                  type="search"
                  value={pickerQuery}
                  onChange={(event) => setPickerQuery(event.target.value)}
                  placeholder="Busca un local publicado…"
                />
              </label>
              {pickerError ? <p className={styles.inviteError}>{pickerError}</p> : null}
              <ul className={styles.pickerList}>
                {pickerRestaurants.slice(0, 12).map((restaurant) => (
                  <li key={restaurant.id}>
                    <button
                      type="button"
                      className={styles.pickerRow}
                      onClick={() => void handleSelectWalkInRestaurant(restaurant)}
                    >
                      <strong>{restaurant.name}</strong>
                      <span>{restaurant.municipality || restaurant.location}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {pickerRestaurants.length === 0 ? (
                <p className={styles.pickerEmpty}>No hay locales con ese nombre.</p>
              ) : null}
              <button type="button" className={styles.pickerCancel} onClick={() => setPickerOpen(false)}>
                Cancelar
              </button>
            </div>
          ) : null}

          {consumptionsLoading ? (
            <p className={styles.consumptionStatus}>Cargando consumo…</p>
          ) : consumptions.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon} aria-hidden="true">🧾</div>
              <h2>Aún no hay consumo verificado</h2>
              <p>Cuando el restaurante valide tu visita con PIN, aparecerá aquí.</p>
            </div>
          ) : (
            <div className={styles.list}>
              {consumptions.map((consumption) => (
                <CustomerConsumptionCard key={consumption.id} consumption={consumption} />
              ))}
            </div>
          )}
        </section>
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
        reviewBoostPending={inventoryQuantity(gamificationState.inventory, REVIEW_BOOST_ITEM_ID) > 0}
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
        tokenCover={
          verifyReservation
            ? pendingTokenSpendForCompany(gamificationState.pendingTokenSpend, verifyReservation.companyId)
            : null
        }
        onClose={() => setVerifyReservation(null)}
        onVerified={handleVerifiedMinimumSpend}
      />

      <ReservationInvitesModal
        open={Boolean(inviteModalReservationId)}
        invites={modalInvites}
        onClose={() => setInviteModalReservationId(null)}
      />

      <PromoVisitCompleteModal
        open={Boolean(walkInRestaurant)}
        companyName={walkInRestaurant?.name ?? ''}
        path="consume"
        promotion={walkInPromotion}
        menuNodes={walkInMenuNodes}
        menuLoading={walkInMenuLoading}
        onClose={() => {
          setWalkInRestaurant(null)
          setWalkInPromotion(null)
          setWalkInMenuNodes([])
        }}
        onReserve={() => {
          setWalkInRestaurant(null)
        }}
        onRegisterConsumption={handleRegisterWalkIn}
      />
    </div>
  )
}

export default CustomerReservationsTab

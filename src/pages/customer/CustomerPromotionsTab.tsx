import { useEffect, useMemo, useState } from 'react'
import PromotionClaimFlowModal from '../../components/promotions/PromotionClaimFlowModal'
import PromotionLadderMapModal, {
  type LadderRestaurantGroup,
} from '../../components/promotions/PromotionLadderMapModal'
import LadderRestaurantPromoCard from '../../components/promotions/LadderRestaurantPromoCard'
import PromotionOfferCard from '../../components/promotions/PromotionOfferCard'
import MinimumSpendVerificationModal from '../../components/reservations/MinimumSpendVerificationModal'
import { useAuth } from '../../context/AuthContext'
import { useCustomerGamificationContext } from '../../context/CustomerGamificationContext'
import ApplyMesaTokenModal from '../../components/ApplyMesaTokenModal'
import { isCustomerPromoLocked } from '../../data/cancellationPenalties'
import { getPublicCompanyMenuNodes } from '../../services/companyMenu'
import { getCustomerReservations } from '../../services/firestore'
import { fetchPublicPromotions, type PublicPromotion } from '../../services/publicPromotions'
import type { ClaimedPromotionRecord } from '../../types/gamification'
import type { Reservation } from '../../types'
import type { MenuNode } from '../../types/company'
import type { VerifyMinimumSpendResult } from '../../services/minimumSpendApi'
import { formatCentsAsEuros } from '../../utils/minimumSpendVerification'
import {
  matchingReservationTokens,
  pendingTokenSpendForCompany,
  promoMinimumCents,
} from '../../data/inventoryItems'
import {
  findTimeLimitedReservationForStrip,
  findReservationForActivasFeed,
  getTimeLimitedPromotionPresentation,
  isTimeLimitedPromotionVisitComplete,
} from '../../utils/reservationPromotionEligibility'
import {
  DEMO_PREVIEW_COORDS,
  mergeDemoPromotions,
} from '../../data/demoNearbyPromotions'
import { haversineDistanceKm, PROMO_NEARBY_MAX_KM } from '../../utils/geo'
import { requestUserLocation } from '../../utils/requestUserLocation'
import {
  getActiveLadderPromotionSummary,
  isLadderRestaurantActive,
} from '../../utils/promotionLadderStatus'
import {
  isActiveStripPromotion,
  comparePromotionPriority,
  buildCompanyLadderPromotionsMap,
  persistClaimedPromotionId,
  sortCompanyLadderPromotions,
  type CompanyLadderRuntime,
} from '../../utils/promotionReservationProgress'
import styles from './CustomerPromotionsTab.module.css'

type PromoView = 'activas' | 'reclamadas'

function canUsePromoTokenOnGroup(
  group: LadderRestaurantGroup,
  inventory: Record<string, number> | undefined,
  activeByCompany: Record<string, string>,
  locked: boolean,
): boolean {
  if (locked) {
    return false
  }

  const ladder = sortCompanyLadderPromotions(group.ladderPromotions)
  const active = ladder.find((promotion) => promotion.id === activeByCompany[group.companyId]) ?? ladder[0]
  if (!active) {
    return false
  }

  return matchingReservationTokens(
    inventory,
    promoMinimumCents(active.minimumSpendCents, active.minimumSpendEnabled),
  ).length > 0
}

type PromoEntry = {
  promotion: PublicPromotion
  distanceKm: number | null
}

function buildNearbyLadderRestaurantGroups(
  nearbyPromotions: PromoEntry[],
  companyLadderMap: Map<string, PublicPromotion[]>,
): LadderRestaurantGroup[] {
  const groups = new Map<string, LadderRestaurantGroup>()

  for (const { promotion, distanceKm } of nearbyPromotions) {
    if (promotion.type !== 'reservation_ladder') {
      continue
    }

    const ladderPromotions = sortCompanyLadderPromotions(
      companyLadderMap.get(promotion.companyId) ?? [],
    )

    if (ladderPromotions.length === 0) {
      continue
    }

    const existing = groups.get(promotion.companyId)
    if (existing) {
      if (
        distanceKm != null
        && (existing.distanceKm == null || distanceKm < existing.distanceKm)
      ) {
        existing.distanceKm = distanceKm
      }
      continue
    }

    groups.set(promotion.companyId, {
      companyId: promotion.companyId,
      companyName: promotion.companyName,
      companySlug: promotion.companySlug,
      companyPhotoUrl: promotion.companyPhotoUrl,
      distanceKm,
      ladderPromotions,
    })
  }

  return [...groups.values()]
}

function compareLadderRestaurantPriority(
  left: LadderRestaurantGroup,
  right: LadderRestaurantGroup,
  confirmedCounts: Record<string, number>,
  pendingCounts: Record<string, number>,
  ladderRuntime: CompanyLadderRuntime,
  claimedPromotions: ClaimedPromotionRecord[],
): number {
  const leftSummary = getActiveLadderPromotionSummary(
    left.ladderPromotions,
    confirmedCounts,
    pendingCounts,
    ladderRuntime,
    claimedPromotions,
  )
  const rightSummary = getActiveLadderPromotionSummary(
    right.ladderPromotions,
    confirmedCounts,
    pendingCounts,
    ladderRuntime,
    claimedPromotions,
  )

  const leftPromotion = leftSummary?.promotion ?? left.ladderPromotions[0]
  const rightPromotion = rightSummary?.promotion ?? right.ladderPromotions[0]

  return comparePromotionPriority(
    leftPromotion,
    rightPromotion,
    confirmedCounts,
    pendingCounts,
    ladderRuntime,
    left.ladderPromotions,
    right.ladderPromotions,
    left.distanceKm,
    right.distanceKm,
  )
}

function promotionFromClaim(claim: ClaimedPromotionRecord): PublicPromotion {
  const promotionType = claim.promotionType ?? 'reservation_ladder'

  return {
    id: claim.promotionId,
    companyId: claim.companyId,
    companyName: claim.companyName,
    companySlug: claim.companySlug,
    companyPhotoUrl: claim.companyPhotoUrl ?? '',
    companyLatitude: null,
    companyLongitude: null,
    type: promotionType,
    title: claim.title,
    description: claim.description ?? '',
    photoUrl: claim.photoUrl ?? claim.companyPhotoUrl ?? '',
    offer: promotionType === 'reservation_ladder'
      ? {
          kind: 'custom',
          bundleGet: null,
          bundlePay: null,
          discountPercent: null,
          fixedPriceCents: null,
          customLabel: claim.prizeLabel,
        }
      : null,
    productRefs: [],
    requiredReservations: null,
    activeFromTime: '',
    activeToTime: '',
    arrivalWindowMinutes: null,
    maxRedemptions: null,
    currentRedemptions: 0,
    detail: claim.detail ?? '',
    highlight: claim.prizeLabel,
  }
}

function RegularPromoCard({
  entry,
  index,
  claimed = false,
  claimedAt,
  reservation = null,
  compact = false,
  onVerify,
}: {
  entry: PromoEntry
  index: number
  claimed?: boolean
  claimedAt?: string
  reservation?: Reservation | null
  compact?: boolean
  onVerify?: (reservation: Reservation) => void
}) {
  const reservationStatusLine = entry.promotion.type === 'time_limited' && reservation
    ? getTimeLimitedPromotionPresentation(reservation, {
      type: entry.promotion.type,
      title: entry.promotion.title,
    })
    : null

  return (
    <PromotionOfferCard
      promotion={entry.promotion}
      index={index}
      distanceKm={entry.distanceKm}
      claimed={claimed}
      claimedAt={claimedAt}
      reservationStatusLine={reservationStatusLine}
      linkedReservation={reservation}
      onVerify={reservation && onVerify ? () => onVerify(reservation) : undefined}
      className={compact ? styles.compactPromoCard : ''}
    />
  )
}

function CustomerPromotionsTab() {
  const { user, profile, refreshProfile } = useAuth()
  const {
    loading: gamificationLoading,
    state: gamificationState,
    verifiedReservationCounts,
    pendingReservationCounts,
    ladderRuntime,
    claimedPromotions,
    claimPromotion,
    claimTimeLimitedPromotion,
    applyReservationToken,
    refreshGamificationData,
  } = useCustomerGamificationContext()

  const [promotions, setPromotions] = useState<PublicPromotion[]>([])
  const [view, setView] = useState<PromoView>('activas')
  const [claimFlowPromotion, setClaimFlowPromotion] = useState<PublicPromotion | null>(null)
  const [ladderMapGroup, setLadderMapGroup] = useState<LadderRestaurantGroup | null>(null)
  const [loadingPromos, setLoadingPromos] = useState(true)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [usingDemoLocation, setUsingDemoLocation] = useState(false)
  const [customerReservations, setCustomerReservations] = useState<Reservation[]>([])
  const [verifyReservation, setVerifyReservation] = useState<Reservation | null>(null)
  const [verifyMenuNodes, setVerifyMenuNodes] = useState<MenuNode[]>([])
  const [verifyMenuLoading, setVerifyMenuLoading] = useState(false)
  const [tokenGroup, setTokenGroup] = useState<LadderRestaurantGroup | null>(null)
  const [tokenApplying, setTokenApplying] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [tokenNotice, setTokenNotice] = useState<string | null>(null)

  const userClaimKey = profile?.email ?? user?.uid ?? ''
  const promoLocked = isCustomerPromoLocked(profile)

  const claimedReservationIds = useMemo(
    () => new Set(
      claimedPromotions
        .map((claim) => claim.reservationId)
        .filter((reservationId): reservationId is string => Boolean(reservationId)),
    ),
    [claimedPromotions],
  )

  useEffect(() => {
    if (!profile?.email) {
      setCustomerReservations([])
      return
    }

    let cancelled = false

    void getCustomerReservations(profile.email)
      .then((rows) => {
        if (!cancelled) {
          setCustomerReservations(rows)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCustomerReservations([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [profile?.email])

  useEffect(() => {
    if (!user || !profile || promotions.length === 0 || customerReservations.length === 0) {
      return
    }

    for (const reservation of customerReservations) {
      if (!reservation.promotionId || !isTimeLimitedPromotionVisitComplete(reservation)) {
        continue
      }

      if (claimedReservationIds.has(reservation.id)) {
        continue
      }

      const promotion = promotions.find((row) => row.id === reservation.promotionId)
      if (!promotion || promotion.type !== 'time_limited') {
        continue
      }

      void claimTimeLimitedPromotion(promotion, reservation.id)
    }
  }, [
    user,
    profile,
    promotions,
    customerReservations,
    claimedReservationIds,
    claimTimeLimitedPromotion,
  ])

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
    void refreshGamificationData()
  }, [refreshGamificationData])

  useEffect(() => {
    const handleFocus = () => {
      void refreshGamificationData()
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [refreshGamificationData])

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      fetchPublicPromotions().catch(() => []),
      requestUserLocation().catch(() => null),
    ])
      .then(([promoData, location]) => {
        if (cancelled) {
          return
        }

        setPromotions(import.meta.env.DEV ? mergeDemoPromotions(promoData) : promoData)

        if (location?.coords) {
          setCoords(location.coords)
          setUsingDemoLocation(false)
        } else if (import.meta.env.DEV) {
          setCoords(DEMO_PREVIEW_COORDS)
          setUsingDemoLocation(true)
        } else {
          setCoords(null)
          setUsingDemoLocation(false)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPromos(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const nearbyPromotions = useMemo(() => {
    const withDistance = promotions.map((promotion) => {
      let distanceKm: number | null = null

      if (coords && promotion.companyLatitude != null && promotion.companyLongitude != null) {
        distanceKm = haversineDistanceKm(coords, {
          lat: promotion.companyLatitude,
          lng: promotion.companyLongitude,
        })
      }

      return { promotion, distanceKm }
    })

    const inRange = coords
      ? withDistance.filter(
          ({ distanceKm }) => distanceKm != null && distanceKm <= PROMO_NEARBY_MAX_KM,
        )
      : []

    inRange.sort((left, right) => (left.distanceKm ?? 0) - (right.distanceKm ?? 0))

    return inRange
  }, [promotions, coords])

  const companyLadderMap = useMemo(
    () => buildCompanyLadderPromotionsMap(promotions),
    [promotions],
  )

  const ladderRestaurantGroups = useMemo(
    () => buildNearbyLadderRestaurantGroups(nearbyPromotions, companyLadderMap),
    [nearbyPromotions, companyLadderMap],
  )

  const activeLadderRestaurants = useMemo(() => {
    const active = ladderRestaurantGroups.filter((group) =>
      isLadderRestaurantActive(
        group.ladderPromotions,
        verifiedReservationCounts,
        pendingReservationCounts,
        ladderRuntime,
        claimedPromotions,
      ),
    )

    active.sort((left, right) =>
      compareLadderRestaurantPriority(
        left,
        right,
        verifiedReservationCounts,
        pendingReservationCounts,
        ladderRuntime,
        claimedPromotions,
      ),
    )

    return active
  }, [
    ladderRestaurantGroups,
    verifiedReservationCounts,
    pendingReservationCounts,
    ladderRuntime,
    claimedPromotions,
  ])

  const idleLadderRestaurants = useMemo(() => {
    const activeIds = new Set(activeLadderRestaurants.map((group) => group.companyId))

    return ladderRestaurantGroups
      .filter((group) => !activeIds.has(group.companyId))
      .sort((left, right) => (left.distanceKm ?? 0) - (right.distanceKm ?? 0))
  }, [ladderRestaurantGroups, activeLadderRestaurants])

  const regularPromotions = useMemo(
    () =>
      nearbyPromotions.filter(({ promotion }) => {
        if (promotion.type === 'reservation_ladder') {
          return false
        }

        const companyLadder = companyLadderMap.get(promotion.companyId) ?? []

        return !isActiveStripPromotion(
          promotion,
          verifiedReservationCounts,
          pendingReservationCounts,
          ladderRuntime,
          companyLadder,
        )
      }),
    [
      nearbyPromotions,
      verifiedReservationCounts,
      pendingReservationCounts,
      ladderRuntime,
      companyLadderMap,
    ],
  )

  const inProgressTimeLimitedPromotions = useMemo(
    () =>
      regularPromotions.filter(
        ({ promotion }) =>
          promotion.type === 'time_limited'
          && findTimeLimitedReservationForStrip(customerReservations, promotion.id) != null,
      ),
    [regularPromotions, customerReservations],
  )

  const idleRegularPromotions = useMemo(() => {
    const inProgressIds = new Set(inProgressTimeLimitedPromotions.map((entry) => entry.promotion.id))

    return regularPromotions.filter((entry) => !inProgressIds.has(entry.promotion.id))
  }, [regularPromotions, inProgressTimeLimitedPromotions])

  const sortedClaims = useMemo(
    () =>
      [...claimedPromotions].sort(
        (left, right) => new Date(right.claimedAt).getTime() - new Date(left.claimedAt).getTime(),
      ),
    [claimedPromotions],
  )

  const handleClaimRequest = (promotion: PublicPromotion) => {
    if (promoLocked) {
      return
    }
    setClaimFlowPromotion(promotion)
  }

  const handleClaimConfirmed = async (promotion: PublicPromotion) => {
    if (userClaimKey) {
      persistClaimedPromotionId(userClaimKey, promotion.id)
    }

    const companyLadder = companyLadderMap.get(promotion.companyId) ?? [promotion]
    await claimPromotion(promotion, companyLadder)
    setView('reclamadas')
    setLadderMapGroup(null)
  }

  const handleClaimFlowClose = () => {
    setClaimFlowPromotion(null)
  }

  const handleApplyToken = async (itemId: string) => {
    if (!tokenGroup) {
      return
    }
    setTokenApplying(true)
    setTokenError(null)
    setTokenNotice(null)
    try {
      const result = await applyReservationToken(itemId, tokenGroup.companyId)
      if (result.remainderCents > 0) {
        setTokenNotice(
          `Carta usada: cubre ${formatCentsAsEuros(result.coverCents)} y faltan ${formatCentsAsEuros(result.remainderCents)}. Verifícalo con el restaurante en una reserva confirmada.`,
        )
      } else {
        setTokenGroup(null)
      }
    } catch (error) {
      setTokenError(error instanceof Error ? error.message : 'No se pudo usar la carta.')
    } finally {
      setTokenApplying(false)
    }
  }

  const openTokenModal = (group: LadderRestaurantGroup) => {
    setTokenNotice(null)
    setTokenError(null)
    setTokenGroup(group)
  }

  const handleVerifiedMinimumSpend = (
    reservationId: string,
    result: VerifyMinimumSpendResult,
  ) => {
    setCustomerReservations((current) =>
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

  const verifyRestaurantName = verifyReservation
    ? promotions.find((promotion) => promotion.companyId === verifyReservation.companyId)?.companyName
      ?? 'Restaurante'
    : ''

  const loading = loadingPromos || gamificationLoading

  if (loading && !claimFlowPromotion && !ladderMapGroup) {
    return <div className={styles.loading}>Cargando promociones…</div>
  }

  const hasActiveContent = activeLadderRestaurants.length > 0
    || inProgressTimeLimitedPromotions.length > 0
    || idleLadderRestaurants.length > 0
    || idleRegularPromotions.length > 0

  return (
    <div className={styles.page}>
      <div className={styles.viewTabs} role="tablist" aria-label="Promociones">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'activas'}
          className={view === 'activas' ? styles.viewTabActive : styles.viewTab}
          onClick={() => setView('activas')}
        >
          Activas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'reclamadas'}
          className={view === 'reclamadas' ? styles.viewTabActive : styles.viewTab}
          onClick={() => setView('reclamadas')}
        >
          Reclamadas
          {sortedClaims.length > 0 ? <span className={styles.viewTabCount}>{sortedClaims.length}</span> : null}
        </button>
      </div>

      {promoLocked ? (
        <div className={styles.lockBanner} role="status">
          <strong>Promociones bloqueadas</strong>
          <p>
            Has cancelado 5 reservas o más. No puedes reservar con promoción ni canjear premios.
            Las reservas normales siguen disponibles.
          </p>
        </div>
      ) : null}

      {view === 'reclamadas' ? (
        sortedClaims.length === 0 ? (
          <div className={styles.empty}>
            <p>Aún no has reclamado ninguna oferta.</p>
            <p className={styles.emptyHint}>Completa las reservas necesarias y pulsa Reclamar.</p>
          </div>
        ) : (
          <div className={styles.promoFeed}>
            {sortedClaims.map((claim, index) => {
              const livePromotion = promotions.find((promotion) => promotion.id === claim.promotionId)
              const entry: PromoEntry = {
                promotion: livePromotion ?? promotionFromClaim(claim),
                distanceKm: null,
              }

              return (
                <RegularPromoCard
                  key={`${claim.promotionId}-${claim.claimedAt}`}
                  entry={entry}
                  index={index}
                  claimed
                  claimedAt={claim.claimedAt}
                />
              )
            })}
          </div>
        )
      ) : (
        <>
          {usingDemoLocation ? (
            <p className={styles.demoLocationHint}>
              Sin GPS — mostrando promos de ejemplo en Logroño.
            </p>
          ) : null}
          {!coords ? (
            <div className={styles.locationPrompt}>
              <span className={styles.locationIcon} aria-hidden="true">📍</span>
              <h2>Activa tu ubicación</h2>
              <p>Solo te mostramos promos de restaurantes cerca de ti — nada de ofertas en otra ciudad.</p>
            </div>
          ) : !hasActiveContent ? (
            <div className={styles.empty}>
              <p>No hay ofertas cerca tuyo.</p>
            </div>
          ) : (
            <>
              {(activeLadderRestaurants.length > 0 || inProgressTimeLimitedPromotions.length > 0) ? (
                <section className={styles.activeStrip} aria-label="Promociones en curso">
                  <div className={styles.activeScroller}>
                    {activeLadderRestaurants.map((group) => (
                      <LadderRestaurantPromoCard
                        key={group.companyId}
                        group={group}
                        variant="compact"
                        confirmedCounts={verifiedReservationCounts}
                        pendingCounts={pendingReservationCounts}
                        ladderRuntime={ladderRuntime}
                        claimedPromotions={claimedPromotions}
                        onOpenMap={setLadderMapGroup}
                      onUseToken={
                        canUsePromoTokenOnGroup(
                          group,
                          gamificationState.inventory,
                          ladderRuntime.activeLadderPromotionByCompany,
                          promoLocked,
                        )
                          ? openTokenModal
                          : undefined
                      }
                      />
                    ))}
                    {inProgressTimeLimitedPromotions.map((entry, index) => (
                      <RegularPromoCard
                        key={entry.promotion.id}
                        entry={entry}
                        index={index}
                        compact
                        reservation={findTimeLimitedReservationForStrip(
                          customerReservations,
                          entry.promotion.id,
                        )}
                        onVerify={setVerifyReservation}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {((activeLadderRestaurants.length > 0 || inProgressTimeLimitedPromotions.length > 0)
                && (idleLadderRestaurants.length > 0 || idleRegularPromotions.length > 0))
                || (idleLadderRestaurants.length > 0 && idleRegularPromotions.length > 0) ? (
                  <div className={styles.sectionDivider} aria-hidden="true" />
                ) : null}

              {idleLadderRestaurants.length > 0 || idleRegularPromotions.length > 0 ? (
                <div className={styles.promoFeed}>
                  {idleLadderRestaurants.map((group) => (
                    <LadderRestaurantPromoCard
                      key={group.companyId}
                      group={group}
                      variant="full"
                      confirmedCounts={verifiedReservationCounts}
                      pendingCounts={pendingReservationCounts}
                      ladderRuntime={ladderRuntime}
                      claimedPromotions={claimedPromotions}
                      onOpenMap={setLadderMapGroup}
                      onUseToken={
                        canUsePromoTokenOnGroup(
                          group,
                          gamificationState.inventory,
                          ladderRuntime.activeLadderPromotionByCompany,
                          promoLocked,
                        )
                          ? openTokenModal
                          : undefined
                      }
                    />
                  ))}
                  {idleRegularPromotions.map((entry, index) => (
                    <RegularPromoCard
                      key={entry.promotion.id}
                      entry={entry}
                      index={index}
                      reservation={findReservationForActivasFeed(
                        customerReservations,
                        entry.promotion.id,
                        claimedReservationIds,
                      )}
                      onVerify={setVerifyReservation}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </>
      )}

      <ApplyMesaTokenModal
        open={Boolean(tokenGroup)}
        companyName={tokenGroup?.companyName ?? ''}
        companyId={tokenGroup?.companyId ?? ''}
        ladderPromotions={tokenGroup?.ladderPromotions ?? []}
        activePromotionId={
          tokenGroup
            ? ladderRuntime.activeLadderPromotionByCompany[tokenGroup.companyId] ?? null
            : null
        }
        inventory={gamificationState.inventory}
        applying={tokenApplying}
        error={tokenError}
        notice={tokenNotice}
        onClose={() => {
          setTokenGroup(null)
          setTokenError(null)
          setTokenNotice(null)
        }}
        onApply={(itemId) => void handleApplyToken(itemId)}
      />

      <PromotionLadderMapModal
        group={ladderMapGroup}
        confirmedCounts={verifiedReservationCounts}
        pendingCounts={pendingReservationCounts}
        ladderRuntime={ladderRuntime}
        claimedPromotions={claimedPromotions}
        onClose={() => setLadderMapGroup(null)}
        onClaim={handleClaimRequest}
      />

      <PromotionClaimFlowModal
        promotion={claimFlowPromotion}
        onClose={handleClaimFlowClose}
        onClaimed={handleClaimConfirmed}
      />

      <MinimumSpendVerificationModal
        reservation={verifyReservation}
        restaurantName={verifyRestaurantName}
        promotion={
          verifyReservation?.promotionId
            ? promotions.find((promotion) => promotion.id === verifyReservation.promotionId) ?? null
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
    </div>
  )
}

export default CustomerPromotionsTab

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PromotionClaimFlowModal from '../../components/promotions/PromotionClaimFlowModal'
import PromotionLadderMapModal, {
  type LadderRestaurantGroup,
} from '../../components/promotions/PromotionLadderMapModal'
import LadderRestaurantPromoCard from '../../components/promotions/LadderRestaurantPromoCard'
import PromotionDetailView from '../../components/promotions/PromotionDetailView'
import {
  LadderMapCard,
  PromoAppCard,
  PromoSidePanel,
  RestaurantAvatar,
  RestaurantPromosRow,
  TreasureMapsCard,
} from '../../components/promotions/PromoAppCards'
import {
  groupLadderRestaurants,
  groupPromotionsByRestaurant,
  isLadderStep,
  promotionDistanceKm,
  type RestaurantPromoGroup,
} from '../../components/promotions/promoAppDisplay'
import MinimumSpendVerificationModal from '../../components/reservations/MinimumSpendVerificationModal'
import { useAuth } from '../../context/AuthContext'
import { useCustomerProductTourOptional } from '../../context/CustomerProductTourContext'
import { useCustomerGamificationContext } from '../../context/CustomerGamificationContext'
import ApplyMesaTokenModal from '../../components/ApplyMesaTokenModal'
import { isCustomerPromoLocked } from '../../data/cancellationPenalties'
import { getPublicCompanyMenuNodes } from '../../services/companyMenu'
import { fetchPublicPromotions, type PublicPromotion } from '../../services/publicPromotions'
import type { ClaimedPromotionRecord } from '../../types/gamification'
import type { Reservation } from '../../types'
import type { MenuNode } from '../../types/company'
import type { VerifyMinimumSpendResult } from '../../services/minimumSpendApi'
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
import { DEMO_PREVIEW_COORDS, mergeDemoPromotions } from '../../data/demoNearbyPromotions'
import { requestUserLocation } from '../../utils/requestUserLocation'
import {
  getActiveLadderPromotionSummary,
  isLadderRestaurantActive,
} from '../../utils/promotionLadderStatus'
import {
  comparePromotionPriority,
  buildCompanyLadderPromotionsMap,
  persistClaimedPromotionId,
  sortCompanyLadderPromotions,
  type CompanyLadderRuntime,
} from '../../utils/promotionReservationProgress'
import { buildPromotionBookingHref } from '../../utils/promotionBooking'
import { loadPromotionAvailability, usePromotionAvailability } from '../../services/promotionAvailability'
import {
  isSavedPromotionsMigrated,
  markSavedPromotionsMigrated,
  mergeSavedPromotionIds,
  persistSavedPromotionIds,
  readSavedPromotionIds,
  writeLocalSavedPromotionIds,
} from '../../utils/savedPromotions'
import { useIncrementalReveal } from '../../hooks/useIncrementalReveal'
import { trackAppEvent } from '../../utils/appEvents'
import panelStyles from '../../components/promotions/PromoApp.module.css'
import styles from './CustomerPromotionsTab.module.css'

type PromoView = 'activas' | 'guardadas' | 'reclamadas'

const VIEW_TABS: Array<{ id: PromoView; label: string }> = [
  { id: 'activas', label: 'Activas' },
  { id: 'guardadas', label: 'Guardadas' },
  { id: 'reclamadas', label: 'Reclamadas' },
]

type Coords = { lat: number; lng: number }

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

function compareLadderRestaurantPriority(
  left: LadderRestaurantGroup,
  right: LadderRestaurantGroup,
  confirmedCounts: Record<string, number>,
  pendingCounts: Record<string, number>,
  ladderRuntime: CompanyLadderRuntime,
  claimedPromotions: ClaimedPromotionRecord[],
): number {
  const leftPromotion = getActiveLadderPromotionSummary(
    left.ladderPromotions,
    confirmedCounts,
    pendingCounts,
    ladderRuntime,
    claimedPromotions,
  )?.promotion ?? left.ladderPromotions[0]
  const rightPromotion = getActiveLadderPromotionSummary(
    right.ladderPromotions,
    confirmedCounts,
    pendingCounts,
    ladderRuntime,
    claimedPromotions,
  )?.promotion ?? right.ladderPromotions[0]

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

function PanelTop({
  eyebrow,
  title,
  onBack,
  photo,
}: {
  eyebrow: string
  title: string
  onBack: () => void
  photo?: { name: string; url: string }
}) {
  return (
    <header className={panelStyles.panelTop}>
      <button type="button" className={panelStyles.backChip} onClick={onBack} aria-label="Volver">
        ←
      </button>
      {photo ? <RestaurantAvatar name={photo.name} photoUrl={photo.url} /> : null}
      <div className={panelStyles.panelTopCopy}>
        <p className={panelStyles.panelEyebrow}>{eyebrow}</p>
        <h2 className={panelStyles.panelTitle}>{title}</h2>
      </div>
    </header>
  )
}

function CustomerPromotionsTab() {
  const { user, profile, refreshProfile } = useAuth()
  const productTour = useCustomerProductTourOptional()
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
    registerPromotionConsumption,
    refreshGamificationData,
    reservations: customerReservations,
  } = useCustomerGamificationContext()

  const [searchParams, setSearchParams] = useSearchParams()
  const [promotions, setPromotions] = useState<PublicPromotion[]>([])
  const [claimFlowPromotion, setClaimFlowPromotion] = useState<PublicPromotion | null>(null)
  const [ladderMapGroup, setLadderMapGroup] = useState<LadderRestaurantGroup | null>(null)
  const [loadingPromos, setLoadingPromos] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [usingDemoLocation, setUsingDemoLocation] = useState(false)
  const [locationRequesting, setLocationRequesting] = useState(false)
  const [locationDenied, setLocationDenied] = useState(false)
  const [verifyReservation, setVerifyReservation] = useState<Reservation | null>(null)
  const [verifyMenuNodes, setVerifyMenuNodes] = useState<MenuNode[]>([])
  const [verifyMenuLoading, setVerifyMenuLoading] = useState(false)
  const [tokenGroup, setTokenGroup] = useState<LadderRestaurantGroup | null>(null)
  const [tokenApplying, setTokenApplying] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [tokenNotice, setTokenNotice] = useState<string | null>(null)
  const [savedPromoIds, setSavedPromoIds] = useState<Set<string>>(() => new Set())

  const [now, setNow] = useState(() => new Date())
  const navigate = useNavigate()
  const userClaimKey = profile?.email ?? user?.uid ?? ''
  const promoLocked = isCustomerPromoLocked(profile)

  // La navegación interna vive en la URL para que "atrás" del navegador funcione.
  const tabParam = searchParams.get('lista')
  const view: PromoView = tabParam === 'guardadas' || tabParam === 'reclamadas' ? tabParam : 'activas'
  const showMaps = searchParams.get('ver') === 'mapas'
  const restaurantSlug = searchParams.get('local')
  const promotionId = searchParams.get('promo')

  const openParams = (next: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(next)) {
      if (value == null) params.delete(key)
      else params.set(key, value)
    }
    setSearchParams(params)
  }

  const goBack = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1)
      return
    }
    openParams({ ver: null, local: null, promo: null })
  }

  const setView = (next: PromoView) => {
    openParams({ lista: next === 'activas' ? null : next, ver: null, local: null, promo: null })
    window.scrollTo({ top: 0 })
  }

  useEffect(() => {
    const step = productTour?.stepId
    if (step !== 'promos-types' && step !== 'promos-feed') return
    setSearchParams(new URLSearchParams(), { replace: true })
    if (!coords) {
      setCoords(DEMO_PREVIEW_COORDS)
      setUsingDemoLocation(true)
    }
    // Solo al entrar en un paso del tour.
  }, [productTour?.stepId])

  // Las guardadas viven en el perfil (se ven igual en la app). Si quedaban algunas
  // solo en este navegador, se suben una vez.
  const remoteSavedKey = (profile?.savedPromotionIds ?? []).join('|')
  useEffect(() => {
    const remote = new Set(profile?.savedPromotionIds ?? [])
    if (!user?.uid || isSavedPromotionsMigrated(userClaimKey)) {
      setSavedPromoIds(remote)
      return
    }
    const merged = mergeSavedPromotionIds(profile?.savedPromotionIds, readSavedPromotionIds(userClaimKey))
    setSavedPromoIds(merged)
    void persistSavedPromotionIds(user.uid, merged)
      .then(() => markSavedPromotionsMigrated(userClaimKey))
      .catch(() => undefined)
  }, [userClaimKey, remoteSavedKey, user?.uid])

  // Los candados por horario cambian con la hora: se recalculan cada minuto.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const claimedReservationIds = useMemo(
    () => new Set(
      claimedPromotions
        .map((claim) => claim.reservationId)
        .filter((reservationId): reservationId is string => Boolean(reservationId)),
    ),
    [claimedPromotions],
  )

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
    const handleFocus = () => {
      // Volver a la pestaña no recarga todo si se cargó hace menos de 3 minutos.
      void refreshGamificationData({ silent: true, maxAgeMs: 3 * 60_000 })
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [refreshGamificationData])

  useEffect(() => {
    let cancelled = false
    setLoadError(false)

    void fetchPublicPromotions()
      .then((promoData) => {
        if (!cancelled) {
          setPromotions(import.meta.env.DEV ? mergeDemoPromotions(promoData) : promoData)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true)
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
  }, [reloadKey])

  // La ubicación solo ordena por cercanía: las promos se ven igual sin ella.
  useEffect(() => {
    let cancelled = false

    void requestUserLocation()
      .then((location) => {
        if (!cancelled && location?.coords) {
          setCoords(location.coords)
          setUsingDemoLocation(false)
        }
      })
      .catch(() => {
        if (!cancelled && import.meta.env.DEV) {
          setCoords(DEMO_PREVIEW_COORDS)
          setUsingDemoLocation(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleRequestLocation = async () => {
    setLocationRequesting(true)
    setLocationDenied(false)
    try {
      const location = await requestUserLocation()
      setCoords(location.coords)
      setUsingDemoLocation(false)
    } catch {
      setLocationDenied(true)
    } finally {
      setLocationRequesting(false)
    }
  }

  const companyLadderMap = useMemo(
    () => buildCompanyLadderPromotionsMap(promotions),
    [promotions],
  )

  const ladderRestaurants = useMemo<LadderRestaurantGroup[]>(
    () => groupLadderRestaurants(promotions, coords),
    [promotions, coords],
  )

  const activeLadderRestaurants = useMemo(() => {
    const active = ladderRestaurants.filter((group) =>
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
    ladderRestaurants,
    verifiedReservationCounts,
    pendingReservationCounts,
    ladderRuntime,
    claimedPromotions,
  ])

  const regularPromotions = useMemo(
    () => promotions.filter((promotion) => !isLadderStep(promotion)),
    [promotions],
  )

  const inProgressTimeLimited = useMemo(
    () =>
      regularPromotions.filter(
        (promotion) =>
          promotion.type === 'time_limited'
          && findTimeLimitedReservationForStrip(customerReservations, promotion.id) != null,
      ),
    [regularPromotions, customerReservations],
  )

  const restaurantRows = useMemo(
    () => groupPromotionsByRestaurant(regularPromotions, coords),
    [regularPromotions, coords],
  )

  const rowsReveal = useIncrementalReveal(restaurantRows.length, 'filas', 8)

  const sortedClaims = useMemo(
    () =>
      [...claimedPromotions].sort(
        (left, right) => new Date(right.claimedAt).getTime() - new Date(left.claimedAt).getTime(),
      ),
    [claimedPromotions],
  )

  const savedPromotions = useMemo(
    () => promotions.filter((promotion) => savedPromoIds.has(promotion.id)),
    [promotions, savedPromoIds],
  )

  // El estado de cada promo (candados, plazas, usos, horario) lo decide el servidor.
  const availabilityState = usePromotionAvailability()
  useEffect(() => {
    if (!user) return
    void loadPromotionAvailability(true)
  }, [user, now, claimedPromotions, customerReservations])
  const availabilityById = useMemo(
    () => new Map(Object.entries(availabilityState?.availability ?? {})),
    [availabilityState],
  )

  const lockLabelFor = (promotion: PublicPromotion) => {
    const availability = availabilityById.get(promotion.id)
    return availability?.locked ? availability.badge : null
  }

  const ladderGroupFor = (companyId: string): LadderRestaurantGroup | null =>
    ladderRestaurants.find((group) => group.companyId === companyId) ?? null

  const handleToggleSavePromotion = (promotion: PublicPromotion) => {
    const next = new Set(savedPromoIds)
    if (next.has(promotion.id)) next.delete(promotion.id)
    else next.add(promotion.id)
    setSavedPromoIds(next)
    writeLocalSavedPromotionIds(userClaimKey, next)
    if (user?.uid) {
      void persistSavedPromotionIds(user.uid, next)
        .then(() => refreshProfile())
        .catch(() => undefined)
    }
  }

  const handleReserve = (promotion: PublicPromotion) => {
    if (promoLocked) {
      return
    }

    if (promotion.companyId) {
      trackAppEvent('promo_reserve_click', {
        companyId: promotion.companyId,
        entityId: promotion.id,
        entityKind: 'promotion',
        source: 'promo_detail',
      })
    }

    navigate(
      buildPromotionBookingHref(promotion.companySlug, promotion.id, { fromPromotions: true }),
      { state: { from: 'promociones' } },
    )
  }

  const openPromotion = (promotion: PublicPromotion) => {
    openParams({ promo: promotion.id, local: promotion.companySlug })
  }

  const openRestaurant = (group: RestaurantPromoGroup) => {
    openParams({ local: group.companySlug, promo: null, ver: null })
  }

  const openLadderMap = (promotion: PublicPromotion) => {
    const group = ladderGroupFor(promotion.companyId)
    if (group) {
      setLadderMapGroup(group)
    }
  }

  const handleClaimRequest = (promotion: PublicPromotion) => {
    if (promoLocked) {
      return
    }
    setClaimFlowPromotion(promotion)
  }

  const handleClaimConfirmed = async (promotion: PublicPromotion, pin: string) => {
    if (userClaimKey) {
      persistClaimedPromotionId(userClaimKey, promotion.id)
    }

    if (promotion.companyId) {
      trackAppEvent('promo_claim', {
        companyId: promotion.companyId,
        entityId: promotion.id,
        entityKind: 'promotion',
      })
    }

    const companyLadder = companyLadderMap.get(promotion.companyId) ?? [promotion]
    await claimPromotion(promotion, companyLadder, pin)
    setLadderMapGroup(null)
    setView('reclamadas')
  }

  const handleApplyToken = async (itemId: string) => {
    if (!tokenGroup) {
      return
    }
    setTokenApplying(true)
    setTokenError(null)
    setTokenNotice(null)
    try {
      await applyReservationToken(itemId, tokenGroup.companyId)
      setTokenGroup(null)
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
    _reservationId: string,
    _result: VerifyMinimumSpendResult,
  ) => {
    void refreshProfile().then(() => refreshGamificationData({ silent: true }))
  }

  const verifyRestaurantName = verifyReservation
    ? promotions.find((promotion) => promotion.companyId === verifyReservation.companyId)?.companyName
      ?? 'Restaurante'
    : ''

  const tokenHandlerFor = (group: LadderRestaurantGroup) =>
    canUsePromoTokenOnGroup(
      group,
      gamificationState.inventory,
      ladderRuntime.activeLadderPromotionByCompany,
      promoLocked,
    )
      ? openTokenModal
      : undefined

  const loading = loadingPromos || gamificationLoading

  const claimForPromotion = (id: string) => sortedClaims.find((claim) => claim.promotionId === id)

  const renderContent = () => {
    if (loading) {
      return <div className={styles.loading}>Cargando promociones…</div>
    }

    if (loadError) {
      return (
        <div className={styles.empty}>
          <p>No se pudieron cargar las promociones.</p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => {
              setLoadingPromos(true)
              setReloadKey((key) => key + 1)
            }}
          >
            Reintentar
          </button>
        </div>
      )
    }

    return renderList()
  }

  // Lo que se abre en el panel de la derecha: ficha de promo, restaurante o lista de mapas.
  const renderPanelBody = () => {
    // Ficha de una promo (también sirve para las reclamadas que ya no están activas).
    if (promotionId) {
      const claim = claimForPromotion(promotionId)
      const promotion = promotions.find((row) => row.id === promotionId)
        ?? (claim ? promotionFromClaim(claim) : null)

      if (!promotion) {
        return (
          <div className={panelStyles.panelPage}>
            <PanelTop eyebrow="Promoción" title="No disponible" onBack={goBack} />
            <p className={panelStyles.panelEmpty}>Esta promoción ya no está activa.</p>
          </div>
        )
      }

      const linkedReservation = promotion.type === 'time_limited'
        ? findReservationForActivasFeed(customerReservations, promotion.id, claimedReservationIds)
        : null
      const statusLine = linkedReservation
        ? getTimeLimitedPromotionPresentation(linkedReservation, {
            type: promotion.type,
            title: promotion.title,
          })?.label ?? null
        : null

      return (
        <PromotionDetailView
          promotion={promotion}
          companyPromotions={promotions}
          distanceKm={promotionDistanceKm(promotion, coords)}
          saved={savedPromoIds.has(promotion.id)}
          promoLocked={promoLocked}
          claimedAt={claim?.claimedAt}
          reservationStatusLine={statusLine}
          onBack={goBack}
          onReserve={handleReserve}
          onToggleSave={handleToggleSavePromotion}
          onOpenLadderMap={openLadderMap}
          onVerify={linkedReservation ? () => setVerifyReservation(linkedReservation) : undefined}
          availability={claim ? null : availabilityById.get(promotion.id) ?? null}
        />
      )
    }

    if (restaurantSlug) {
      const companyPromotions = promotions.filter((promotion) => promotion.companySlug === restaurantSlug)
      const first = companyPromotions[0]
      const ladderGroup = first ? ladderGroupFor(first.companyId) : null
      const others = companyPromotions.filter((promotion) => !isLadderStep(promotion))

      return (
        <div className={panelStyles.panelPage}>
          <PanelTop
            eyebrow="Promociones activas"
            title={first?.companyName ?? 'Restaurante'}
            onBack={goBack}
            photo={first ? { name: first.companyName, url: first.companyPhotoUrl } : undefined}
          />
          {companyPromotions.length === 0 ? (
            <p className={panelStyles.panelEmpty}>
              Este restaurante no tiene promociones activas ahora mismo.
            </p>
          ) : (
            <>
              {ladderGroup ? (
                <LadderMapCard
                  steps={ladderGroup.ladderPromotions}
                  onOpen={() => setLadderMapGroup(ladderGroup)}
                />
              ) : null}
              {others.length > 0 ? (
                <div className={panelStyles.panelGrid}>
                  {others.map((promotion, index) => (
                    <PromoAppCard
                      key={promotion.id}
                      promotion={promotion}
                      index={index}
                      tile
                      lockLabel={lockLabelFor(promotion)}
                      onOpen={openPromotion}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      )
    }

    if (showMaps) {
      return (
        <div className={panelStyles.panelPage}>
          <PanelTop eyebrow="Mapas del tesoro" title="Investiga y completa" onBack={goBack} />
          <p className={panelStyles.panelSub}>
            Restaurantes con sendero de premios. Reserva o consume para avanzar.
          </p>
          {ladderRestaurants.length === 0 ? (
            <p className={panelStyles.panelEmpty}>No hay mapas activos ahora mismo.</p>
          ) : (
            ladderRestaurants.map((group) => {
              const totalVisits = group.ladderPromotions.reduce(
                (sum, step) => sum + Math.max(0, step.requiredReservations ?? 0),
                0,
              )
              const missions = group.ladderPromotions.length
              const hint = group.ladderPromotions
                .map((step) => step.title)
                .filter(Boolean)
                .slice(0, 2)
                .join(' · ')

              // También aquí: un mapa a 0 no sale en «En curso» y la llave no tendría dónde usarse.
              const useToken = tokenHandlerFor(group)

              return (
                <div key={group.companyId} className={panelStyles.mapRowWrap}>
                <button
                  type="button"
                  className={panelStyles.mapRow}
                  onClick={() => setLadderMapGroup(group)}
                >
                  <RestaurantAvatar name={group.companyName} photoUrl={group.companyPhotoUrl} size="lg" />
                  <span className={panelStyles.mapRowCopy}>
                    <span className={panelStyles.mapRowName}>{group.companyName}</span>
                    <span className={panelStyles.mapRowMeta}>
                      <span className={panelStyles.metaChip}>
                        {missions} {missions === 1 ? 'misión' : 'misiones'}
                      </span>
                      {totalVisits > 0 ? (
                        <span className={panelStyles.metaChipSoft}>Hasta {totalVisits} visitas</span>
                      ) : null}
                    </span>
                    <span className={panelStyles.mapRowHint}>{hint || 'Abre el mapa de premios'}</span>
                  </span>
                  <span className={panelStyles.mapRowArrow} aria-hidden="true">→</span>
                </button>
                {useToken ? (
                  <button
                    type="button"
                    className={panelStyles.mapRowToken}
                    onClick={() => useToken(group)}
                  >
                    Usar carta o llave
                  </button>
                ) : null}
                </div>
              )
            })
          )}
        </div>
      )
    }

    return null
  }

  const renderList = () => {
    if (view === 'reclamadas') {
      return sortedClaims.length === 0 ? (
        <div className={styles.empty}>
          <p>Aún no has reclamado ninguna oferta.</p>
          <p className={styles.emptyHint}>Completa las reservas o consumos necesarios y pulsa Reclamar.</p>
        </div>
      ) : (
        <div className={styles.tileGrid}>
          {sortedClaims.map((claim, index) => (
            <PromoAppCard
              key={`${claim.promotionId}-${claim.claimedAt}`}
              promotion={promotions.find((row) => row.id === claim.promotionId) ?? promotionFromClaim(claim)}
              index={index}
              tile
              showRestaurant
              stamp="Reclamada"
              onOpen={openPromotion}
            />
          ))}
        </div>
      )
    }

    if (view === 'guardadas') {
      return savedPromotions.length === 0 ? (
        <div className={styles.empty}>
          <p>Aún no has guardado ninguna promoción.</p>
          <p className={styles.emptyHint}>Abre una promo y pulsa «Guardar» para tenerla a mano.</p>
        </div>
      ) : (
        <div className={styles.tileGrid}>
          {savedPromotions.map((promotion, index) => (
            <PromoAppCard
              key={promotion.id}
              promotion={promotion}
              index={index}
              tile
              showRestaurant
              lockLabel={lockLabelFor(promotion)}
              onOpen={openPromotion}
            />
          ))}
        </div>
      )
    }

    const inCursoCount = activeLadderRestaurants.length + inProgressTimeLimited.length

    return (
      <div className={styles.feed}>
        <TreasureMapsCard
          mapCount={ladderRestaurants.length}
          onOpen={() => openParams({ ver: 'mapas', local: null, promo: null })}
        />

        {inCursoCount > 0 ? (
          <section className={styles.inCurso} aria-label="Promociones en curso">
            <div className={styles.sectionHead}>
              <h2>En curso</h2>
              <span>{inCursoCount}</span>
            </div>
            <div className={styles.inCursoRail}>
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
                  onUseToken={tokenHandlerFor(group)}
                />
              ))}
              {inProgressTimeLimited.map((promotion, index) => (
                <div key={promotion.id} className={styles.inCursoItem}>
                  <PromoAppCard promotion={promotion} index={index} showRestaurant onOpen={openPromotion} />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!coords ? (
          <div className={styles.locationHint}>
            <p>Activa tu ubicación y te enseñamos primero los restaurantes más cercanos.</p>
            <button
              type="button"
              className={styles.locationButton}
              onClick={() => void handleRequestLocation()}
              disabled={locationRequesting}
            >
              {locationRequesting ? 'Buscando…' : 'Usar mi ubicación'}
            </button>
            {locationDenied ? (
              <p className={styles.locationError} role="status">
                No hemos podido acceder a tu ubicación. Permítela en los ajustes del navegador.
              </p>
            ) : null}
          </div>
        ) : usingDemoLocation ? (
          <p className={styles.demoLocationHint}>
            Sin GPS: usamos Logroño como ubicación para enseñarte esta pestaña.
          </p>
        ) : null}

        <div className={styles.rows} data-tour="tour-promos-feed">
          {restaurantRows.length === 0 ? (
            <div className={styles.empty}>
              <p>No hay promociones activas ahora mismo.</p>
            </div>
          ) : (
            restaurantRows.slice(0, rowsReveal.visibleCount).map((group, index) => (
              <RestaurantPromosRow
                key={group.companyId}
                group={group}
                index={index}
                onOpenPromotion={openPromotion}
                onOpenRestaurant={openRestaurant}
                lockLabelFor={lockLabelFor}
              />
            ))
          )}
          {rowsReveal.hasMore ? (
            <div ref={rowsReveal.sentinelRef} className={styles.loadMore} aria-hidden="true">
              <span className={styles.loadMoreDot} />
              <span className={styles.loadMoreDot} />
              <span className={styles.loadMoreDot} />
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  const panelOpen = !loading && !loadError && Boolean(promotionId || restaurantSlug || showMaps)
  const panelKey = promotionId ? `promo-${promotionId}` : restaurantSlug ? `local-${restaurantSlug}` : 'mapas'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Ofertas</p>
        <h1 className={styles.title}>Promociones</h1>
        <p className={styles.subtitle}>Activas cerca de ti y en tus locales favoritos</p>
      </header>

      <div className={styles.segmented} role="tablist" aria-label="Promociones">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            className={view === tab.id ? styles.segOn : styles.seg}
            onClick={() => setView(tab.id)}
          >
            {tab.label}
            {tab.id === 'guardadas' && savedPromotions.length > 0 ? (
              <span className={styles.segCount}>{savedPromotions.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {productTour?.stepId === 'promos-types' ? (
        <aside className={styles.tourTypes} data-tour="tour-promos-types" aria-label="Tipos de promociones">
          <article className={styles.tourTypeCard}>
            <span className={styles.tourTypeIcon} aria-hidden="true">⏱</span>
            <div>
              <strong>Puntuales</strong>
              <p>Tiempo limitado o asistencia: hay que ir en un plazo o franja concreta.</p>
            </div>
          </article>
          <article className={styles.tourTypeCard}>
            <span className={styles.tourTypeIcon} aria-hidden="true">🎯</span>
            <div>
              <strong>De fidelidad</strong>
              <p>Mapas del tesoro por reservas o consumos: cuantas más visitas, mejor premio.</p>
            </div>
          </article>
        </aside>
      ) : null}

      {promoLocked ? (
        <div className={styles.lockBanner} role="status">
          <strong>Promociones bloqueadas</strong>
          <p>
            Has cancelado 5 reservas o más. No puedes reservar con promoción ni canjear premios.
            Las reservas normales siguen disponibles.
          </p>
        </div>
      ) : null}

      {renderContent()}

      {panelOpen ? (
        <PromoSidePanel
          label={promotionId ? 'Promoción' : restaurantSlug ? 'Promociones del restaurante' : 'Mapas del tesoro'}
          contentKey={panelKey}
          onClose={() => openParams({ ver: null, local: null, promo: null })}
        >
          {renderPanelBody()}
        </PromoSidePanel>
      ) : null}

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
        onRegisterConsumption={registerPromotionConsumption}
        onOpenPromotion={(promotion) => {
          setLadderMapGroup(null)
          openPromotion(promotion)
        }}
      />

      <PromotionClaimFlowModal
        promotion={claimFlowPromotion}
        onClose={() => setClaimFlowPromotion(null)}
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

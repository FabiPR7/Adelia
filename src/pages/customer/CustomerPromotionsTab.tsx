import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import PromotionClaimTicketModal from '../../components/promotions/PromotionClaimTicketModal'
import PromotionPhotoCollage from '../../components/promotions/PromotionPhotoCollage'
import { useAuth } from '../../context/AuthContext'
import { useCustomerGamificationContext } from '../../context/CustomerGamificationContext'
import { fetchPublicPromotions, type PublicPromotion } from '../../services/publicPromotions'
import { PROMOTION_TYPE_LABELS } from '../../types/company'
import type { ClaimedPromotionRecord } from '../../types/gamification'
import { resolvePromotionDetail, resolvePromotionHighlight, resolvePromotionMinimumSpend } from '../../utils/promotionOffer'
import {
  DEMO_PREVIEW_COORDS,
  mergeDemoPromotions,
} from '../../data/demoNearbyPromotions'
import { haversineDistanceKm, formatDistanceKm, PROMO_NEARBY_MAX_KM } from '../../utils/geo'
import { requestUserLocation } from '../../utils/requestUserLocation'
import {
  getReservationProgress,
  isPromotionAwaitingConfirmation,
  isPromotionClaimable,
  isPromotionInProgress,
  isActiveStripPromotion,
  comparePromotionPriority,
  buildCompanyLadderPromotionsMap,
  persistClaimedPromotionId,
  remainingReservations,
  type CompanyLadderRuntime,
} from '../../utils/promotionReservationProgress'
import { buildPromotionBookingHref } from '../../utils/promotionBooking'
import styles from './CustomerPromotionsTab.module.css'

const ACCENTS = ['coral', 'gold', 'magenta', 'sunset'] as const
type PromoAccent = (typeof ACCENTS)[number]
type PromoView = 'activas' | 'reclamadas'

type PromoEntry = {
  promotion: PublicPromotion
  distanceKm: number | null
}

function promoTypeLabel(type: PublicPromotion['type']): string {
  return PROMOTION_TYPE_LABELS[type as keyof typeof PROMOTION_TYPE_LABELS] ?? type
}

function accentForIndex(index: number): PromoAccent {
  return ACCENTS[index % ACCENTS.length]
}

function highlightLabel(promotion: PublicPromotion, index: number): string {
  return resolvePromotionHighlight(promotion, index)
}

function detailLabel(promotion: PublicPromotion): string {
  const detail = resolvePromotionDetail(promotion)
  if (detail) {
    return detail
  }

  return promoTypeLabel(promotion.type)
}

function formatClaimDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function isActiveStripEntry(
  promotion: PublicPromotion,
  confirmedCounts: Record<string, number>,
  pendingCounts: Record<string, number>,
  ladderRuntime: CompanyLadderRuntime,
  companyLadderPromotions: PublicPromotion[],
): boolean {
  return isActiveStripPromotion(
    promotion,
    confirmedCounts,
    pendingCounts,
    ladderRuntime,
    companyLadderPromotions,
  )
}

function promotionFromClaim(claim: ClaimedPromotionRecord): PublicPromotion {
  return {
    id: claim.promotionId,
    companyId: claim.companyId,
    companyName: claim.companyName,
    companySlug: claim.companySlug,
    companyPhotoUrl: '',
    companyLatitude: null,
    companyLongitude: null,
    type: 'reservation_ladder',
    title: claim.title,
    description: '',
    photoUrl: '',
    offer: {
      kind: 'custom',
      bundleGet: null,
      bundlePay: null,
      discountPercent: null,
      fixedPriceCents: null,
      customLabel: claim.prizeLabel,
    },
    productRefs: [],
    requiredReservations: null,
    activeFromTime: '',
    activeToTime: '',
    arrivalWindowMinutes: null,
    maxRedemptions: null,
    currentRedemptions: 0,
    detail: '',
    highlight: claim.prizeLabel,
  }
}

function CompactPromoCard({
  entry,
  index,
  confirmedCounts,
  pendingCounts,
  ladderRuntime,
  companyLadderPromotions,
  onClaim,
}: {
  entry: PromoEntry
  index: number
  confirmedCounts: Record<string, number>
  pendingCounts: Record<string, number>
  ladderRuntime: CompanyLadderRuntime
  companyLadderPromotions: PublicPromotion[]
  onClaim: (promotion: PublicPromotion) => void
}) {
  const { promotion, distanceKm } = entry
  const awaiting = isPromotionAwaitingConfirmation(
    promotion,
    pendingCounts,
    companyLadderPromotions,
    ladderRuntime.activeLadderPromotionByCompany,
  )
  const inProgress = isPromotionInProgress(
    promotion,
    confirmedCounts,
    pendingCounts,
    ladderRuntime,
    companyLadderPromotions,
  )
  const claimable = isPromotionClaimable(
    promotion,
    confirmedCounts,
    ladderRuntime,
    companyLadderPromotions,
  )
  const { current, required } = getReservationProgress(
    promotion,
    confirmedCounts,
    ladderRuntime,
  )
  const remaining = remainingReservations(promotion, confirmedCounts, ladderRuntime)
  const percent = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 0
  const minSpendLabel = resolvePromotionMinimumSpend(promotion)
  const accent = accentForIndex(index)
  const productRefs = promotion.productRefs ?? []
  const hasVisual = productRefs.some((ref) => ref.photoUrl.trim())
    || Boolean(promotion.photoUrl?.trim())
    || Boolean(promotion.companyPhotoUrl?.trim())

  return (
    <article className={`${styles.compactCard} ${styles[`accent_${accent}`]}`}>
      <Link
        to={buildPromotionBookingHref(promotion.companySlug, promotion.id, { fromPromotions: true })}
        className={styles.compactLink}
      >
        <div className={styles.compactVisual}>
          {hasVisual ? (
            <PromotionPhotoCollage
              productRefs={productRefs}
              fallbackPhotoUrl={promotion.photoUrl || promotion.companyPhotoUrl}
              size="card"
              className={styles.compactVisualCollage}
              alt={promotion.title}
            />
          ) : (
            <div className={styles.compactFallback} aria-hidden="true">🎁</div>
          )}
          <div className={styles.promoOverlay} aria-hidden="true" />
          <span className={styles.compactHighlight}>{highlightLabel(promotion, index)}</span>
          {awaiting || inProgress ? <span className={styles.compactTag}>A medias</span> : null}
          <h3 className={styles.compactTitle}>{promotion.title}</h3>
        </div>

        <div className={styles.compactBody}>
          <p className={styles.compactRestaurant}>{promotion.companyName}</p>

          {awaiting ? (
            <>
              <p className={styles.pendingCopy}>
                Espera a que el restaurante confirme tu asistencia
              </p>
              <div className={styles.progressBar} aria-hidden="true">
                <span className={styles.progressBarPending} style={{ width: `${Math.max(percent, 12)}%` }} />
              </div>
            </>
          ) : inProgress ? (
            <>
              <p className={styles.compactRemaining}>
                Te {remaining === 1 ? 'falta' : 'faltan'} <strong>{remaining}</strong>
              </p>
              <div className={styles.progressBar} aria-hidden="true">
                <span style={{ width: `${percent}%` }} />
              </div>
              <p className={styles.progressCopy}>{current}/{required}</p>
            </>
          ) : null}

          {distanceKm != null && !claimable ? (
            <span className={styles.compactDistance}>{formatDistanceKm(distanceKm)}</span>
          ) : null}
          {minSpendLabel ? (
            <span className={styles.compactMinSpend}>{minSpendLabel}</span>
          ) : null}
        </div>
      </Link>

      {claimable ? (
        <button
          type="button"
          className={styles.claimButton}
          onClick={() => onClaim(promotion)}
        >
          Reclamar
        </button>
      ) : null}
    </article>
  )
}

function RegularPromoCard({ entry, index }: { entry: PromoEntry; index: number }) {
  const { promotion, distanceKm } = entry
  const accent = accentForIndex(index)
  const minSpendLabel = resolvePromotionMinimumSpend(promotion)
  const productRefs = promotion.productRefs ?? []
  const hasVisual = productRefs.some((ref) => ref.photoUrl.trim())
    || Boolean(promotion.photoUrl?.trim())
    || Boolean(promotion.companyPhotoUrl?.trim())

  return (
    <article className={`${styles.promoCard} ${styles[`accent_${accent}`]}`}>
      <Link
        to={buildPromotionBookingHref(promotion.companySlug, promotion.id, { fromPromotions: true })}
        className={styles.promoLink}
      >
        <div className={styles.promoVisual}>
          {hasVisual ? (
            <PromotionPhotoCollage
              productRefs={productRefs}
              fallbackPhotoUrl={promotion.photoUrl || promotion.companyPhotoUrl}
              size="card"
              className={styles.promoVisualCollage}
              alt={promotion.title}
            />
          ) : (
            <div className={styles.imageFallback} aria-hidden="true">🎁</div>
          )}
          <div className={styles.promoShine} aria-hidden="true" />
          <div className={styles.promoOverlay} aria-hidden="true" />
          <span className={styles.promoHighlight}>{highlightLabel(promotion, index)}</span>
          <div className={styles.promoVisualTags}>
            {distanceKm != null ? (
              <span className={styles.tagDistance}>{formatDistanceKm(distanceKm)}</span>
            ) : null}
          </div>
          <h3 className={styles.promoVisualTitle}>{promotion.title}</h3>
        </div>

        <div className={styles.promoBody}>
          <p className={styles.promoRestaurant}>{promotion.companyName}</p>
          <div className={styles.promoMeta}>
            <div className={styles.promoMetaChips}>
              <span className={styles.promoDetail}>{detailLabel(promotion)}</span>
              {minSpendLabel ? (
                <span className={styles.promoMinSpend}>{minSpendLabel}</span>
              ) : null}
            </div>
            <span className={styles.promoArrow} aria-hidden="true">→</span>
          </div>
        </div>
      </Link>
    </article>
  )
}

function ClaimedPromoCard({
  claim,
  onViewTicket,
}: {
  claim: ClaimedPromotionRecord
  onViewTicket: (claim: ClaimedPromotionRecord) => void
}) {
  return (
    <article className={styles.claimedCard}>
      <div className={styles.claimedHeader}>
        <span className={styles.claimedPrize}>{claim.prizeLabel}</span>
        <span className={styles.claimedDate}>{formatClaimDate(claim.claimedAt)}</span>
      </div>
      <h3 className={styles.claimedTitle}>{claim.title}</h3>
      <p className={styles.claimedRestaurant}>{claim.companyName}</p>
      <div className={styles.claimedActions}>
        <Link to={`/reservar/${claim.companySlug}`} state={{ from: 'promociones' }} className={styles.claimedLink}>
          Ver restaurante
        </Link>
        <button type="button" className={styles.claimedTicketButton} onClick={() => onViewTicket(claim)}>
          Ver ticket
        </button>
      </div>
    </article>
  )
}

function CustomerPromotionsTab() {
  const { user, profile } = useAuth()
  const {
    loading: gamificationLoading,
    verifiedReservationCounts,
    pendingReservationCounts,
    ladderRuntime,
    claimedPromotions,
    claimPromotion,
    refreshGamificationData,
  } = useCustomerGamificationContext()

  const [promotions, setPromotions] = useState<PublicPromotion[]>([])
  const [view, setView] = useState<PromoView>('activas')
  const [claimTicket, setClaimTicket] = useState<PublicPromotion | null>(null)
  const [loadingPromos, setLoadingPromos] = useState(true)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [usingDemoLocation, setUsingDemoLocation] = useState(false)

  const userClaimKey = profile?.email ?? user?.uid ?? ''

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

        setPromotions(mergeDemoPromotions(promoData))

        if (location?.coords) {
          setCoords(location.coords)
          setUsingDemoLocation(false)
        } else {
          setCoords(DEMO_PREVIEW_COORDS)
          setUsingDemoLocation(true)
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

  const activeStripPromotions = useMemo(() => {
    const active = nearbyPromotions.filter(({ promotion }) => {
      const companyLadder = companyLadderMap.get(promotion.companyId) ?? []

      return isActiveStripEntry(
        promotion,
        verifiedReservationCounts,
        pendingReservationCounts,
        ladderRuntime,
        companyLadder,
      )
    })

    active.sort((left, right) => {
      const leftLadder = companyLadderMap.get(left.promotion.companyId) ?? []
      const rightLadder = companyLadderMap.get(right.promotion.companyId) ?? []

      return comparePromotionPriority(
        left.promotion,
        right.promotion,
        verifiedReservationCounts,
        pendingReservationCounts,
        ladderRuntime,
        leftLadder,
        rightLadder,
        left.distanceKm,
        right.distanceKm,
      )
    })

    return active
  }, [
    nearbyPromotions,
    verifiedReservationCounts,
    pendingReservationCounts,
    ladderRuntime,
    companyLadderMap,
  ])

  const regularPromotions = useMemo(
    () =>
      nearbyPromotions.filter(({ promotion }) => {
        const companyLadder = companyLadderMap.get(promotion.companyId) ?? []

        return !isActiveStripEntry(
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

  const sortedClaims = useMemo(
    () =>
      [...claimedPromotions].sort(
        (left, right) => new Date(right.claimedAt).getTime() - new Date(left.claimedAt).getTime(),
      ),
    [claimedPromotions],
  )

  const handleClaim = async (promotion: PublicPromotion) => {
    if (userClaimKey) {
      persistClaimedPromotionId(userClaimKey, promotion.id)
    }

    const companyLadder = companyLadderMap.get(promotion.companyId) ?? [promotion]
    await claimPromotion(promotion, companyLadder)
    setClaimTicket(promotion)
  }

  const loading = loadingPromos || gamificationLoading

  if (loading) {
    return <div className={styles.loading}>Cargando promociones…</div>
  }

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

      {view === 'reclamadas' ? (
        sortedClaims.length === 0 ? (
          <div className={styles.empty}>
            <p>Aún no has reclamado ninguna oferta.</p>
            <p className={styles.emptyHint}>Completa las reservas necesarias y pulsa Reclamar.</p>
          </div>
        ) : (
          <div className={styles.claimedList}>
            {sortedClaims.map((claim) => (
              <ClaimedPromoCard
                key={`${claim.promotionId}-${claim.claimedAt}`}
                claim={claim}
                onViewTicket={() => setClaimTicket(promotionFromClaim(claim))}
              />
            ))}
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
          ) : nearbyPromotions.length === 0 ? (
            <div className={styles.empty}>
              <p>No hay ofertas cerca tuyo.</p>
            </div>
          ) : (
            <>
              {activeStripPromotions.length > 0 ? (
                <section className={styles.activeStrip} aria-label="Ofertas a medias">
                  <div className={styles.activeScroller}>
                    {activeStripPromotions.map((entry, index) => (
                      <CompactPromoCard
                        key={entry.promotion.id}
                        entry={entry}
                        index={index}
                        confirmedCounts={verifiedReservationCounts}
                        pendingCounts={pendingReservationCounts}
                        ladderRuntime={ladderRuntime}
                        companyLadderPromotions={companyLadderMap.get(entry.promotion.companyId) ?? []}
                        onClaim={handleClaim}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {activeStripPromotions.length > 0 && regularPromotions.length > 0 ? (
                <div className={styles.sectionDivider} aria-hidden="true" />
              ) : null}

              {regularPromotions.length > 0 ? (
                <div className={styles.promoFeed}>
                  {regularPromotions.map((entry, index) => (
                    <RegularPromoCard key={entry.promotion.id} entry={entry} index={index} />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </>
      )}

      <PromotionClaimTicketModal
        promotion={claimTicket}
        onClose={() => setClaimTicket(null)}
      />
    </div>
  )
}

export default CustomerPromotionsTab

import { Link } from 'react-router-dom'
import type { PublicPromotion } from '../../services/publicPromotions'
import { PROMOTION_TYPE_LABELS } from '../../types/company'
import { resolvePromotionDetail, resolvePromotionHighlight, resolvePromotionMinimumSpend } from '../../utils/promotionOffer'
import { formatDistanceKm } from '../../utils/geo'
import { buildPromotionBookingHref } from '../../utils/promotionBooking'
import type { LadderNodeStatus } from '../../utils/promotionLadderStatus'
import type { PromotionVisitPresentation } from '../../utils/reservationPromotionEligibility'
import { canCustomerVerifyMinimumSpend } from '../../utils/minimumSpendVerification'
import type { Reservation } from '../../types'
import PromotionPhotoCollage from './PromotionPhotoCollage'
import styles from './PromotionOfferCard.module.css'

const ACCENTS = ['coral', 'gold', 'magenta', 'sunset'] as const
type PromoAccent = (typeof ACCENTS)[number]

function accentForIndex(index: number): PromoAccent {
  return ACCENTS[index % ACCENTS.length]
}

function promoTypeLabel(type: PublicPromotion['type']): string {
  return PROMOTION_TYPE_LABELS[type as keyof typeof PROMOTION_TYPE_LABELS] ?? type
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

export interface PromotionOfferCardProps {
  promotion: PublicPromotion
  index: number
  distanceKm?: number | null
  claimed?: boolean
  claimedAt?: string
  className?: string
  /** En el mapa no navega; muestra botón reclamar si aplica. */
  mapMode?: boolean
  ladderStatus?: LadderNodeStatus
  progress?: { current: number; required: number }
  onClaim?: () => void
  reservationStatusLine?: PromotionVisitPresentation | null
  linkedReservation?: Reservation | null
  onVerify?: () => void
}

function cardStateClass(ladderStatus?: LadderNodeStatus, claimed?: boolean): string {
  if (claimed || ladderStatus === 'claimed') {
    return styles.cardClaimed
  }

  if (ladderStatus === 'locked') {
    return styles.cardLocked
  }

  if (ladderStatus === 'claimable') {
    return styles.cardClaimable
  }

  return ''
}

export default function PromotionOfferCard({
  promotion,
  index,
  distanceKm = null,
  claimed = false,
  claimedAt,
  className = '',
  mapMode = false,
  ladderStatus,
  progress,
  onClaim,
  reservationStatusLine = null,
  linkedReservation = null,
  onVerify,
}: PromotionOfferCardProps) {
  const accent = accentForIndex(index)
  const isClaimed = claimed || ladderStatus === 'claimed'
  const canVerify = Boolean(
    linkedReservation
    && onVerify
    && canCustomerVerifyMinimumSpend(linkedReservation),
  )
  const hasLinkedReservationFlow = Boolean(
    linkedReservation
    && linkedReservation.promotionId === promotion.id
    && linkedReservation.status !== 'cancelled'
    && (
      canVerify
      || reservationStatusLine?.tone === 'pending'
      || reservationStatusLine?.tone === 'neutral'
    ),
  )
  const useStaticCard = mapMode || hasLinkedReservationFlow
  const minSpendLabel = resolvePromotionMinimumSpend(promotion)
  const productRefs = promotion.productRefs ?? []
  const hasVisual = productRefs.some((ref) => ref.photoUrl.trim())
    || Boolean(promotion.photoUrl?.trim())
    || Boolean(promotion.companyPhotoUrl?.trim())
  const linkTo = isClaimed
    ? `/reservar/${promotion.companySlug}`
    : buildPromotionBookingHref(promotion.companySlug, promotion.id, { fromPromotions: true })

  const showProgress = Boolean(
    mapMode
    && progress
    && progress.required > 0
    && ladderStatus
    && ladderStatus !== 'claimed'
    && ladderStatus !== 'locked',
  )
  const progressPercent = showProgress && progress
    ? Math.min(100, Math.round((progress.current / progress.required) * 100))
    : 0

  const content = (
    <>
      <div className={styles.visual}>
        {hasVisual ? (
          <PromotionPhotoCollage
            productRefs={productRefs}
            fallbackPhotoUrl={promotion.photoUrl || promotion.companyPhotoUrl}
            size="card"
            className={styles.visualCollage}
            alt={promotion.title}
          />
        ) : (
          <div className={styles.imageFallback} aria-hidden="true">🎁</div>
        )}
        {!isClaimed ? <div className={styles.shine} aria-hidden="true" /> : null}
        <div className={styles.overlay} aria-hidden="true" />
        <span className={styles.highlight}>{resolvePromotionHighlight(promotion, index)}</span>
        <div className={styles.visualTags}>
          {showProgress && progress ? (
            <span className={styles.tagProgress}>
              {progress.current}/{progress.required}
            </span>
          ) : null}
          {!mapMode && isClaimed && claimedAt ? (
            <span className={styles.tagDistance}>{formatClaimDate(claimedAt)}</span>
          ) : null}
          {!mapMode && !isClaimed && distanceKm != null ? (
            <span className={styles.tagDistance}>{formatDistanceKm(distanceKm)}</span>
          ) : null}
        </div>
        <h3 className={styles.visualTitle}>{promotion.title}</h3>
        {mapMode && ladderStatus === 'claimable' ? (
          <button
            type="button"
            className={styles.claimButtonOverlay}
            onClick={(event) => {
              event.stopPropagation()
              onClaim?.()
            }}
          >
            Reclamar
          </button>
        ) : null}
      </div>

      <div className={styles.body}>
        <p className={styles.restaurant}>{promotion.companyName}</p>
        {reservationStatusLine ? (
          <p
            className={
              reservationStatusLine.tone === 'verified'
                ? styles.reservationStatusVerified
                : reservationStatusLine.tone === 'failed'
                  ? styles.reservationStatusFailed
                  : reservationStatusLine.tone === 'pending'
                    ? styles.reservationStatusPending
                    : styles.reservationStatusNeutral
            }
          >
            {reservationStatusLine.label}
          </p>
        ) : null}
        {isClaimed && promotion.description.trim() ? (
          <p className={styles.description}>{promotion.description}</p>
        ) : null}
        {showProgress && progress ? (
          <>
            <div className={styles.progressBar} aria-hidden="true">
              <span style={{ width: `${Math.max(progressPercent, 8)}%` }} />
            </div>
            <p className={styles.progressCopy}>{progress.current}/{progress.required} reservas</p>
          </>
        ) : null}
        <div className={styles.meta}>
          <div className={styles.metaChips}>
            <span className={styles.detail}>{detailLabel(promotion)}</span>
            {minSpendLabel ? (
              <span className={styles.minSpend}>{minSpendLabel}</span>
            ) : null}
          </div>
          {!mapMode && !isClaimed && !useStaticCard ? (
            <span className={styles.arrow} aria-hidden="true">→</span>
          ) : null}
        </div>
        {canVerify ? (
          <button
            type="button"
            className={styles.claimButton}
            onClick={(event) => {
              event.stopPropagation()
              onVerify?.()
            }}
          >
            Verificar
          </button>
        ) : null}
      </div>
    </>
  )

  return (
    <article
      className={`${styles.card} ${styles[`accent_${accent}`]} ${cardStateClass(ladderStatus, claimed)} ${canVerify ? styles.cardClaimable : ''} ${mapMode ? styles.cardMapMode : ''} ${className}`.trim()}
    >
      {isClaimed ? <span className={styles.claimedStamp}>Reclamada</span> : null}
      {useStaticCard ? (
        <div className={styles.staticWrap}>{content}</div>
      ) : (
        <Link
          to={linkTo}
          state={isClaimed ? { from: 'promociones' } : undefined}
          className={styles.link}
        >
          {content}
        </Link>
      )}
    </article>
  )
}

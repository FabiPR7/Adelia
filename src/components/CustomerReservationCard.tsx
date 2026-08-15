import { Link } from 'react-router-dom'
import type { Reservation } from '../types'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import { getReservationStatusLabel } from '../utils/customerReservations'
import {
  getPromotionVisitStatusPresentation,
  isTimeLimitedPromotionReservation,
  type ReservationPromotionInfo,
} from '../utils/reservationPromotionEligibility'
import { canCustomerReviewReservation } from '../types/review'
import { canCustomerVerifyMinimumSpend } from '../utils/minimumSpendVerification'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import styles from './CustomerReservationCard.module.css'

interface CustomerReservationCardProps {
  reservation: Reservation
  restaurant?: PublicDiscoveryRestaurant
  promotion?: ReservationPromotionInfo | null
  bucket: 'upcoming' | 'past'
  isNext?: boolean
  onVerifyMinimumSpend?: (reservation: Reservation) => void
  onLeaveReview?: (reservation: Reservation) => void
  hasReviewForRestaurant?: boolean
}

function formatCountdown(startTime: Date): string | null {
  const now = Date.now()
  const diffMs = startTime.getTime() - now

  if (diffMs <= 0) {
    return null
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (days > 0) {
    return `En ${days} ${days === 1 ? 'día' : 'días'}`
  }

  if (hours > 0) {
    return `En ${hours} ${hours === 1 ? 'hora' : 'horas'}`
  }

  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)))
  return `En ${minutes} min`
}

function CustomerReservationCard({
  reservation,
  restaurant,
  promotion = null,
  bucket,
  isNext = false,
  onVerifyMinimumSpend,
  onLeaveReview,
  hasReviewForRestaurant = false,
}: CustomerReservationCardProps) {
  const isUpcoming = bucket === 'upcoming'
  const statusLabel = getReservationStatusLabel(reservation.status, isUpcoming)
  const promoVisitPresentation = getPromotionVisitStatusPresentation(reservation, isUpcoming, promotion)
  const canVerify = canCustomerVerifyMinimumSpend(reservation)
  const isTimeLimitedPromo = isTimeLimitedPromotionReservation(reservation, promotion)
  const showReviewAction = onLeaveReview && canCustomerReviewReservation(reservation, bucket)
  const photoUrl = restaurant?.photoUrl
    ? optimizeCloudinaryUrl(restaurant.photoUrl, CLOUDINARY_DISPLAY.photoGallery)
    : ''

  const dateLabel = reservation.startTime.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  const timeLabel = reservation.startTime.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const countdown = isUpcoming ? formatCountdown(reservation.startTime) : null

  const cancelHref =
    restaurant && reservation.cancelToken
      ? `/reservar/${restaurant.slug}/cancelar?token=${encodeURIComponent(reservation.cancelToken)}`
      : null

  return (
    <article
      className={`${styles.card} ${isUpcoming ? styles.cardUpcoming : styles.cardPast} ${reservation.status === 'cancelled' ? styles.cardCancelled : ''} ${isNext ? styles.cardNext : ''}`}
    >
      {isNext && (
        <div className={styles.nextRibbon}>
          <span>Próxima reserva</span>
          {countdown && <strong>{countdown}</strong>}
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.media}>
          {photoUrl ? (
            <img src={photoUrl} alt="" />
          ) : (
            <div className={styles.mediaFallback} aria-hidden="true">
              🍽️
            </div>
          )}
        </div>

        <div className={styles.body}>
          <div className={styles.topRow}>
            <h3>{restaurant?.name ?? 'Restaurante'}</h3>
            <span className={styles.status}>{statusLabel}</span>
          </div>

          <div className={styles.datetime}>
            <span className={styles.date}>{dateLabel}</span>
            <span className={styles.time}>{timeLabel}</span>
          </div>

          <p className={styles.meta}>
            {reservation.pax} {reservation.pax === 1 ? 'persona' : 'personas'}
            {restaurant?.municipality ? ` · ${restaurant.municipality}` : ''}
          </p>

          {promoVisitPresentation ? (
            <p
              className={
                promoVisitPresentation.tone === 'verified'
                  ? styles.promoNoteVerified
                  : promoVisitPresentation.tone === 'failed'
                    ? styles.promoNoteFailed
                    : styles.promoNote
              }
            >
              {promoVisitPresentation.label}
            </p>
          ) : null}

          <div className={styles.actions}>
            {showReviewAction ? (
              <button
                type="button"
                className={styles.reviewAction}
                onClick={() => onLeaveReview(reservation)}
              >
                {hasReviewForRestaurant ? 'Mi reseña' : 'Reseñar'}
              </button>
            ) : null}
            {canVerify && onVerifyMinimumSpend ? (
              <button
                type="button"
                className={styles.verifyAction}
                onClick={() => onVerifyMinimumSpend(reservation)}
              >
                {isTimeLimitedPromo ? 'Verifica tu gasto' : 'Verificar'}
              </button>
            ) : null}
            {restaurant && (
              <Link to={`/reservar/${restaurant.slug}`} className={styles.primaryAction}>
                {isUpcoming ? 'Ver restaurante' : 'Reservar otra vez'}
              </Link>
            )}
            {isUpcoming && cancelHref && reservation.status !== 'cancelled' && (
              <Link to={cancelHref} className={styles.secondaryAction}>
                Cancelar
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export default CustomerReservationCard

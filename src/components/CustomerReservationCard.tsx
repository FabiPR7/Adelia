import { Link } from 'react-router-dom'
import { Swords } from 'lucide-react'
import type { Reservation } from '../types'
import type { ReservationInvite } from '../types/reservationInvites'
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
  variant?: 'owner' | 'guest'
  hostName?: string
  invites?: ReservationInvite[]
  onOpenInvites?: () => void
  onVerifyMinimumSpend?: (reservation: Reservation) => void
  onLeaveReview?: (reservation: Reservation) => void
  onChallenge?: () => void
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
  variant = 'owner',
  hostName,
  invites = [],
  onOpenInvites,
  onVerifyMinimumSpend,
  onLeaveReview,
  onChallenge,
  hasReviewForRestaurant = false,
}: CustomerReservationCardProps) {
  const isGuest = variant === 'guest'
  const isUpcoming = bucket === 'upcoming'
  const statusLabel = isGuest
    ? (reservation.status === 'cancelled' ? 'Cancelada' : 'Invitado')
    : getReservationStatusLabel(reservation.status, isUpcoming)
  const promoVisitPresentation = isGuest
    ? null
    : getPromotionVisitStatusPresentation(reservation, isUpcoming, promotion)
  const canVerify = !isGuest && canCustomerVerifyMinimumSpend(reservation)
  const isTimeLimitedPromo = isTimeLimitedPromotionReservation(reservation, promotion)
  const showReviewAction = !isGuest && onLeaveReview && canCustomerReviewReservation(reservation, bucket)
  const photoUrl = restaurant?.photoUrl
    ? optimizeCloudinaryUrl(restaurant.photoUrl, CLOUDINARY_DISPLAY.photoGallery)
    : ''
  const pendingInvites = invites.filter((invite) => invite.status === 'pending').length
  const showInvitesButton = !isGuest && invites.length > 0 && onOpenInvites

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
      className={`${styles.card} ${isGuest ? styles.cardGuest : isUpcoming ? styles.cardUpcoming : styles.cardPast} ${reservation.status === 'cancelled' ? styles.cardCancelled : ''} ${!isGuest && isNext ? styles.cardNext : ''}`}
    >
      {isGuest ? (
        <div className={styles.guestRibbon}>
          <span>Invitado</span>
          {hostName ? <strong>por {hostName}</strong> : null}
        </div>
      ) : isNext ? (
        <div className={styles.nextRibbon}>
          <span>Próxima reserva</span>
          {countdown && <strong>{countdown}</strong>}
        </div>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.media}>
          {photoUrl ? (
            <img src={photoUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <div className={styles.mediaFallback} aria-hidden="true">
              🍽️
            </div>
          )}
        </div>

        <div className={styles.body}>
          <div className={styles.topRow}>
            <h3>{restaurant?.name ?? 'Restaurante'}</h3>
            <div className={styles.topActions}>
              {showInvitesButton ? (
                <button
                  type="button"
                  className={styles.invitesButton}
                  onClick={onOpenInvites}
                  aria-label="Ver invitaciones"
                  title="Ver invitaciones"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
                    />
                  </svg>
                  {pendingInvites > 0 ? <span>{pendingInvites}</span> : null}
                </button>
              ) : null}
              <span className={`${styles.status} ${isGuest ? styles.statusGuest : ''}`}>{statusLabel}</span>
            </div>
          </div>

          <div className={styles.datetime}>
            <span className={styles.date}>{dateLabel}</span>
            <span className={styles.time}>{timeLabel}</span>
          </div>

          <p className={styles.meta}>
            {reservation.pax} {reservation.pax === 1 ? 'persona' : 'personas'}
            {restaurant?.municipality ? ` · ${restaurant.municipality}` : ''}
          </p>

          {isGuest ? (
            <p className={styles.guestNote}>
              Esta visita no está a tu nombre y no suma premios. Solo el titular puede cancelar.
            </p>
          ) : null}

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
            {isGuest && reservation.status !== 'cancelled' && onChallenge ? (
              <button
                type="button"
                className={styles.challengeAction}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onChallenge()
                }}
              >
                <Swords size={14} aria-hidden="true" />
                Retar
              </button>
            ) : null}
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
            {restaurant?.slug ? (
              <Link to={`/reservar/${restaurant.slug}`} className={styles.primaryAction}>
                {isUpcoming ? 'Ver restaurante' : 'Reservar otra vez'}
              </Link>
            ) : null}
            {isUpcoming && !isGuest && cancelHref && reservation.status !== 'cancelled' && (
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

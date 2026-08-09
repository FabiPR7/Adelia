import { Link } from 'react-router-dom'
import type { Reservation } from '../types'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import { getReservationStatusLabel } from '../utils/customerReservations'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import styles from './CustomerReservationCard.module.css'

interface CustomerReservationCardProps {
  reservation: Reservation
  restaurant?: PublicDiscoveryRestaurant
  bucket: 'upcoming' | 'past'
  isNext?: boolean
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
  bucket,
  isNext = false,
}: CustomerReservationCardProps) {
  const isUpcoming = bucket === 'upcoming'
  const statusLabel = getReservationStatusLabel(reservation.status, isUpcoming)
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

          <div className={styles.actions}>
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

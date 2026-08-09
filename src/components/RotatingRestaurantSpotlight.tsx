import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdelinaCoin from './AdelinaCoin'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import { getMockAdelinaReviewCount, getMockReviewRating, getMockReservationCount } from '../utils/mockReviewRating'
import styles from './RotatingRestaurantSpotlight.module.css'

export type SpotlightMetric = 'reservations' | 'rating'

interface RotatingRestaurantSpotlightProps {
  title: string
  subtitle: string
  restaurants: PublicDiscoveryRestaurant[]
  metric: SpotlightMetric
  intervalMs?: number
  onOpenRestaurant?: (restaurant: PublicDiscoveryRestaurant) => void
}

function RotatingRestaurantSpotlight({
  title,
  subtitle,
  restaurants,
  metric,
  intervalMs = 3000,
  onOpenRestaurant,
}: RotatingRestaurantSpotlightProps) {
  const [index, setIndex] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (restaurants.length <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      setFading(true)
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % restaurants.length)
        setFading(false)
      }, 220)
    }, intervalMs)

    return () => {
      window.clearInterval(timer)
    }
  }, [restaurants.length, intervalMs])

  if (restaurants.length === 0) {
    return null
  }

  const restaurant = restaurants[index]
  const imageUrl = restaurant.photoUrl
    ? optimizeCloudinaryUrl(restaurant.photoUrl, CLOUDINARY_DISPLAY.photoGallery)
    : ''
  const rating = getMockReviewRating(restaurant.slug)
  const reviewCount = getMockAdelinaReviewCount(restaurant.slug)
  const reservationCount = getMockReservationCount(restaurant.slug)

  return (
    <article className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <p className={styles.eyebrow}>{title}</p>
          <h3>{subtitle}</h3>
        </div>
        <div className={styles.dots} aria-hidden="true">
          {restaurants.slice(0, Math.min(restaurants.length, 6)).map((item, dotIndex) => (
            <span
              key={item.id}
              className={dotIndex === index % Math.min(restaurants.length, 6) ? styles.dotActive : styles.dot}
            />
          ))}
        </div>
      </div>

      <div className={`${styles.body} ${fading ? styles.bodyFade : ''}`}>
        <div className={styles.media}>
          {imageUrl ? (
            <img src={imageUrl} alt="" />
          ) : (
            <div className={styles.mediaFallback} aria-hidden="true">
              🍽️
            </div>
          )}
        </div>

        <div className={styles.copy}>
          <h4>{restaurant.name}</h4>
          <p>{restaurant.municipality || restaurant.location}</p>

          <div className={styles.stats}>
            {metric === 'reservations' ? (
              <>
                <span className={styles.statHighlight}>
                  <strong>{reservationCount.toLocaleString('es-ES')}</strong>
                  reservas
                </span>
                <span>
                  <AdelinaCoin size="sm" variant="review" alt="" />
                  {rating.toFixed(1)} · {reviewCount} reseñas
                </span>
              </>
            ) : (
              <>
                <span className={styles.statHighlight}>
                  <AdelinaCoin size="sm" variant="review" alt="" />
                  <strong>{rating.toFixed(1)}</strong>
                  puntuación
                </span>
                <span>
                  {reviewCount.toLocaleString('es-ES')} reseñas · {reservationCount} reservas
                </span>
              </>
            )}
          </div>

          <div className={styles.actions}>
            {onOpenRestaurant && (
              <button type="button" className={styles.previewBtn} onClick={() => onOpenRestaurant(restaurant)}>
                Ver ficha
              </button>
            )}
            <Link to={`/reservar/${restaurant.slug}`} className={styles.reserveBtn}>
              Reservar
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}

export default RotatingRestaurantSpotlight

import { useEffect, useState } from 'react'
import AdelinaCoin from './AdelinaCoin'
import {
  getDiscoveryAdelinaSlotStates,
  getDiscoveryAverageRating,
  type PublicDiscoveryRestaurant,
} from '../utils/publicDiscovery'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import styles from './RotatingRestaurantSpotlight.module.css'

export type SpotlightMetric = 'reservations' | 'rating'

interface RotatingRestaurantSpotlightProps {
  title: string
  subtitle?: string
  restaurants: PublicDiscoveryRestaurant[]
  metric?: SpotlightMetric
  intervalMs?: number
  onOpenRestaurant?: (restaurant: PublicDiscoveryRestaurant) => void
}

function RotatingRestaurantSpotlight({
  title,
  restaurants,
  intervalMs = 3000,
  onOpenRestaurant,
}: RotatingRestaurantSpotlightProps) {
  const [index, setIndex] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    setIndex(0)
  }, [restaurants])

  useEffect(() => {
    if (restaurants.length <= 1) {
      return
    }

    let fadeTimer = 0
    const timer = window.setInterval(() => {
      setFading(true)
      fadeTimer = window.setTimeout(() => {
        setIndex((current) => (current + 1) % restaurants.length)
        setFading(false)
      }, 220)
    }, intervalMs)

    return () => {
      window.clearInterval(timer)
      window.clearTimeout(fadeTimer)
    }
  }, [restaurants.length, intervalMs])

  if (restaurants.length === 0) {
    return null
  }

  const restaurant = restaurants[index] ?? restaurants[0]
  if (!restaurant) {
    return null
  }

  const imageUrl = restaurant.photoUrl
    ? optimizeCloudinaryUrl(restaurant.photoUrl, CLOUDINARY_DISPLAY.photoThumb)
    : ''
  const ratingSlots = getDiscoveryAdelinaSlotStates(restaurant)
  const averageRating = getDiscoveryAverageRating(restaurant)
  const ratingLabel = restaurant.reviewCount > 0
    ? `Valoración ${averageRating} de 5`
    : 'Sin valoraciones'

  return (
    <article className={styles.card}>
      <p className={styles.eyebrow}>{title}</p>
      <button
        type="button"
        className={`${styles.tile} ${fading ? styles.tileFade : ''}`}
        onClick={() => onOpenRestaurant?.(restaurant)}
        aria-label={`Ver ${restaurant.name}`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className={styles.photo} />
        ) : (
          <span className={styles.fallback} aria-hidden="true">
            {restaurant.name.charAt(0)}
          </span>
        )}

        <span className={styles.adelinas} aria-label={ratingLabel}>
          {ratingSlots.map((state, slotIndex) => (
            <AdelinaCoin
              key={slotIndex}
              size="sm"
              variant="review"
              alt=""
              className={state === 'full' ? styles.coinOn : styles.coinOff}
            />
          ))}
        </span>

        <span className={styles.name}>{restaurant.name}</span>
      </button>
    </article>
  )
}

export default RotatingRestaurantSpotlight

import { Link } from 'react-router-dom'
import AdelinaCoin from './AdelinaCoin'
import { formatDistanceKm } from '../utils/geo'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import styles from './RestaurantDiscoveryCard.module.css'

interface RestaurantDiscoveryCardProps {
  restaurant: PublicDiscoveryRestaurant
  reviewRating: number
  distanceKm?: number
  onOpen: (restaurant: PublicDiscoveryRestaurant) => void
}

function RestaurantDiscoveryCard({
  restaurant,
  reviewRating,
  distanceKm,
  onOpen,
}: RestaurantDiscoveryCardProps) {
  const imageUrl = restaurant.photoUrl
    ? optimizeCloudinaryUrl(restaurant.photoUrl, CLOUDINARY_DISPLAY.photoThumb)
    : ''
  const visibleCharacteristics = restaurant.characteristics.slice(0, 3)

  return (
    <article className={styles.card}>
      <button
        type="button"
        className={styles.openButton}
        onClick={() => onOpen(restaurant)}
        aria-label={`Ver ${restaurant.name}`}
      >
        <div
          className={styles.imageWrap}
          style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
        >
          {!imageUrl && <span className={styles.imageFallback}>{restaurant.name.charAt(0)}</span>}

          <span className={styles.reviewBadge} aria-label={`Valoración ${reviewRating.toFixed(1)} Adelinas de reseña`}>
            <AdelinaCoin size="sm" variant="review" alt="" />
            <span>{reviewRating.toFixed(1)}</span>
          </span>

          {typeof distanceKm === 'number' && (
            <span className={styles.distanceBadge}>{formatDistanceKm(distanceKm)}</span>
          )}

          <div className={styles.topOverlay}>
            <h3>{restaurant.name}</h3>
          </div>

          {visibleCharacteristics.length > 0 && (
            <div className={styles.bottomOverlay}>
              <div className={styles.tags}>
                {visibleCharacteristics.map((characteristic) => (
                  <span key={characteristic} className={styles.tag}>
                    {characteristic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </button>

      <Link to={`/reservar/${restaurant.slug}`} className={styles.reserveButton}>
        Reservar mesa
      </Link>
    </article>
  )
}

export default RestaurantDiscoveryCard

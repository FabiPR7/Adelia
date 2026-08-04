import AdelinaCoin from './AdelinaCoin'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import styles from './RestaurantDiscoveryCard.module.css'

interface RestaurantDiscoveryCardProps {
  restaurant: PublicDiscoveryRestaurant
  isFavorite?: boolean
  reviewRating: number
  onOpen: (restaurant: PublicDiscoveryRestaurant) => void
  onToggleFavorite?: (slug: string) => void
}

function RestaurantDiscoveryCard({
  restaurant,
  isFavorite = false,
  reviewRating,
  onOpen,
  onToggleFavorite,
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

      {onToggleFavorite && (
        <button
          type="button"
          className={`${styles.favoriteButton} ${isFavorite ? styles.favoriteButtonActive : ''}`}
          onClick={() => onToggleFavorite(restaurant.slug)}
          aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar favorito'}
        >
          {isFavorite ? '♥' : '♡'}
        </button>
      )}
    </article>
  )
}

export default RestaurantDiscoveryCard

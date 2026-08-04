import AdelinaCoin from './AdelinaCoin'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import { getMockReviewRating } from '../utils/mockReviewRating'
import styles from './DiscoveryListView.module.css'

interface DiscoveryListViewProps {
  restaurants: PublicDiscoveryRestaurant[]
  onOpenRestaurant: (restaurant: PublicDiscoveryRestaurant) => void
  isFavorite: (slug: string) => boolean
  onToggleFavorite: (slug: string) => void
}

function DiscoveryListView({
  restaurants,
  onOpenRestaurant,
  isFavorite,
  onToggleFavorite,
}: DiscoveryListViewProps) {
  return (
    <div className={styles.list}>
      {restaurants.map((restaurant) => {
        const imageUrl = restaurant.photoUrl
          ? optimizeCloudinaryUrl(restaurant.photoUrl, CLOUDINARY_DISPLAY.photoThumb)
          : ''
        const reviewRating = getMockReviewRating(restaurant.slug)

        return (
          <article key={restaurant.id} className={styles.item}>
            <button
              type="button"
              className={styles.openButton}
              onClick={() => onOpenRestaurant(restaurant)}
            >
              <div
                className={styles.thumb}
                style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
              >
                {!imageUrl && <span>{restaurant.name.charAt(0)}</span>}
              </div>

              <div className={styles.copy}>
                <div className={styles.titleRow}>
                  <h3>{restaurant.name}</h3>
                  <span className={styles.reviewBadge} aria-label={`Valoración ${reviewRating.toFixed(1)}`}>
                    <AdelinaCoin size="sm" variant="review" alt="" />
                    {reviewRating.toFixed(1)}
                  </span>
                </div>
                <p>{restaurant.municipality || restaurant.location}</p>
                {restaurant.characteristics[0] && (
                  <span className={styles.tag}>{restaurant.characteristics[0]}</span>
                )}
              </div>
            </button>

            <button
              type="button"
              className={`${styles.favorite} ${isFavorite(restaurant.slug) ? styles.favoriteActive : ''}`}
              onClick={() => onToggleFavorite(restaurant.slug)}
              aria-label="Favorito"
            >
              {isFavorite(restaurant.slug) ? '♥' : '♡'}
            </button>
          </article>
        )
      })}
    </div>
  )
}

export default DiscoveryListView

import { Link } from 'react-router-dom'
import DiscoveryRatingBadge from './DiscoveryRatingBadge'
import { formatDistanceKm } from '../utils/geo'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import {
  formatDiscoveryRatingBadge,
  type PublicDiscoveryRestaurant,
} from '../utils/publicDiscovery'
import FavoriteButton from './FavoriteButton'
import { getAmenityLabel, getVenueTypeLabel } from '../data/companyProfileFacilities'
import { restaurantReserveCtaLabel } from '../data/companyReservationMode'
import styles from './RestaurantDiscoveryCard.module.css'

interface RestaurantDiscoveryCardProps {
  restaurant: PublicDiscoveryRestaurant
  distanceKm?: number
  onOpen: (restaurant: PublicDiscoveryRestaurant) => void
}

function RestaurantDiscoveryCard({
  restaurant,
  distanceKm,
  onOpen,
}: RestaurantDiscoveryCardProps) {
  const imageUrl = restaurant.photoUrl
    ? optimizeCloudinaryUrl(restaurant.photoUrl, CLOUDINARY_DISPLAY.photoThumb)
    : ''
  const visibleTags = [
    ...restaurant.venueTypes.slice(0, 1).map(getVenueTypeLabel),
    ...restaurant.amenities.slice(0, 2).map(getAmenityLabel),
    ...restaurant.characteristics,
  ].slice(0, 3)
  const ratingBadge = formatDiscoveryRatingBadge(restaurant)

  return (
    <article className={styles.card}>
      <div
        className={styles.imageWrap}
        style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
      >
        <button
          type="button"
          className={styles.openButton}
          onClick={() => onOpen(restaurant)}
          aria-label={`Ver ${restaurant.name}`}
        />

        <FavoriteButton slug={restaurant.slug} name={restaurant.name} variant="overlay" />

        {!imageUrl && <span className={styles.imageFallback}>{restaurant.name.charAt(0)}</span>}

        {ratingBadge ? (
          <DiscoveryRatingBadge rating={ratingBadge} className={styles.reviewBadge} />
        ) : null}

        {typeof distanceKm === 'number' && (
          <span className={styles.distanceBadge}>{formatDistanceKm(distanceKm)}</span>
        )}

        <div className={styles.topOverlay}>
          <h3>{restaurant.name}</h3>
        </div>

        <div className={styles.footerOverlay}>
          {visibleTags.length > 0 ? (
            <div className={styles.tags}>
              {visibleTags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <Link
            to={`/reservar/${restaurant.slug}`}
            className={styles.reserveButton}
            onClick={(event) => event.stopPropagation()}
          >
            {restaurantReserveCtaLabel(restaurant.reservationMode)}
          </Link>
        </div>
      </div>
    </article>
  )
}

export default RestaurantDiscoveryCard

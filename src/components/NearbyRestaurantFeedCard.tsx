import FavoriteButton from './FavoriteButton'
import DiscoveryRatingBadge from './DiscoveryRatingBadge'
import { getAmenityLabel, getPriceRangeSymbol, getVenueTypeLabel } from '../data/companyProfileFacilities'
import { restaurantReserveCtaShortLabel } from '../data/companyReservationMode'
import { formatDistanceKm } from '../utils/geo'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import {
  formatDiscoveryRatingBadge,
  type PublicDiscoveryRestaurant,
} from '../utils/publicDiscovery'
import styles from './NearbyRestaurantFeedCard.module.css'

interface NearbyRestaurantFeedCardProps {
  restaurant: PublicDiscoveryRestaurant
  distanceKm?: number
  onOpen: (restaurant: PublicDiscoveryRestaurant) => void
}

function NearbyRestaurantFeedCard({
  restaurant,
  distanceKm,
  onOpen,
}: NearbyRestaurantFeedCardProps) {
  const photoUrl = restaurant.photoUrl
    ? optimizeCloudinaryUrl(restaurant.photoUrl, CLOUDINARY_DISPLAY.photoPreview)
    : ''
  const rating = formatDiscoveryRatingBadge(restaurant)
  const place = [restaurant.municipality, restaurant.location].filter(Boolean)[0] ?? ''
  const price = getPriceRangeSymbol(restaurant.priceRange)
  const tags = [
    ...restaurant.venueTypes.slice(0, 1).map(getVenueTypeLabel),
    ...restaurant.amenities.slice(0, 1).map(getAmenityLabel),
    ...restaurant.characteristics.slice(0, 1),
  ].filter(Boolean).slice(0, 2)

  return (
    <article className={styles.card}>
      <button
        type="button"
        className={styles.open}
        onClick={() => onOpen(restaurant)}
        aria-label={`Ver ${restaurant.name}`}
      >
        <span className={styles.photo} aria-hidden="true">
          {photoUrl ? (
            <img src={photoUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className={styles.fallback}>{restaurant.name.charAt(0).toUpperCase()}</span>
          )}
        </span>

        <span className={styles.body}>
          <span className={styles.kicker}>
            {typeof distanceKm === 'number' ? (
              <span className={styles.distance}>{formatDistanceKm(distanceKm)}</span>
            ) : (
              <span className={styles.placeHint}>{place || 'Cerca de ti'}</span>
            )}
            {price ? <span className={styles.price}>{price}</span> : null}
          </span>

          <strong className={styles.name}>{restaurant.name}</strong>

          {place && typeof distanceKm === 'number' ? (
            <span className={styles.place}>{place}</span>
          ) : null}

          {tags.length > 0 ? (
            <span className={styles.tags}>
              {tags.map((tag) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </span>
          ) : null}

          <span className={styles.cta}>{restaurantReserveCtaShortLabel(restaurant.reservationMode)}</span>
        </span>
      </button>

      <span className={styles.heart}>
        <FavoriteButton slug={restaurant.slug} name={restaurant.name} variant="overlay" />
      </span>

      {rating ? (
        <DiscoveryRatingBadge rating={rating} className={styles.rating} />
      ) : null}
    </article>
  )
}

export default NearbyRestaurantFeedCard

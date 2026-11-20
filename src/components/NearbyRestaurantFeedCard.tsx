import { useEffect } from 'react'
import { MapPin } from 'lucide-react'
import FavoriteButton from './FavoriteButton'
import DiscoveryRatingBadge from './DiscoveryRatingBadge'
import { getAmenityLabel, getPriceRangeSymbol, getVenueTypeLabel } from '../data/companyProfileFacilities'
import { formatDistanceKm } from '../utils/geo'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import {
  formatDiscoveryRatingBadge,
  type PublicDiscoveryRestaurant,
} from '../utils/publicDiscovery'
import { trackAppEvent } from '../utils/appEvents'
import { useRestaurantCollection, visitsForSlug } from '../services/restaurantCollection'
import styles from './NearbyRestaurantFeedCard.module.css'

interface NearbyRestaurantFeedCardProps {
  restaurant: PublicDiscoveryRestaurant
  distanceKm?: number
  onOpen: (restaurant: PublicDiscoveryRestaurant) => void
}

function prestige(level: number | undefined): { id: string; label: string } | null {
  if (!level || level < 4) return null
  if (level >= 9) return { id: 'diamond', label: 'Diamante' }
  if (level >= 7) return { id: 'gold', label: 'Oro' }
  return { id: 'silver', label: 'Plata' }
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
  const venue = restaurant.venueTypes.slice(0, 1).map(getVenueTypeLabel)[0] ?? ''
  const tags = [
    ...restaurant.amenities.slice(0, 2).map(getAmenityLabel),
    ...restaurant.characteristics.slice(0, 2),
  ].filter(Boolean).slice(0, 3)
  const hasDistance = typeof distanceKm === 'number'
  const tier = prestige(restaurant.prestigeLevel)
  // Tu mapa: borde verde donde ya has ido, oscuro donde aún no.
  const collection = useRestaurantCollection()
  const visits = visitsForSlug(collection, restaurant.slug)
  const visitClass = collection ? (visits > 0 ? styles.cardVisited : styles.cardNew) : ''

  useEffect(() => {
    if (restaurant.id) {
      trackAppEvent('search_impression', { companyId: restaurant.id, source: 'nearby' })
    }
  }, [restaurant.id])

  const open = () => {
    if (restaurant.id) {
      trackAppEvent('search_click', { companyId: restaurant.id, source: 'nearby' })
    }
    onOpen(restaurant)
  }

  return (
    <article className={`${styles.card} ${visitClass}`}>
      <button type="button" className={styles.open} onClick={open} aria-label={`Ver ${restaurant.name}`}>
        <span className={styles.media} aria-hidden="true">
          {photoUrl ? (
            <img className={styles.image} src={photoUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className={styles.fallback}>{restaurant.name.charAt(0).toUpperCase()}</span>
          )}
          {hasDistance ? <span className={styles.distance}>{formatDistanceKm(distanceKm)}</span> : null}
          {restaurant.discoveryFeatured ? <span className={styles.sponsored}>Patrocinado</span> : null}
          {collection ? (
            <span className={`${styles.visitPill} ${visits > 0 ? styles.visitPillDone : ''}`}>
              {visits > 0 ? `✓ Has ido${visits > 1 ? ` · ${visits}` : ''}` : 'Sin visitar'}
            </span>
          ) : null}
        </span>

        <span className={styles.body}>
          <span className={styles.topLine}>
            {venue ? <span className={styles.venue}>{venue}</span> : null}
            {tier ? (
              <span className={`${styles.level} ${styles[`level_${tier.id}`]}`}>
                Nv. {restaurant.prestigeLevel} · {tier.label}
              </span>
            ) : null}
          </span>

          <strong className={styles.name}>{restaurant.name}</strong>

          <span className={styles.meta}>
            {place ? (
              <span className={styles.place}>
                <MapPin size={13} aria-hidden="true" />
                {place}
              </span>
            ) : null}
            {price ? <span className={styles.price}>{price}</span> : null}
          </span>

          {tags.length > 0 ? (
            <span className={styles.tags}>
              {tags.map((tag) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </span>
          ) : null}

          <span className={styles.cta}>
            {restaurant.canReserve ? 'Reservar' : 'Ver restaurante'}
            <span aria-hidden="true">→</span>
          </span>
        </span>
      </button>

      <span className={styles.heart}>
        <FavoriteButton
          slug={restaurant.slug}
          name={restaurant.name}
          companyId={restaurant.id}
          variant="overlayEnd"
        />
      </span>

      {rating ? <DiscoveryRatingBadge rating={rating} className={styles.rating} /> : null}
    </article>
  )
}

export default NearbyRestaurantFeedCard

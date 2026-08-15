import { Link } from 'react-router-dom'
import DiscoveryRatingBadge from './DiscoveryRatingBadge'
import { formatDistanceKm } from '../utils/geo'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import {
  formatDiscoveryRatingBadge,
  type PublicDiscoveryRestaurant,
} from '../utils/publicDiscovery'
import styles from './RestaurantPreviewSheet.module.css'

interface RestaurantPreviewSheetProps {
  restaurant: PublicDiscoveryRestaurant | null
  distanceKm?: number
  onClose: () => void
}

async function shareRestaurant(restaurant: PublicDiscoveryRestaurant) {
  const url = `${window.location.origin}/reservar/${restaurant.slug}`
  const payload = {
    title: `${restaurant.name} · Adelia`,
    text: `Reserva en ${restaurant.name} con Adelia`,
    url,
  }

  if (navigator.share) {
    await navigator.share(payload)
    return
  }

  await navigator.clipboard.writeText(url)
}

function RestaurantPreviewSheet({
  restaurant,
  distanceKm,
  onClose,
}: RestaurantPreviewSheetProps) {
  if (!restaurant) {
    return null
  }

  const imageUrl = restaurant.photoUrl
    ? optimizeCloudinaryUrl(restaurant.photoUrl, CLOUDINARY_DISPLAY.photoGallery)
    : ''
  const ratingBadge = formatDiscoveryRatingBadge(restaurant)

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.sheet}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Vista previa de ${restaurant.name}`}
      >
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar">
          ×
        </button>

        <div
          className={styles.hero}
          style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
        >
          {!imageUrl && <span>{restaurant.name.charAt(0)}</span>}
          <span className={styles.heroBadge}>+XP al reservar</span>
        </div>

        <div className={styles.body}>
          <div className={styles.titleRow}>
            <div>
              <p className={styles.location}>
                {restaurant.municipality || restaurant.location}
                {typeof distanceKm === 'number' && (
                  <span className={styles.distance}> · {formatDistanceKm(distanceKm)}</span>
                )}
              </p>
              <h2>{restaurant.name}</h2>
            </div>
            <span className={styles.badge}>En Adelia</span>
          </div>

          {ratingBadge ? (
            <div className={styles.statsRow}>
              <DiscoveryRatingBadge rating={ratingBadge} className={styles.stat} size="md" />
            </div>
          ) : null}

          <p className={styles.hook}>
            Reserva hoy, puntúa después y escala en el ranking de foodies.
          </p>

          {restaurant.characteristics.length > 0 && (
            <div className={styles.tags}>
              {restaurant.characteristics.slice(0, 5).map((characteristic) => (
                <span key={characteristic} className={styles.tag}>
                  {characteristic}
                </span>
              ))}
            </div>
          )}

          <div className={styles.actions}>
            <Link to={`/reservar/${restaurant.slug}`} className={styles.primaryButton}>
              Reservar mesa ahora
            </Link>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => void shareRestaurant(restaurant)}
              aria-label="Compartir restaurante"
            >
              ↗ Compartir
            </button>
          </div>

          <Link to={`/reservar/${restaurant.slug}`} className={styles.secondaryLink}>
            Ver ficha completa del local
          </Link>
        </div>
      </div>
    </div>
  )
}

export default RestaurantPreviewSheet

import { Link } from 'react-router-dom'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import styles from './RestaurantPreviewSheet.module.css'

interface RestaurantPreviewSheetProps {
  restaurant: PublicDiscoveryRestaurant | null
  isFavorite: boolean
  onClose: () => void
  onToggleFavorite: () => void
}

async function shareRestaurant(restaurant: PublicDiscoveryRestaurant) {
  const url = `${window.location.origin}/reservar/${restaurant.slug}/restaurante`
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
  isFavorite,
  onClose,
  onToggleFavorite,
}: RestaurantPreviewSheetProps) {
  if (!restaurant) {
    return null
  }

  const imageUrl = restaurant.photoUrl
    ? optimizeCloudinaryUrl(restaurant.photoUrl, CLOUDINARY_DISPLAY.photoGallery)
    : ''

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
        </div>

        <div className={styles.body}>
          <div className={styles.titleRow}>
            <div>
              <p className={styles.location}>{restaurant.municipality || restaurant.location}</p>
              <h2>{restaurant.name}</h2>
            </div>
            <span className={styles.badge}>En Adelia</span>
          </div>

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
              Reservar mesa
            </Link>
            <button
              type="button"
              className={`${styles.iconButton} ${isFavorite ? styles.iconButtonActive : ''}`}
              onClick={onToggleFavorite}
              aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar favorito'}
            >
              {isFavorite ? '♥' : '♡'}
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => void shareRestaurant(restaurant)}
              aria-label="Compartir restaurante"
            >
              ↗
            </button>
          </div>

          <Link to={`/reservar/${restaurant.slug}/restaurante`} className={styles.secondaryLink}>
            Ver ficha completa
          </Link>
        </div>
      </div>
    </div>
  )
}

export default RestaurantPreviewSheet

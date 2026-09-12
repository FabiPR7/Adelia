import { useFavoriteRestaurants } from '../context/FavoriteRestaurantsContext'
import { trackAppEvent } from '../utils/appEvents'
import styles from './FavoriteButton.module.css'

interface FavoriteButtonProps {
  slug: string
  name: string
  /** Id del restaurante; si se pasa, registra el favorito en analítica. */
  companyId?: string
  variant?: 'overlay' | 'overlayEnd' | 'round' | 'chip'
  className?: string
}

function FavoriteButton({
  slug,
  name,
  companyId,
  variant = 'round',
  className = '',
}: FavoriteButtonProps) {
  const { isFavorite, isUpdatingFavorite, toggleFavorite } = useFavoriteRestaurants()
  const saved = isFavorite(slug)
  const updating = isUpdatingFavorite(slug)

  return (
    <button
      type="button"
      className={`${styles.button} ${styles[variant]} ${saved ? styles.on : ''} ${className}`.trim()}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (companyId) {
          trackAppEvent(saved ? 'favorite_remove' : 'favorite_add', { companyId })
        }
        void toggleFavorite(slug)
      }}
      aria-pressed={saved}
      aria-busy={updating}
      disabled={updating}
      aria-label={saved ? `Quitar ${name} de favoritos` : `Guardar ${name} en favoritos`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 20.4 10.35 18.9C5.4 14.4 2.1 11.4 2.1 7.8A4.35 4.35 0 0 1 6.6 3.3c1.5 0 2.94.69 3.9 1.8A5.1 5.1 0 0 1 14.4 3.3a4.35 4.35 0 0 1 4.5 4.5c0 3.6-3.3 6.6-8.25 11.1Z"
          fill={saved ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      {variant === 'chip' ? <span>{saved ? 'Guardado' : 'Favorito'}</span> : null}
    </button>
  )
}

export default FavoriteButton

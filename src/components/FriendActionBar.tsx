import styles from './FriendActionBar.module.css'

interface FriendActionBarProps {
  displayName: string
  isFavorite: boolean
  onProfile: () => void
  onToggleFavorite: () => void
  onRemove: () => void
}

function FriendActionBar({
  displayName,
  isFavorite,
  onProfile,
  onToggleFavorite,
  onRemove,
}: FriendActionBarProps) {
  return (
    <div className={styles.bar} role="toolbar" aria-label={`Acciones para ${displayName}`}>
      <button type="button" className={`${styles.action} ${styles.actionProfile}`} onClick={onProfile}>
        <span className={styles.iconWrap} aria-hidden="true">
          <svg viewBox="0 0 24 24" className={styles.icon}>
            <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.31 0-6 1.79-6 4v1h12v-1c0-2.21-2.69-4-6-4z" />
          </svg>
        </span>
        <span className={styles.label}>Perfil</span>
      </button>

      <button
        type="button"
        className={`${styles.action} ${styles.actionFavorite} ${isFavorite ? styles.actionFavoriteOn : ''}`}
        onClick={onToggleFavorite}
      >
        <span className={styles.iconWrap} aria-hidden="true">
          <svg viewBox="0 0 24 24" className={styles.icon}>
            <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        </span>
        <span className={styles.label}>{isFavorite ? 'Quitar' : 'Favorito'}</span>
      </button>

      <button type="button" className={`${styles.action} ${styles.actionRemove}`} onClick={onRemove}>
        <span className={styles.iconWrap} aria-hidden="true">
          <svg viewBox="0 0 24 24" className={styles.icon}>
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
        </span>
        <span className={styles.label}>Eliminar</span>
      </button>
    </div>
  )
}

export default FriendActionBar

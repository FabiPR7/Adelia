import { Link } from 'react-router-dom'
import styles from './EatNowButton.module.css'

/** Botón grande de «Comer ahora»: abre los sitios con mesa libre para ya. */
function EatNowButton({ className = '' }: { className?: string }) {
  return (
    <Link to="/ahora" className={`${styles.button} ${className}`}>
      <span className={styles.icon} aria-hidden="true">🍽️</span>
      <span className={styles.text}>
        <strong>Comer ahora</strong>
        <span>Sitios con mesa libre para ya mismo</span>
      </span>
      <span className={styles.arrow} aria-hidden="true">→</span>
    </Link>
  )
}

export default EatNowButton

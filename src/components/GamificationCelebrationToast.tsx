import type { CelebrationEvent, CelebrationKind } from '../utils/gamificationCelebration'
import styles from './GamificationCelebrationToast.module.css'

interface GamificationCelebrationToastProps {
  event: CelebrationEvent | null
  onDismiss: () => void
}

function iconForKind(kind: CelebrationKind): string {
  switch (kind) {
    case 'rank_up':
      return '🏆'
    case 'surpassed':
      return '⚔️'
    case 'level_up':
      return '👑'
    default:
      return '✨'
  }
}

function GamificationCelebrationToast({ event, onDismiss }: GamificationCelebrationToastProps) {
  if (!event) {
    return null
  }

  return (
    <div className={styles.overlay} role="presentation">
      <article
        className={`${styles.toast} ${styles[event.kind]}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className={styles.shine} aria-hidden="true" />
        <div className={styles.sparkles} aria-hidden="true">
          <span className={styles.sparkle} />
          <span className={styles.sparkle} />
          <span className={styles.sparkle} />
          <span className={styles.sparkle} />
        </div>

        <div className={styles.content}>
          <div className={styles.topRow}>
            <span className={styles.icon} aria-hidden="true">
              {iconForKind(event.kind)}
            </span>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onDismiss}
              aria-label="Cerrar celebración"
            >
              ×
            </button>
          </div>

          <h3 className={styles.title}>{event.title}</h3>
          <p className={styles.message}>{event.message}</p>

          {event.kind === 'rank_up' && event.previousRank && event.newRank && (
            <div className={styles.rankJump}>
              <span>#{event.previousRank}</span>
              <strong>→</strong>
              <strong>#{event.newRank}</strong>
            </div>
          )}

          <div className={styles.progressBar} aria-hidden="true">
            <div className={styles.progressFill} />
          </div>
        </div>
      </article>
    </div>
  )
}

export default GamificationCelebrationToast

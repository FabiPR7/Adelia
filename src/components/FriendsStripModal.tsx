import type { ReactNode } from 'react'
import styles from './FriendsStripModal.module.css'

export type FriendsStripModalVariant = 'notifications' | 'add'

interface FriendsStripModalProps {
  title: string
  subtitle?: string
  variant?: FriendsStripModalVariant
  badgeCount?: number
  onClose: () => void
  children: ReactNode
  emptyMessage?: string
  emptyHint?: string
  isEmpty?: boolean
}

function FriendsStripModal({
  title,
  subtitle,
  variant = 'add',
  badgeCount = 0,
  onClose,
  children,
  emptyMessage,
  emptyHint,
  isEmpty = false,
}: FriendsStripModalProps) {
  const variantClass = variant === 'notifications' ? styles.variantNotifications : styles.variantAdd

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={`${styles.modal} ${variantClass}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="friends-strip-modal-title"
      >
        <header className={styles.header}>
          <div className={styles.headerGlow} aria-hidden="true" />
          <div className={styles.headerMain}>
            <div className={styles.headerIconWrap} aria-hidden="true">
              {variant === 'notifications' ? (
                <span className={styles.headerIcon}>🔔</span>
              ) : (
                <svg viewBox="0 0 24 24" className={styles.headerSvg}>
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  <path d="M19 11h-2V9h-2v2h-2v2h2v2h2v-2h2z" />
                </svg>
              )}
            </div>
            <div className={styles.headerCopy}>
              <p className={styles.headerEyebrow}>
                {variant === 'notifications' ? 'Bandeja social' : 'Descubre foodies'}
              </p>
              <h2 id="friends-strip-modal-title">{title}</h2>
              {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
            </div>
          </div>
          <div className={styles.headerAside}>
            {variant === 'notifications' && badgeCount > 0 ? (
              <span className={styles.headerBadge}>{badgeCount} nueva{badgeCount === 1 ? '' : 's'}</span>
            ) : null}
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          </div>
        </header>

        <div className={styles.body}>
          {isEmpty ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconWrap} aria-hidden="true">
                {variant === 'notifications' ? '🤝' : '🔎'}
              </div>
              <p className={styles.emptyTitle}>{emptyMessage}</p>
              {emptyHint ? <p className={styles.emptyHint}>{emptyHint}</p> : null}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  )
}

export default FriendsStripModal

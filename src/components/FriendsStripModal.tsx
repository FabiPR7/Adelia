import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { getStripBackground, getStripEmblem } from '../utils/levelRankingStripAssets'
import { getLevelRankingStripTheme } from '../utils/levelRankingStripThemes'
import styles from './FriendsStripModal.module.css'

export type FriendsStripModalVariant = 'notifications' | 'add'

interface FriendsStripModalProps {
  title: string
  subtitle?: string
  variant?: FriendsStripModalVariant
  badgeCount?: number
  /** Tu nivel: la cabecera lleva la sala y el escudo de tu nivel. */
  level?: number
  onClose: () => void
  children: ReactNode
  emptyMessage?: string
  emptyHint?: string
  isEmpty?: boolean
}

/**
 * Ventana completa (hoja que sube desde abajo en móvil, centrada en escritorio)
 * para «Añadir amigos» y «Solicitudes», con la cabecera del tema de tu nivel.
 */
function FriendsStripModal({
  title,
  subtitle,
  variant = 'add',
  badgeCount = 0,
  level: rawLevel = 1,
  onClose,
  children,
  emptyMessage,
  emptyHint,
  isEmpty = false,
}: FriendsStripModalProps) {
  const level = Math.min(12, Math.max(1, rawLevel || 1))
  const theme = getLevelRankingStripTheme(level)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  const vars = {
    '--sheet-overlay': theme.overlay,
    '--sheet-border': theme.cardBorder,
    '--sheet-ring': theme.avatarBorder,
    '--sheet-title': theme.titleColor,
    '--sheet-bg': `url(${getStripBackground(level)})`,
  } as CSSProperties

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.sheet}
        style={vars}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="friends-sheet-title"
      >
        <span className={styles.grabber} aria-hidden="true" />
        <header className={styles.header}>
          <span className={styles.headerBg} aria-hidden="true" />
          <span className={styles.headerOverlay} aria-hidden="true" />
          <img src={getStripEmblem(level)} alt="" className={styles.headerShield} draggable={false} />
          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>
              {variant === 'notifications' ? '🔔 Bandeja social' : '🍽️ Tu mesa de amigos'}
            </p>
            <h2 id="friends-sheet-title">{title}</h2>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          {variant === 'notifications' && badgeCount > 0 ? (
            <span className={styles.badge}>{badgeCount}</span>
          ) : null}
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          {isEmpty ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIllustration} aria-hidden="true">
                {variant === 'notifications' ? '🥂' : '🔎'}
              </span>
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

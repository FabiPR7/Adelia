import type { CSSProperties } from 'react'
import { getLevelCardFrame, levelCardNeedsTextCover } from '../utils/levelCardAssets'
import { getLevelCardTheme } from '../utils/levelCardLayout'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import styles from './GamificationLevelFrameCard.module.css'

interface GamificationLevelFrameCardProps {
  level: number
  levelTitle: string
  displayName: string
  handle?: string
  photoUrl?: string
  xp: number
  rank?: number
  levelProgress?: number
  showProgress?: boolean
  highlight?: boolean
  className?: string
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function rankLabel(rank: number): string {
  if (rank === 1) return '🥇 #1'
  if (rank === 2) return '🥈 #2'
  if (rank === 3) return '🥉 #3'
  return `#${rank}`
}

function GamificationLevelFrameCard({
  level,
  levelTitle,
  displayName,
  handle,
  photoUrl,
  xp,
  rank,
  levelProgress,
  showProgress = false,
  highlight = false,
  className = '',
}: GamificationLevelFrameCardProps) {
  const frame = getLevelCardFrame(level)
  const theme = getLevelCardTheme(level)
  const needsTextCover = levelCardNeedsTextCover(level)
  const { layout } = theme
  const levelClass = `level${Math.min(Math.max(level, 1), 12)}`
  const progressPercent =
    levelProgress == null ? null : Math.min(100, Math.max(0, Math.round(levelProgress * 100)))

  const cssVars = {
    '--avatar-left': layout.avatarLeft,
    '--avatar-top': layout.avatarTop,
    '--avatar-size': layout.avatarSize,
    '--identity-left': layout.identityLeft,
    '--identity-top': layout.identityTop,
    '--identity-width': layout.identityWidth,
    '--pill-left': layout.pillLeft,
    '--pill-bottom': layout.pillBottom,
    '--pill-width': layout.pillWidth,
    '--pill-height': layout.pillHeight,
    '--xp-right': layout.xpRight,
    '--xp-bottom': layout.xpBottom,
    '--xp-width': layout.xpWidth,
    '--xp-height': layout.xpHeight,
    '--name-color': theme.nameColor,
    '--handle-color': theme.handleColor,
    '--pill-number-bg': theme.pillNumberBg,
    '--pill-number-color': theme.pillNumberColor,
    '--pill-title-bg': theme.pillTitleBg,
    '--pill-title-color': theme.pillTitleColor,
    '--xp-bg': theme.xpCover,
    '--xp-color': theme.xpColor,
    '--identity-cover': theme.identityCover,
  } as CSSProperties

  return (
    <article
      className={`${styles.wrap} ${styles[levelClass]} ${highlight ? styles.highlight : ''} ${needsTextCover ? styles.textCover : ''} ${className}`}
      style={cssVars}
    >
      <div className={styles.frame}>
        <img src={frame} alt="" className={styles.frameArt} draggable={false} decoding="async" />

        {rank != null && (
          <div className={styles.rankBadge} aria-label={`Posición ${rank}`}>
            {rankLabel(rank)}
          </div>
        )}

        <div className={styles.avatarSlot}>
          {photoUrl ? (
            <img
              src={optimizeCloudinaryUrl(photoUrl, CLOUDINARY_DISPLAY.logo)}
              alt=""
              className={styles.avatarPhoto}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className={styles.avatarInitials}>{initials(displayName)}</span>
          )}
        </div>

        <div className={styles.identity}>
          {needsTextCover ? <div className={styles.identityCover} aria-hidden="true" /> : null}
          <p className={styles.displayName}>{displayName}</p>
          {handle ? <p className={styles.handle}>{handle}</p> : null}
        </div>

        <div className={styles.levelPill} aria-label={`Nivel ${level}, ${levelTitle}`}>
          <span className={styles.levelNumber}>NIVEL {level}</span>
          <span className={styles.levelTitle}>{levelTitle}</span>
        </div>

        <div className={styles.xpSlot}>
          <p className={styles.xpValue}>{xp.toLocaleString('es-ES')} XP</p>
        </div>
      </div>

      {showProgress && progressPercent != null && (
        <div className={styles.progressWrap}>
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
          </div>
          <span>{progressPercent}% al siguiente nivel</span>
        </div>
      )}
    </article>
  )
}

export default GamificationLevelFrameCard

import type { CSSProperties } from 'react'
import {
  getStripBackground,
  getStripEmblem,
  getStripEmblemBlendMode,
} from '../utils/levelRankingStripAssets'
import { getLevelRankingStripTheme } from '../utils/levelRankingStripThemes'
import StripDynamicName from './StripDynamicName'
import StripLevelTitle from './StripLevelTitle'
import StripRankBadge from './StripRankBadge'
import styles from './GamificationRankingStripCard.module.css'

interface GamificationRankingStripCardProps {
  level: number
  levelTitle: string
  displayName: string
  xp: number
  levelProgress?: number
  rank?: number
  photoUrl?: string
  highlight?: boolean
  profileSize?: boolean
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

function GamificationRankingStripCard({
  level,
  levelTitle,
  displayName,
  xp,
  levelProgress = 0.5,
  rank,
  photoUrl,
  highlight = false,
  profileSize = false,
  className = '',
}: GamificationRankingStripCardProps) {
  const theme = getLevelRankingStripTheme(level)
  const background = getStripBackground(level)
  const emblem = getStripEmblem(level)
  const emblemBlend = getStripEmblemBlendMode(level)
  const progressPercent = Math.min(100, Math.max(8, Math.round(levelProgress * 100)))
  const levelClass = `level${Math.min(Math.max(level, 1), 12)}`

  const cssVars = {
    '--strip-overlay': theme.overlay,
    '--strip-border': theme.cardBorder,
    '--strip-xp-track': theme.xpTrack,
    '--strip-xp-fill': theme.xpFill,
    '--strip-xp-label': theme.xpLabelColor,
    '--strip-avatar-border': theme.avatarBorder,
    '--strip-emblem-blend': emblemBlend,
  } as CSSProperties

  return (
    <article
      className={`${styles.strip} ${styles[levelClass]} ${highlight ? styles.highlight : ''} ${profileSize ? styles.profileSize : ''} ${className}`}
      style={cssVars}
      aria-label={`${displayName}, ${levelTitle}, ${xp.toLocaleString('es-ES')} XP`}
    >
      <img src={background} alt="" className={styles.bgArt} draggable={false} />
      <div className={styles.bgOverlay} aria-hidden="true" />

      <div className={styles.row}>
        <div className={styles.avatar}>
          {photoUrl ? (
            <img src={photoUrl} alt="" className={styles.avatarPhoto} />
          ) : (
            <span className={styles.avatarInitials}>{initials(displayName)}</span>
          )}
        </div>

        <div className={styles.body}>
          <StripLevelTitle level={level} levelTitle={levelTitle} />

          <div className={styles.centerStack}>
            <div className={styles.nameRow}>
              {rank != null ? <StripRankBadge rank={rank} level={level} /> : null}
              <StripDynamicName level={level} displayName={displayName} />
            </div>

            <div
              className={styles.xpBar}
              aria-label={`${xp.toLocaleString('es-ES')} puntos de experiencia`}
            >
              <div className={styles.xpTrack}>
                <div className={styles.xpFill} style={{ width: `${progressPercent}%` }} />
              </div>
              <span className={styles.xpLabel}>{xp.toLocaleString('es-ES')} XP</span>
            </div>
          </div>
        </div>

        <div className={styles.emblemWrap}>
          <img src={emblem} alt="" className={styles.emblemArt} draggable={false} aria-hidden="true" />
        </div>
      </div>
    </article>
  )
}

export default GamificationRankingStripCard

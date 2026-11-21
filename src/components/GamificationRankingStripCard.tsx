import type { CSSProperties } from 'react'
import { MEDAL_PALETTES, levelMedalTier } from '../data/achievementMedal'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import LevelEmblem from './LevelEmblem'
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

/**
 * Tira de un jugador en Compite: puesto, foto con aro del metal de su nivel, nombre,
 * rango y XP. El fondo es un cristal oscuro teñido de su metal (bronce, plata, oro o
 * legendario); los 3 primeros llevan el puesto en oro, plata y bronce.
 */
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
  const tier = levelMedalTier(level)
  const palette = MEDAL_PALETTES[tier]
  const progressPercent = Math.min(100, Math.max(6, Math.round(levelProgress * 100)))
  const podium = rank != null && rank <= 3 ? rank : null

  const vars = {
    '--strip-rim-a': palette.rim[0],
    '--strip-rim-b': palette.rim[1],
    '--strip-rim-c': palette.rim[2],
    '--strip-glow': palette.glow,
  } as CSSProperties

  return (
    <article
      className={`${styles.strip} ${styles[`tier_${tier}`]} ${highlight ? styles.highlight : ''} ${profileSize ? styles.profileSize : ''} ${className}`}
      style={vars}
      aria-label={`${rank != null ? `Puesto ${rank}, ` : ''}${displayName}, ${levelTitle}, ${xp.toLocaleString('es-ES')} XP`}
    >
      <span className={styles.sheen} aria-hidden="true" />

      {rank != null ? (
        <span className={`${styles.rank} ${podium ? styles[`podium${podium}`] : ''}`} aria-hidden="true">
          {podium ? <span className={styles.crown}>{podium === 1 ? '👑' : ''}</span> : null}
          {rank}
        </span>
      ) : null}

      <span className={styles.avatar}>
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
      </span>

      <span className={styles.body}>
        <span className={styles.name}>{displayName}</span>
        <span className={styles.title}>{levelTitle}</span>
        <span className={styles.xpRow}>
          <span className={styles.xpTrack} aria-hidden="true">
            <span className={styles.xpFill} style={{ width: `${progressPercent}%` }} />
          </span>
          <span className={styles.xp}>{xp.toLocaleString('es-ES')} XP</span>
        </span>
      </span>

      <LevelEmblem level={level} size={profileSize ? 64 : 48} />
    </article>
  )
}

export default GamificationRankingStripCard

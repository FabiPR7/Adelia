import type { AchievementBadgeArt } from '../data/achievementBadgeArt'
import styles from './AchievementBadgeIcon.module.css'

interface AchievementBadgeIconProps {
  art: AchievementBadgeArt
  earned: boolean
}

function AchievementBadgeIcon({ art, earned }: AchievementBadgeIconProps) {
  const shapeClass =
    art.shape === 'shield'
      ? styles.shapeShield
      : art.shape === 'hex'
        ? styles.shapeHex
        : art.shape === 'star'
          ? styles.shapeStar
          : art.shape === 'diamond'
            ? styles.shapeDiamond
            : styles.shapeCircle

  return (
    <div
      className={`${styles.medallion} ${shapeClass} ${earned ? styles.earned : styles.locked}`}
      aria-hidden="true"
    >
      <span className={styles.rimGlow} />
      <span className={styles.glyph}>{art.glyph}</span>
      {!earned && <span className={styles.lockMark}>🔒</span>}
    </div>
  )
}

export default AchievementBadgeIcon

import { getLevelRankingNameCss } from '../utils/levelRankingNameStyles'
import styles from './StripRankBadge.module.css'

interface StripRankBadgeProps {
  rank: number
  level: number
}

function StripRankBadge({ rank, level }: StripRankBadgeProps) {
  if (rank === 1) {
    return (
      <span className={styles.medalWrap} aria-hidden="true">
        <span className={styles.medalEmoji}>🥇</span>
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className={styles.medalWrap} aria-hidden="true">
        <span className={styles.medalEmoji}>🥈</span>
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className={styles.medalWrap} aria-hidden="true">
        <span className={styles.medalEmoji}>🥉</span>
      </span>
    )
  }

  const css = getLevelRankingNameCss(level)
  const label = `#${rank}`
  const fontSizeRem = rank >= 10 ? css.fontSizeRem * 0.82 : css.fontSizeRem * 0.92

  return (
    <span className={styles.rankWrap} aria-hidden="true">
      <span
        className={styles.stack}
        style={{
          fontSize: `${fontSizeRem}rem`,
          letterSpacing: css.letterSpacing,
        }}
      >
        <span
          className={styles.outline}
          style={{ WebkitTextStroke: `${css.strokeWidthPx}px ${css.strokeColor}` }}
        >
          {label}
        </span>
        <span className={styles.fill} style={{ backgroundImage: css.gradient }}>
          {label}
        </span>
        <span
          className={styles.shine}
          style={{
            backgroundImage: `linear-gradient(180deg, ${css.highlightColor}cc 0%, transparent 50%)`,
          }}
        >
          {label}
        </span>
      </span>
    </span>
  )
}

export default StripRankBadge

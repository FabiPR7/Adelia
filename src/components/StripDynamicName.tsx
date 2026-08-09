import { getLevelRankingNameCss } from '../utils/levelRankingNameStyles'
import styles from './StripDynamicName.module.css'

interface StripDynamicNameProps {
  level: number
  displayName: string
}

function StripDynamicName({ level, displayName }: StripDynamicNameProps) {
  const css = getLevelRankingNameCss(level)
  const text = displayName.toUpperCase()

  return (
    <span className={styles.wrap}>
      <span
        className={styles.stack}
        style={{
          fontSize: `${css.fontSizeRem}rem`,
          letterSpacing: css.letterSpacing,
        }}
      >
        <span
          className={styles.outline}
          style={{
            WebkitTextStroke: `${css.strokeWidthPx}px ${css.strokeColor}`,
          }}
          aria-hidden="true"
        >
          {text}
        </span>
        <span
          className={styles.fill}
          style={{ backgroundImage: css.gradient }}
          aria-hidden="true"
        >
          {text}
        </span>
        <span
          className={styles.shine}
          style={{
            backgroundImage: `linear-gradient(180deg, ${css.highlightColor}cc 0%, transparent 48%)`,
          }}
          aria-hidden="true"
        >
          {text}
        </span>
      </span>
      <span className={styles.srOnly}>{displayName}</span>
    </span>
  )
}

export default StripDynamicName

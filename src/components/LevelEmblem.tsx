import { useId } from 'react'
import { MEDAL_PALETTES, levelMedalTier, medalPaths, MEDAL_RIBBONS, medalHasRibbons } from '../data/achievementMedal'
import styles from './LevelEmblem.module.css'

/** Escudo de nivel: el metal sube con el nivel (bronce → plata → oro → legendario). */
function LevelEmblem({ level, size = 96 }: { level: number; size?: number }) {
  const uid = useId().replace(/:/g, '')
  const tier = levelMedalTier(level)
  const palette = MEDAL_PALETTES[tier]
  const { outer, inner } = medalPaths('shield')

  return (
    <span className={`${styles.emblem} ${styles[`tier_${tier}`]}`} style={{ width: size, height: size, ['--emblem-glow' as string]: palette.glow }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={`lr-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={palette.rim[0]} />
            <stop offset="0.45" stopColor={palette.rim[1]} />
            <stop offset="1" stopColor={palette.rim[2]} />
          </linearGradient>
          <radialGradient id={`lf-${uid}`} cx="0.5" cy="0.28" r="0.8">
            <stop offset="0" stopColor={palette.face[0]} />
            <stop offset="1" stopColor={palette.face[1]} />
          </radialGradient>
          <linearGradient id={`lb-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={palette.ribbon[0]} />
            <stop offset="1" stopColor={palette.ribbon[1]} />
          </linearGradient>
          <clipPath id={`lc-${uid}`}>
            <path d={outer} />
          </clipPath>
        </defs>
        {medalHasRibbons(tier) ? (
          <g>
            <path d={MEDAL_RIBBONS.left} fill={`url(#lb-${uid})`} />
            <path d={MEDAL_RIBBONS.right} fill={`url(#lb-${uid})`} />
          </g>
        ) : null}
        <path d={outer} fill={`url(#lr-${uid})`} />
        <path d={inner} fill={`url(#lf-${uid})`} />
        <text x="50" y="35" textAnchor="middle" className={styles.caption} fill={palette.glyph}>NIVEL</text>
        <text x="50" y="66" textAnchor="middle" className={styles.number} fill={palette.glyph}>{level}</text>
        <g clipPath={`url(#lc-${uid})`}>
          <ellipse cx="38" cy="18" rx="32" ry="14" fill="rgba(255, 255, 255, 0.18)" />
          <rect className={styles.shine} x="-60" y="-10" width="24" height="130" fill="rgba(255, 255, 255, 0.4)" />
        </g>
      </svg>
    </span>
  )
}

export default LevelEmblem

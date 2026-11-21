import { useId } from 'react'
import type { AchievementBadgeArt } from '../data/achievementBadgeArt'
import { achievementGlyphFor } from '../data/achievementGlyphs'
import {
  MEDAL_CENTER,
  MEDAL_GLYPH,
  MEDAL_PALETTES,
  MEDAL_PROGRESS_RADIUS,
  MEDAL_RIBBONS,
  MEDAL_TIER_BY_DIFFICULTY,
  medalHasRibbons,
  medalPaths,
} from '../data/achievementMedal'
import styles from './AchievementMedal.module.css'

/**
 * Medalla de un logro dibujada en SVG: borde metálico (bronce, plata, oro o
 * legendaria según lo difícil que es), cara con el icono grabado, cintas en las
 * grandes y, si aún no la tienes, apagada con un anillo de progreso.
 */
function AchievementMedal({
  missionId,
  art,
  earned,
  progress = 0,
  size = 88,
}: {
  missionId: string
  art: AchievementBadgeArt
  earned: boolean
  /** De 0 a 1, para el anillo de las bloqueadas. */
  progress?: number
  size?: number
}) {
  const uid = useId().replace(/:/g, '')
  const tier = MEDAL_TIER_BY_DIFFICULTY[art.difficulty]
  const palette = MEDAL_PALETTES[earned ? tier : 'locked']
  const { outer, inner } = medalPaths(art.shape)
  const glyph = achievementGlyphFor(missionId, art.category)
  const circumference = 2 * Math.PI * MEDAL_PROGRESS_RADIUS
  const clamped = Math.min(1, Math.max(0, progress))
  const ribbons = medalHasRibbons(tier)

  return (
    <span
      className={`${styles.medal} ${earned ? styles.earned : styles.locked} ${styles[`tier_${tier}`]}`}
      style={{ width: size, height: size, ['--medal-glow' as string]: palette.glow }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" width={size} height={size} className={styles.svg}>
        <defs>
          <linearGradient id={`rim-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={palette.rim[0]} />
            <stop offset="0.45" stopColor={palette.rim[1]} />
            <stop offset="1" stopColor={palette.rim[2]} />
          </linearGradient>
          <linearGradient id={`rim2-${uid}`} x1="1" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={palette.rim[0]} />
            <stop offset="0.5" stopColor={palette.rim[1]} />
            <stop offset="1" stopColor={palette.rim[2]} />
          </linearGradient>
          <radialGradient id={`face-${uid}`} cx="0.5" cy="0.3" r="0.75">
            <stop offset="0" stopColor={palette.face[0]} />
            <stop offset="1" stopColor={palette.face[1]} />
          </radialGradient>
          <linearGradient id={`ribbon-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={palette.ribbon[0]} />
            <stop offset="1" stopColor={palette.ribbon[1]} />
          </linearGradient>
          <clipPath id={`clip-${uid}`}>
            <path d={outer} />
          </clipPath>
        </defs>

        {ribbons ? (
          <g className={styles.ribbons}>
            <path d={MEDAL_RIBBONS.left} fill={`url(#ribbon-${uid})`} />
            <path d={MEDAL_RIBBONS.right} fill={`url(#ribbon-${uid})`} />
          </g>
        ) : null}

        {!earned ? (
          <g transform={`rotate(-90 ${MEDAL_CENTER.x} ${MEDAL_CENTER.y})`}>
            <circle
              cx={MEDAL_CENTER.x}
              cy={MEDAL_CENTER.y}
              r={MEDAL_PROGRESS_RADIUS}
              fill="none"
              stroke="rgba(255, 248, 239, 0.1)"
              strokeWidth="3"
            />
            {clamped > 0 ? (
              <circle
                cx={MEDAL_CENTER.x}
                cy={MEDAL_CENTER.y}
                r={MEDAL_PROGRESS_RADIUS}
                fill="none"
                stroke="#e9a133"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference * (1 - clamped)}
              />
            ) : null}
          </g>
        ) : null}

        {/* Borde metálico con bisel: dos degradados cruzados. */}
        <path d={outer} fill={`url(#rim-${uid})`} />
        <path
          d={inner}
          fill="none"
          stroke={`url(#rim2-${uid})`}
          strokeWidth="5"
          transform={`translate(${MEDAL_CENTER.x} ${MEDAL_CENTER.y}) scale(1.04) translate(${-MEDAL_CENTER.x} ${-MEDAL_CENTER.y})`}
        />
        <path d={inner} fill={`url(#face-${uid})`} />

        {/* Icono grabado: sombra abajo y relieve encima. */}
        <g
          transform={`translate(${MEDAL_GLYPH.x} ${MEDAL_GLYPH.y + 1.2}) scale(${MEDAL_GLYPH.scale})`}
          fill="none"
          stroke={palette.engrave}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {glyph.map(([tag, attrs], index) => {
            const Tag = tag
            return <Tag key={index} {...attrs} />
          })}
        </g>
        <g
          transform={`translate(${MEDAL_GLYPH.x} ${MEDAL_GLYPH.y}) scale(${MEDAL_GLYPH.scale})`}
          fill="none"
          stroke={palette.glyph}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {glyph.map(([tag, attrs], index) => {
            const Tag = tag
            return <Tag key={index} {...attrs} />
          })}
        </g>

        {/* Reflejo de luz arriba y destello que cruza (solo ganadas). */}
        <g clipPath={`url(#clip-${uid})`}>
          <ellipse cx="38" cy="22" rx="30" ry="14" fill="rgba(255, 255, 255, 0.16)" />
          {earned ? <rect className={styles.shine} x="-60" y="-10" width="26" height="130" fill="rgba(255, 255, 255, 0.45)" /> : null}
        </g>
      </svg>
      {!earned ? (
        <span className={styles.lock}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
      ) : null}
    </span>
  )
}

export default AchievementMedal

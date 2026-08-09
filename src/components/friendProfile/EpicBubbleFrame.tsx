import type { ElementType, ReactNode } from 'react'
import CardFlameLayer from './CardFlameLayer'
import EpicBubbleOrnament, { type EpicBubbleOrnamentType } from './EpicBubbleOrnament'
import styles from './EpicBubbleFrame.module.css'

const BUBBLE_DIAMOND_SPARKS = [
  { top: '14%', left: '16%', delay: 0 },
  { top: '22%', left: '78%', delay: 0.4 },
  { top: '62%', left: '10%', delay: 0.9 },
  { top: '72%', left: '84%', delay: 1.2 },
  { top: '38%', left: '48%', delay: 1.6 },
  { top: '86%', left: '52%', delay: 2.1 },
] as const

interface EpicBubbleFrameProps {
  children: ReactNode
  className?: string
  innerClassName?: string
  ornament?: EpicBubbleOrnamentType | string
  variant?: 'default' | 'pill' | 'stat' | 'panel'
  level?: number
  sparkles?: boolean
  shimmer?: boolean
  as?: ElementType
  'aria-label'?: string
}

function EpicBubbleFrame({
  children,
  className = '',
  innerClassName = '',
  ornament = 'default',
  variant = 'default',
  level,
  sparkles = false,
  shimmer = true,
  as: Component = 'div',
  'aria-label': ariaLabel,
}: EpicBubbleFrameProps) {
  const variantClass =
    variant === 'pill'
      ? styles.variantPill
      : variant === 'stat'
        ? styles.variantStat
        : variant === 'panel'
          ? styles.variantPanel
          : ''

  const ambientClass =
    level === 10 ? styles.ambientSnow : level === 11 ? styles.ambientDiamond : level === 12 ? styles.ambientFire : ''

  const showSparkles = sparkles || level === 11
  const isCompactFlame = variant === 'pill' || variant === 'stat'

  return (
    <Component
      className={`${styles.frameWrap} ${variantClass} ${ambientClass} ${className}`.trim()}
      aria-label={ariaLabel}
    >
      <div className={`${styles.outerFrame} epicBubbleOuter`}>
        <span className={styles.cornerDecor} data-pos="tl" aria-hidden="true">
          <EpicBubbleOrnament type={ornament} className={styles.ornamentSvg} />
        </span>
        <span className={styles.cornerDecor} data-pos="tr" aria-hidden="true">
          <EpicBubbleOrnament type={ornament} className={styles.ornamentSvg} />
        </span>
        <span className={styles.cornerDecor} data-pos="bl" aria-hidden="true">
          <EpicBubbleOrnament type={ornament} className={styles.ornamentSvg} />
        </span>
        <span className={styles.cornerDecor} data-pos="br" aria-hidden="true">
          <EpicBubbleOrnament type={ornament} className={styles.ornamentSvg} />
        </span>

        <div className={`${styles.innerPlate} epicBubbleInner`.trim()}>
          {level === 12 ? <CardFlameLayer compact={isCompactFlame} /> : null}
          <span className={styles.topRidge} aria-hidden="true" />
          <span className={styles.sideGlint} aria-hidden="true" />
          <div className={`${styles.contentLayer} ${innerClassName}`.trim()}>{children}</div>
          {shimmer ? <span className={styles.shimmerPass} aria-hidden="true" /> : null}
          {showSparkles ? <span className={styles.sparkleField} aria-hidden="true" /> : null}
          {level === 11 ? <span className={styles.diamondField} aria-hidden="true" /> : null}
          {level === 11
            ? BUBBLE_DIAMOND_SPARKS.map((spark, index) => (
                <span
                  key={index}
                  className={styles.bubbleMiniSpark}
                  style={{ top: spark.top, left: spark.left, animationDelay: `${spark.delay}s` }}
                  aria-hidden="true"
                />
              ))
            : null}
        </div>
      </div>
    </Component>
  )
}

export default EpicBubbleFrame

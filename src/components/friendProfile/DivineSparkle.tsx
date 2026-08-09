import type { CSSProperties } from 'react'
import styles from './DivineSparkle.module.css'

export type DivineSparkleSize = 'xs' | 'sm' | 'md' | 'lg'

interface DivineSparkleProps {
  size?: DivineSparkleSize
  /** Destello largo con rayos más visibles */
  bright?: boolean
  className?: string
  style?: CSSProperties
}

/** Estrella de 4 puntas con núcleo + rayos (técnica diffraction spike). */
function DivineSparkle({ size = 'sm', bright = false, className = '', style }: DivineSparkleProps) {
  return (
    <span
      className={`${styles.sparkle} ${styles[size]} ${bright ? styles.bright : ''} ${className}`.trim()}
      style={style}
      aria-hidden="true"
    />
  )
}

export default DivineSparkle

import { useMemo } from 'react'
import DivineSparkle from './DivineSparkle'
import styles from './CardSparkleLayer.module.css'

interface CardSparkleLayerProps {
  compact?: boolean
}

const SPARK_COUNT = 14
const COMPACT_COUNT = 8

/** Destellos dorados sobre las llamas — estrellas de 4 puntas con twinkle independiente. */
function CardSparkleLayer({ compact = false }: CardSparkleLayerProps) {
  const sparks = useMemo(() => {
    const count = compact ? COMPACT_COUNT : SPARK_COUNT
    return Array.from({ length: count }, (_, index) => ({
      id: index,
      left: `${8 + ((index * 17.3 + 5) % 84)}%`,
      bottom: `${4 + (index % 5) * 3.5}%`,
      size: (index % 5 === 0 ? 'md' : index % 3 === 0 ? 'sm' : 'xs') as 'xs' | 'sm' | 'md',
      bright: index % 4 === 0,
      delay: (index * 0.47) % 3.2,
      duration: 1.1 + (index % 4) * 0.35,
      rise: index % 2 === 0,
    }))
  }, [compact])

  return (
    <div className={`${styles.layer} ${compact ? styles.layerCompact : ''}`} aria-hidden="true">
      {sparks.map((spark) => (
        <span
          key={spark.id}
          className={`${styles.sparkWrap} ${spark.rise ? styles.sparkRise : styles.sparkTwinkle}`}
          style={{
            left: spark.left,
            bottom: spark.bottom,
            animationDuration: `${spark.duration}s`,
            animationDelay: `${spark.delay}s`,
          }}
        >
          <DivineSparkle size={spark.size} bright={spark.bright} />
        </span>
      ))}
    </div>
  )
}

export default CardSparkleLayer

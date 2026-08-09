import { useMemo } from 'react'
import DivineSparkle from './DivineSparkle'
import styles from './LevelProfileAmbientEffects.module.css'

interface LevelProfileAmbientEffectsProps {
  level: number
}

const SNOWFLAKE_COUNT = 26
const DIAMOND_COUNT = 52
const DIAMOND_FLASH_COUNT = 10
const DIVINE_SPARK_COUNT = 46
const DIVINE_MEGA_COUNT = 12
const DIVINE_EMBER_COUNT = 18

type DiamondVariant = 'diamond' | 'star' | 'cross' | 'ring' | 'mega'

function SnowflakeIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 2v20M4.5 7.5l15 9M4.5 16.5l15-9M2 12h20M7.5 4.5l9 15M16.5 4.5l-9 15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function DiamondIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2.5l8.5 7.5L12 21.5 3.5 10 12 2.5z" fill="#fdf4ff" />
      <path d="M12 2.5l8.5 7.5L12 21.5 3.5 10 12 2.5z" fill="#e879f9" opacity="0.55" />
      <path d="M3.5 10h17M8 6.5l8 11M16 6.5l-8 11" stroke="rgba(255,255,255,0.85)" strokeWidth="0.9" fill="none" />
    </svg>
  )
}

function CrossSparkleIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M12 6l1.8 3.2L17 11l-3.2 1.8L12 16l-1.8-3.2L7 11l3.2-1.8L12 6z" fill="currentColor" opacity="0.85" />
    </svg>
  )
}

function variantClass(variant: DiamondVariant): string {
  if (variant === 'star') return styles.sparkStar
  if (variant === 'cross') return styles.sparkCross
  if (variant === 'ring') return styles.sparkRing
  if (variant === 'mega') return styles.sparkMega
  return styles.sparkDiamond
}

function LevelProfileAmbientEffects({ level }: LevelProfileAmbientEffectsProps) {
  const snowflakes = useMemo(
    () =>
      Array.from({ length: SNOWFLAKE_COUNT }, (_, index) => ({
        id: index,
        left: `${(index * 13.7 + 4) % 98}%`,
        size: 0.55 + (index % 4) * 0.22,
        delay: (index % 9) * 0.65,
        duration: 9 + (index % 5) * 2.4,
        drift: index % 2 === 0 ? 'driftLeft' : 'driftRight',
        opacity: 0.35 + (index % 3) * 0.18,
      })),
    [],
  )

  const diamonds = useMemo(() => {
    const variants: DiamondVariant[] = ['diamond', 'star', 'cross', 'ring', 'diamond', 'cross', 'star']
    return Array.from({ length: DIAMOND_COUNT }, (_, index) => ({
      id: index,
      left: `${(index * 19.3 + 3) % 97}%`,
      top: `${(index * 27.7 + 5) % 95}%`,
      size: 0.42 + (index % 5) * 0.28 + (index % 7 === 0 ? 0.35 : 0),
      delay: (index * 0.31) % 4.2,
      duration: 1.35 + (index % 6) * 0.45,
      variant: variants[index % variants.length] as DiamondVariant,
    }))
  }, [])

  const diamondFlashes = useMemo(
    () =>
      Array.from({ length: DIAMOND_FLASH_COUNT }, (_, index) => ({
        id: index,
        left: `${(index * 29 + 8) % 90}%`,
        top: `${(index * 37 + 12) % 85}%`,
        size: 1.6 + (index % 3) * 0.55,
        delay: index * 0.85,
        duration: 2.4 + (index % 4) * 0.6,
      })),
    [],
  )

  const divineSparks = useMemo(
    () =>
      Array.from({ length: DIVINE_SPARK_COUNT }, (_, index) => ({
        id: index,
        left: `${(index * 21.7 + 4) % 96}%`,
        top: `${(index * 31.3 + 8) % 92}%`,
        size: (index % 7 === 0 ? 'md' : index % 4 === 0 ? 'sm' : 'xs') as 'xs' | 'sm' | 'md',
        bright: index % 5 === 0,
        delay: (index * 0.37) % 4.5,
        duration: 1.25 + (index % 6) * 0.4,
      })),
    [],
  )

  const divineMegas = useMemo(
    () =>
      Array.from({ length: DIVINE_MEGA_COUNT }, (_, index) => ({
        id: index,
        left: `${(index * 27 + 6) % 88}%`,
        top: `${(index * 33 + 10) % 82}%`,
        delay: index * 0.92,
        duration: 2.2 + (index % 3) * 0.55,
      })),
    [],
  )

  const divineEmbers = useMemo(
    () =>
      Array.from({ length: DIVINE_EMBER_COUNT }, (_, index) => ({
        id: index,
        left: `${(index * 23.5 + 2) % 94}%`,
        delay: (index * 0.55) % 5,
        duration: 3.5 + (index % 4) * 1.2,
        size: index % 3 === 0 ? 'sm' : 'xs',
      })),
    [],
  )

  if (level === 10) {
    return (
      <>
        <div className={`${styles.layer} ${styles.layerBack}`} aria-hidden="true">
          <div className={styles.snowMist} />
          <div className={styles.frostVeil} />
        </div>
        <div className={`${styles.layer} ${styles.layerFront}`} aria-hidden="true">
          {snowflakes.map((flake) => (
            <span
              key={flake.id}
              className={`${styles.snowflake} ${styles[flake.drift]}`}
              style={{
                left: flake.left,
                animationDuration: `${flake.duration}s`,
                animationDelay: `${flake.delay}s`,
                opacity: flake.opacity,
                fontSize: `${flake.size}rem`,
              }}
            >
              <SnowflakeIcon size={flake.size * 16} />
            </span>
          ))}
        </div>
      </>
    )
  }

  if (level === 11) {
    return (
      <>
        <div className={`${styles.layer} ${styles.layerBack}`} aria-hidden="true">
          <div className={styles.legendAura} />
          <div className={styles.legendPrism} />
        </div>
        <div className={`${styles.layer} ${styles.layerFront}`} aria-hidden="true">
          {diamondFlashes.map((flash) => (
            <span
              key={`flash-${flash.id}`}
              className={styles.sparkMega}
              style={{
                left: flash.left,
                top: flash.top,
                width: `${flash.size}rem`,
                height: `${flash.size}rem`,
                animationDuration: `${flash.duration}s`,
                animationDelay: `${flash.delay}s`,
              }}
            />
          ))}
          {diamonds.map((gem) => (
            <span
              key={gem.id}
              className={variantClass(gem.variant)}
              style={{
                left: gem.left,
                top: gem.top,
                animationDuration: `${gem.duration}s`,
                animationDelay: `${gem.delay}s`,
                width: gem.variant === 'ring' || gem.variant === 'star' ? `${gem.size}rem` : undefined,
                height: gem.variant === 'ring' || gem.variant === 'star' ? `${gem.size}rem` : undefined,
                fontSize: gem.variant === 'diamond' || gem.variant === 'cross' ? `${gem.size}rem` : undefined,
              }}
            >
              {gem.variant === 'diamond' ? <DiamondIcon size={gem.size * 16} /> : null}
              {gem.variant === 'cross' ? <CrossSparkleIcon size={gem.size * 16} /> : null}
            </span>
          ))}
        </div>
      </>
    )
  }

  if (level === 12) {
    return (
      <>
        <div className={`${styles.layer} ${styles.layerBack}`} aria-hidden="true">
          <div className={styles.divineAura} />
          <div className={styles.divinePrism} />
        </div>
        <div className={`${styles.layer} ${styles.layerFront}`} aria-hidden="true">
          {divineEmbers.map((ember) => (
            <span
              key={`ember-${ember.id}`}
              className={styles.divineEmber}
              style={{
                left: ember.left,
                animationDuration: `${ember.duration}s`,
                animationDelay: `${ember.delay}s`,
              }}
            >
              <DivineSparkle size={ember.size as 'xs' | 'sm'} />
            </span>
          ))}
          {divineMegas.map((flash) => (
            <span
              key={`mega-${flash.id}`}
              className={styles.divineMegaWrap}
              style={{
                left: flash.left,
                top: flash.top,
                animationDuration: `${flash.duration}s`,
                animationDelay: `${flash.delay}s`,
              }}
            >
              <DivineSparkle size="lg" bright />
            </span>
          ))}
          {divineSparks.map((spark) => (
            <span
              key={spark.id}
              className={styles.divineSparkWrap}
              style={{
                left: spark.left,
                top: spark.top,
                animationDuration: `${spark.duration}s`,
                animationDelay: `${spark.delay}s`,
              }}
            >
              <DivineSparkle size={spark.size} bright={spark.bright} />
            </span>
          ))}
        </div>
      </>
    )
  }

  return null
}

export default LevelProfileAmbientEffects

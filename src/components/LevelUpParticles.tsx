import { useMemo } from 'react'
import {
  getLevelUpCelebrationTheme,
  getLevelUpParticleCount,
  type LevelUpParticleKind,
} from '../utils/levelUpCelebrationThemes'
import styles from './LevelUpParticles.module.css'

interface LevelUpParticlesProps {
  level: number
  active: boolean
}

function kindClass(kind: LevelUpParticleKind): string {
  return styles[kind]
}

function LevelUpParticles({ level, active }: LevelUpParticlesProps) {
  const theme = getLevelUpCelebrationTheme(level)
  const count = getLevelUpParticleCount(theme.impact)

  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        id: index,
        left: `${(index * 29 + 7) % 96}%`,
        delay: `${((index * 0.07) % 0.9).toFixed(2)}s`,
        duration: `${(1.45 + (index % 6) * 0.28).toFixed(2)}s`,
        size: 0.35 + (index % 5) * 0.18,
        drift: index % 2 === 0 ? -18 - (index % 7) : 16 + (index % 8),
      })),
    [count],
  )

  if (!active) {
    return null
  }

  return (
    <div className={styles.layer} aria-hidden="true">
      {bits.map((bit) => (
        <span
          key={bit.id}
          className={`${styles.bit} ${kindClass(theme.particle)}`}
          style={{
            left: bit.left,
            animationDelay: bit.delay,
            animationDuration: bit.duration,
            width: `${bit.size}rem`,
            height: `${bit.size}rem`,
            ['--drift' as string]: `${bit.drift}px`,
          }}
        />
      ))}
    </div>
  )
}

export default LevelUpParticles

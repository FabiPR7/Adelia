import AdelinaCoin from './AdelinaCoin'
import type { CSSProperties } from 'react'
import type { GamificationLevel } from '../types/gamification'
import styles from './GamificationLevelCard.module.css'

interface GamificationLevelCardProps {
  level: GamificationLevel
  xp: number
  adelinas: number
  levelProgress: number
  xpToNext: number | null
  unlockedRewards: Array<{ level: number; reward: string }>
  compact?: boolean
  epic?: boolean
  celebrate?: boolean
  minimal?: boolean
}

function GamificationLevelCard({
  level,
  xp,
  adelinas,
  levelProgress,
  xpToNext,
  unlockedRewards,
  compact = false,
  epic = false,
  celebrate = false,
  minimal = false,
}: GamificationLevelCardProps) {
  const progressPercent = Math.round(levelProgress * 100)

  return (
    <article
      className={`${styles.card} ${styles[level.styleClass]} ${compact ? styles.compact : ''} ${epic ? styles.epic : ''} ${celebrate ? styles.celebrate : ''} ${minimal ? styles.minimal : ''}`}
      style={{
        '--level-color-a': level.colors[0],
        '--level-color-b': level.colors[1],
      } as CSSProperties}
    >
      {level.level >= 6 && (
        <span className={styles.rankEmblem} aria-hidden="true">
          {level.level >= 7 ? (
            <AdelinaCoin size="lg" alt="" />
          ) : (
            '👑'
          )}
        </span>
      )}

      <div className={styles.content}>
        <div className={styles.topRow}>
          <div>
            <p className={styles.eyebrow}>Nivel {level.level}</p>
            <h3 className={styles.title}>{level.title}</h3>
          </div>
          {!minimal && (
            <div className={styles.stats}>
              <span className={styles.levelBadge}>{xp.toLocaleString('es-ES')} XP</span>
              <span className={styles.adelinasChip}>
                <AdelinaCoin size="sm" alt="" />
                {adelinas.toLocaleString('es-ES')} Adelinas
              </span>
            </div>
          )}
        </div>

        {!minimal && (
          <div className={styles.progressBlock}>
          <div className={styles.progressMeta}>
            <span>Siguiente rango</span>
            <span>
              {xpToNext === null ? 'Leyenda máxima' : `${xpToNext.toLocaleString('es-ES')} XP`}
            </span>
          </div>
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
          </div>
          </div>
        )}

        {!compact && unlockedRewards.length > 0 && (
          <ul className={styles.rewards}>
            {unlockedRewards.slice(-3).map((reward) => (
              <li key={reward.level} className={styles.rewardChip}>
                Nv.{reward.level}: {reward.reward}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}

export default GamificationLevelCard

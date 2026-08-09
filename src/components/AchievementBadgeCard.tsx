import { useState } from 'react'
import { getAchievementBadgeArt } from '../data/achievementBadgeArt'
import type { MissionProgress } from '../types/gamification'
import AchievementBadgeIcon from './AchievementBadgeIcon'
import styles from './AchievementBadgeCard.module.css'

interface AchievementBadgeCardProps {
  item: MissionProgress
  earned: boolean
}

function AchievementBadgeCard({ item, earned }: AchievementBadgeCardProps) {
  const [flipped, setFlipped] = useState(false)
  const art = getAchievementBadgeArt(item.mission.id, item.mission)
  const tierClass = styles[`tier${capitalize(art.difficulty)}`]

  return (
    <button
      type="button"
      className={`${styles.card} ${tierClass} ${earned ? styles.cardEarned : styles.cardLocked} ${flipped ? styles.cardFlipped : ''}`}
      onClick={() => setFlipped((current) => !current)}
      aria-pressed={flipped}
      aria-label={`${item.mission.name}. ${earned ? 'Obtenida' : 'Bloqueada'}. Toca para ${flipped ? 'ver el frente' : 'ver detalles'}.`}
    >
      <div className={styles.flipInner}>
        <div className={styles.faceFront}>
          <span className={styles.cardMaterial} aria-hidden="true" />
          <div className={styles.cardContent}>
            <AchievementBadgeIcon art={art} earned={earned} />
            <strong className={styles.badgeName}>{item.mission.name}</strong>
          </div>
        </div>

        <div className={styles.faceBack}>
          <p className={styles.backDescription}>{item.mission.description}</p>
          <div className={styles.backMeta}>
            <span className={styles.xpReward}>+{item.mission.xp.toLocaleString('es-ES')} XP</span>
            {!earned && (
              <span className={styles.progressHint}>
                {item.current}/{item.mission.target}
              </span>
            )}
          </div>
          {earned ? (
            <span className={styles.backDone}>✓ Obtenida</span>
          ) : (
            <span className={styles.backTap}>Toca para volver</span>
          )}
        </div>
      </div>
    </button>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export default AchievementBadgeCard

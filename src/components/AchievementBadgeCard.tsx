import { useState } from 'react'
import { getAchievementBadgeArt } from '../data/achievementBadgeArt'
import { MEDAL_PALETTES, MEDAL_TIER_BY_DIFFICULTY } from '../data/achievementMedal'
import type { MissionProgress } from '../types/gamification'
import AchievementMedal from './AchievementMedal'
import styles from './AchievementBadgeCard.module.css'
import { formatNumber } from '../utils/formatNumber'

interface AchievementBadgeCardProps {
  item: MissionProgress
  earned: boolean
}

/**
 * Vitrina de un logro: delante la medalla, su nombre y su metal (o lo que llevas si
 * aún no la tienes); al tocar se gira y enseña qué hay que hacer y cuánto XP da.
 */
function AchievementBadgeCard({ item, earned }: AchievementBadgeCardProps) {
  const [flipped, setFlipped] = useState(false)
  const art = getAchievementBadgeArt(item.mission.id, item.mission)
  const tier = MEDAL_TIER_BY_DIFFICULTY[art.difficulty]
  const palette = MEDAL_PALETTES[tier]
  const target = Math.max(1, item.mission.target)
  const current = Math.min(item.current, target)
  const progress = earned ? 1 : current / target

  return (
    <button
      type="button"
      className={`${styles.card} ${styles[`tier_${tier}`]} ${earned ? styles.cardEarned : styles.cardLocked} ${flipped ? styles.cardFlipped : ''}`}
      onClick={() => setFlipped((value) => !value)}
      aria-pressed={flipped}
      aria-label={`${item.mission.name}, medalla de ${palette.label.toLowerCase()}. ${earned ? 'Conseguida' : `Llevas ${current} de ${target}`}. Toca para ${flipped ? 'ver la medalla' : 'ver cómo conseguirla'}.`}
    >
      <span className={styles.flipInner}>
        <span className={styles.faceFront}>
          <span className={styles.spot} aria-hidden="true" />
          <AchievementMedal missionId={item.mission.id} art={art} earned={earned} progress={progress} size={78} />
          <strong className={styles.name}>{item.mission.name}</strong>
          {earned ? (
            <span className={styles.tierChip}>{palette.label}</span>
          ) : (
            <span className={styles.progressText}>
              {current}/{target}
            </span>
          )}
        </span>

        <span className={styles.faceBack}>
          <span className={styles.backTier}>{palette.label}</span>
          <span className={styles.backDescription}>{item.mission.description}</span>
          <span className={styles.backXp}>+{formatNumber(item.mission.xp)} XP</span>
          {earned ? (
            <span className={styles.backDone}>✓ Conseguida</span>
          ) : (
            <span className={styles.backBar} aria-hidden="true">
              <span style={{ width: `${Math.max(4, progress * 100)}%` }} />
            </span>
          )}
        </span>
      </span>
    </button>
  )
}

export default AchievementBadgeCard

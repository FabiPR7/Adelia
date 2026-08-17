import { Link } from 'react-router-dom'
import MissionIcon from './MissionIcon'
import type { MissionProgress } from '../types/gamification'
import { WEEKLY_BONUS_TARGET, WEEKLY_MISSION_BONUS_XP } from '../types/gamification'
import styles from './MissionsHub.module.css'

interface MissionsHubProps {
  weeklyProgress: MissionProgress[]
  monthlyProgress: MissionProgress[]
  historicalProgress: MissionProgress[]
  weeklyBonus: {
    completedCount: number
    bonusEarned: boolean
    bonusXp: number
  }
  compact?: boolean
  locked?: boolean
  showExploreLink?: boolean
  variant?: 'default' | 'arena'
}

function MissionRow({ item }: { item: MissionProgress }) {
  const percent = Math.round(item.progress * 100)

  return (
    <article
      className={`${styles.missionCard} ${item.completed ? styles.missionCardDone : ''}`}
    >
      <span className={styles.missionIcon} aria-hidden="true">
        <MissionIcon mission={item.mission} />
      </span>
      <div className={styles.missionBody}>
        <h4>{item.mission.name}</h4>
        <p>{item.mission.description}</p>
      </div>
      <span className={styles.missionXp}>+{item.mission.xp} XP</span>
      {!item.completed && (
        <div className={styles.missionProgress} aria-hidden="true">
          <div className={styles.missionProgressFill} style={{ width: `${percent}%` }} />
        </div>
      )}
    </article>
  )
}

function MissionsHub({
  weeklyProgress,
  monthlyProgress,
  historicalProgress,
  weeklyBonus,
  compact = false,
  locked = false,
  showExploreLink = true,
  variant = 'default',
}: MissionsHubProps) {
  const featuredHistorical = historicalProgress.slice(0, 6)
  const isArena = variant === 'arena'

  if (compact) {
    return (
      <section
        className={`${styles.hub} ${isArena ? styles.hubArena : ''} ${locked ? styles.lockedOverlay : ''}`}
      >
        <div className={`${styles.sectionHeader} ${isArena ? styles.sectionHeaderArena : ''}`}>
          <h3>Misiones de la semana</h3>
          <span className={styles.bonusPill}>
            🎁 Bonus +{WEEKLY_MISSION_BONUS_XP} XP · {weeklyBonus.completedCount}/{WEEKLY_BONUS_TARGET}
          </span>
        </div>
        <div className={styles.compactList}>
          {weeklyProgress.map((item) => (
            <article
              key={item.mission.id}
              className={`${styles.compactMission} ${isArena ? styles.compactMissionArena : ''} ${item.completed ? styles.compactMissionDone : ''}`}
            >
              <div className={styles.compactTop}>
                <span className={styles.compactIcon} aria-hidden="true">
                  <MissionIcon mission={item.mission} size="lg" />
                </span>
                <span className={styles.compactXp}>+{item.mission.xp} XP</span>
              </div>
              <h4>{item.mission.name}</h4>
              <p>{item.mission.description}</p>
              <footer>
                <div className={styles.compactProgressTrack} aria-hidden="true">
                  <div
                    className={styles.compactProgressFill}
                    style={{ width: `${Math.round(item.progress * 100)}%` }}
                  />
                </div>
                <span>{item.completed ? '✓ Completada' : `${Math.round(item.progress * 100)}%`}</span>
              </footer>
            </article>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className={styles.hub}>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Misiones semanales</h3>
          <span className={styles.bonusPill}>
            Bonus +{weeklyBonus.bonusXp} XP · {weeklyBonus.completedCount}/{WEEKLY_BONUS_TARGET}
          </span>
        </div>
        <div className={styles.missionList}>
          {weeklyProgress.map((item) => (
            <MissionRow key={item.mission.id} item={item} />
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Metas del mes</h3>
          <span>{monthlyProgress.filter((item) => item.completed).length}/{monthlyProgress.length}</span>
        </div>
        <div className={styles.missionList}>
          {monthlyProgress.map((item) => (
            <MissionRow key={item.mission.id} item={item} />
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Logros históricos</h3>
          <span>{historicalProgress.filter((item) => item.completed).length}/{historicalProgress.length}</span>
        </div>
        <div className={styles.historicalGrid}>
          {featuredHistorical.map((item) => (
            <article
              key={item.mission.id}
              className={`${styles.historicalCard} ${item.completed ? styles.historicalCardDone : ''}`}
            >
              <span aria-hidden="true">
                <MissionIcon mission={item.mission} />
              </span>
              <h4>{item.mission.name}</h4>
              <span>+{item.mission.xp} XP</span>
            </article>
          ))}
        </div>
      </div>

      {showExploreLink && (
        <Link to="/" className={styles.lockedLabel}>
          Reserva para avanzar misiones →
        </Link>
      )}
    </section>
  )
}

export default MissionsHub

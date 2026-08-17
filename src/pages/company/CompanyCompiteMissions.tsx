import { useState } from 'react'
import AchievementBadgeCard from '../../components/AchievementBadgeCard'
import MissionIcon from '../../components/MissionIcon'
import { useCompanyGamification } from '../../hooks/useCompanyGamification'
import {
  COMPANY_LEVEL_PERKS,
  COMPANY_WEEKLY_BONUS_TARGET,
} from '../../data/companyGamificationCatalog'
import type { MissionProgress } from '../../types/gamification'
import styles from './CompanyCompiteMissions.module.css'

type MissionSection = 'weekly' | 'monthly' | 'done' | 'badges'

function MissionCard({ item }: { item: MissionProgress }) {
  const percent = Math.round(item.progress * 100)
  return (
    <article className={`${styles.missionCard} ${item.completed ? styles.missionDone : ''}`}>
      <div className={styles.missionIconWrap}>
        <MissionIcon mission={item.mission} size="lg" />
      </div>
      <div className={styles.missionBody}>
        <h3>{item.mission.name}</h3>
        <p>{item.mission.description}</p>
        <footer>
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
          </div>
          <span>{item.completed ? 'Completada' : `${item.current}/${item.mission.target}`}</span>
        </footer>
      </div>
      <strong className={styles.missionXp}>+{item.mission.xp} XP</strong>
    </article>
  )
}

export default function CompanyCompiteMissions() {
  const gamification = useCompanyGamification(true)
  const [section, setSection] = useState<MissionSection>('weekly')
  const perk = COMPANY_LEVEL_PERKS[gamification.level.level]

  if (gamification.loading) {
    return <div className={styles.loading}>Cargando misiones de tu casa…</div>
  }

  if (gamification.error) {
    return <div className={styles.error}>{gamification.error}</div>
  }

  const completedWeekly = gamification.weeklyProgress.filter((item) => item.completed)
  const completedMonthly = gamification.monthlyProgress.filter((item) => item.completed)
  const completedBadges = gamification.historicalProgress.filter((item) => item.completed)

  return (
    <div className={styles.page}>
      <header
        className={styles.hero}
        style={{
          background: `linear-gradient(145deg, #1a120c 0%, #3a2418 42%, ${gamification.level.colors[0]} 140%)`,
        }}
      >
        <p className={styles.eyebrow}>Compite · tu casa</p>
        <h1>Nivel {gamification.level.level}</h1>
        <p className={styles.lead}>{gamification.level.title}</p>
        {perk ? <p className={styles.perk}>{perk}</p> : null}

        <div className={styles.levelPanel}>
          <div className={styles.levelBadge}>Nv. {gamification.level.level}</div>
          <div>
            <strong>{gamification.state.xp.toLocaleString('es-ES')} XP</strong>
            <span>
              {gamification.xpToNext == null
                ? 'Has alcanzado el emblema máximo'
                : `${gamification.xpToNext.toLocaleString('es-ES')} XP para ${gamification.nextLevel?.title ?? 'el siguiente nivel'}`}
            </span>
          </div>
        </div>
        <div className={styles.xpTrack}>
          <div className={styles.xpFill} style={{ width: `${Math.round(gamification.levelProgress * 100)}%` }} />
        </div>
      </header>

      <div className={styles.bonusCard}>
        <span className={styles.bonusIcon} aria-hidden="true">🎁</span>
        <div>
          <h2>Bonus de la semana</h2>
          <p>Completa {COMPANY_WEEKLY_BONUS_TARGET} misiones semanales y suma +{gamification.weeklyBonus.bonusXp} XP.</p>
        </div>
        <div className={styles.bonusMeter}>
          <strong>{gamification.weeklyBonus.completedCount}/{COMPANY_WEEKLY_BONUS_TARGET}</strong>
          <span>{gamification.weeklyBonus.bonusEarned ? 'Conseguido' : 'En curso'}</span>
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Misiones e insignias">
        {([
          ['weekly', 'Semana'],
          ['monthly', 'Mes'],
          ['done', 'Completadas'],
          ['badges', 'Insignias'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={section === id}
            className={section === id ? styles.tabActive : styles.tab}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'weekly' ? (
        <div className={styles.list}>
          {gamification.weeklyProgress.map((item) => (
            <MissionCard key={item.mission.id} item={item} />
          ))}
        </div>
      ) : null}

      {section === 'monthly' ? (
        <div className={styles.list}>
          {gamification.monthlyProgress.map((item) => (
            <MissionCard key={item.mission.id} item={item} />
          ))}
        </div>
      ) : null}

      {section === 'done' ? (
        <div className={styles.list}>
          {completedWeekly.length + completedMonthly.length === 0 ? (
            <p className={styles.empty}>Aún no has completado misiones de este periodo.</p>
          ) : (
            [...completedWeekly, ...completedMonthly].map((item) => (
              <MissionCard key={`${item.mission.cadence}-${item.mission.id}`} item={item} />
            ))
          )}
        </div>
      ) : null}

      {section === 'badges' ? (
        <div className={styles.badges}>
          <p className={styles.badgeHint}>
            {completedBadges.length} de {gamification.historicalProgress.length} insignias de casa.
          </p>
          <div className={styles.badgeGrid}>
            {gamification.historicalProgress.map((item) => (
              <AchievementBadgeCard key={item.mission.id} item={item} earned={item.completed} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

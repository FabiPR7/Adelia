import { useState } from 'react'
import { Award, CalendarDays, CalendarRange, CheckCircle2, Gift } from 'lucide-react'
import MissionIcon from '../../components/MissionIcon'
import { ReportCard, ReportHeader } from '../../components/reports/ReportKit'
import { useCompanyGamification } from '../../hooks/useCompanyGamification'
import {
  COMPANY_LEVEL_PERKS,
  COMPANY_WEEKLY_BONUS_TARGET,
} from '../../data/companyGamificationCatalog'
import type { MissionProgress } from '../../types/gamification'
import styles from './CompanyCompiteMissions.module.css'

type MissionSection = 'weekly' | 'monthly' | 'done' | 'badges'

const SECTIONS: Array<{ id: MissionSection; label: string }> = [
  { id: 'weekly', label: 'Semana' },
  { id: 'monthly', label: 'Mes' },
  { id: 'done', label: 'Completadas' },
  { id: 'badges', label: 'Logros' },
]

function MissionRow({ item }: { item: MissionProgress }) {
  const percent = Math.round(item.progress * 100)
  return (
    <li className={`${styles.row} ${item.completed ? styles.rowDone : ''}`}>
      <span className={styles.rowIcon}>
        <MissionIcon mission={item.mission} size="md" />
      </span>
      <div className={styles.rowBody}>
        <div className={styles.rowHead}>
          <h3>{item.mission.name}</h3>
          <span className={styles.rowXp}>+{item.mission.xp} XP</span>
        </div>
        <p>{item.mission.description}</p>
        <div className={styles.rowProgress}>
          <div className={styles.track} aria-hidden="true">
            <div className={styles.fill} style={{ width: `${percent}%` }} />
          </div>
          <span className={styles.count}>
            {item.completed ? (
              <>
                <CheckCircle2 size={14} aria-hidden="true" /> Completada
              </>
            ) : (
              `${item.current} / ${item.mission.target}`
            )}
          </span>
        </div>
      </div>
    </li>
  )
}

function MissionList({ items, empty }: { items: MissionProgress[]; empty: string }) {
  if (items.length === 0) return <p className={styles.empty}>{empty}</p>
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <MissionRow key={`${item.mission.cadence}-${item.mission.id}`} item={item} />
      ))}
    </ul>
  )
}

export default function CompanyCompiteMissions() {
  const gamification = useCompanyGamification(true)
  const [section, setSection] = useState<MissionSection>('weekly')

  if (gamification.loading) {
    return <div className={styles.loading}>Cargando misiones…</div>
  }

  if (gamification.error) {
    return <div className={styles.error}>{gamification.error}</div>
  }

  const { level, state, xpToNext, nextLevel, levelProgress, weeklyBonus } = gamification
  const perk = COMPANY_LEVEL_PERKS[level.level]
  const completed = [...gamification.weeklyProgress, ...gamification.monthlyProgress].filter((item) => item.completed)
  const badgesDone = gamification.historicalProgress.filter((item) => item.completed).length
  const weeklyDone = gamification.weeklyProgress.filter((item) => item.completed).length
  const monthlyDone = gamification.monthlyProgress.filter((item) => item.completed).length
  const bonusPercent = Math.min(100, Math.round((weeklyBonus.completedCount / COMPANY_WEEKLY_BONUS_TARGET) * 100))

  return (
    <div className={styles.page}>
      <ReportHeader
        title="Misiones"
        subtitle="Retos de la semana y del mes que suman XP para subir de nivel en la Liga Adelia."
      />

      <section className={styles.topGrid}>
        <div className={styles.levelCard}>
          <div className={styles.levelBadge}>
            <span>Nivel</span>
            <strong>{level.level}</strong>
          </div>
          <div className={styles.levelText}>
            <span className={styles.levelTitle}>{level.title}</span>
            <span className={styles.levelMeta}>
              {state.xp.toLocaleString('es-ES')} XP
              {xpToNext == null
                ? ' · nivel máximo'
                : ` · faltan ${xpToNext.toLocaleString('es-ES')} para ${nextLevel?.title ?? 'el siguiente nivel'}`}
            </span>
            <div className={styles.levelBar} aria-hidden="true">
              <div className={styles.levelFill} style={{ width: `${Math.round(levelProgress * 100)}%` }} />
            </div>
            {perk ? <span className={styles.levelHint}>{perk}</span> : null}
          </div>
        </div>

        <div className={styles.bonusCard}>
          <div className={styles.bonusHead}>
            <span className={styles.bonusIcon}>
              <Gift size={18} aria-hidden="true" />
            </span>
            <div>
              <h2>Bonus de la semana</h2>
              <p>
                Completa {COMPANY_WEEKLY_BONUS_TARGET} misiones semanales y suma +{weeklyBonus.bonusXp} XP.
              </p>
            </div>
          </div>
          <div className={styles.bonusMeter}>
            <div className={styles.track} aria-hidden="true">
              <div className={styles.fill} style={{ width: `${bonusPercent}%` }} />
            </div>
            <span className={styles.count}>
              {weeklyBonus.bonusEarned
                ? 'Conseguido'
                : `${weeklyBonus.completedCount} / ${COMPANY_WEEKLY_BONUS_TARGET}`}
            </span>
          </div>
        </div>
      </section>

      <section className={styles.stats} aria-label="Resumen">
        <div className={styles.stat}>
          <CalendarDays size={16} aria-hidden="true" />
          <span>Semana</span>
          <strong>{weeklyDone} / {gamification.weeklyProgress.length}</strong>
        </div>
        <div className={styles.stat}>
          <CalendarRange size={16} aria-hidden="true" />
          <span>Mes</span>
          <strong>{monthlyDone} / {gamification.monthlyProgress.length}</strong>
        </div>
        <div className={styles.stat}>
          <Award size={16} aria-hidden="true" />
          <span>Logros</span>
          <strong>{badgesDone} / {gamification.historicalProgress.length}</strong>
        </div>
      </section>

      <ReportCard
        title="Tus retos"
        subtitle="Las semanales se renuevan cada lunes y las mensuales el día 1."
        aside={
          <div className={styles.segmented} role="tablist" aria-label="Tipo de misiones">
            {SECTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={section === id}
                className={section === id ? styles.segOn : styles.segOff}
                onClick={() => setSection(id)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {section === 'weekly' ? (
          <MissionList items={gamification.weeklyProgress} empty="No hay misiones esta semana." />
        ) : null}
        {section === 'monthly' ? (
          <MissionList items={gamification.monthlyProgress} empty="No hay misiones este mes." />
        ) : null}
        {section === 'done' ? (
          <MissionList items={completed} empty="Aún no has completado misiones de este periodo." />
        ) : null}
        {section === 'badges' ? (
          <MissionList
            items={gamification.historicalProgress}
            empty="Todavía no hay logros disponibles."
          />
        ) : null}
      </ReportCard>
    </div>
  )
}

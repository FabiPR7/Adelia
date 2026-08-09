import type { ReactNode } from 'react'
import { motion, type Variants } from 'framer-motion'
import type { MissionProgress } from '../../types/gamification'
import { getLevelProfileBadgeTheme } from '../../utils/levelProfileBadgeThemes'
import AchievementBadgeCard from '../AchievementBadgeCard'
import EpicBubbleFrame from './EpicBubbleFrame'
import {
  IconCalendar,
  IconMapPin,
  IconSpark,
  IconTag,
  IconTarget,
  IconTrophy,
  IconUtensils,
} from './FriendProfileIcons'
import styles from './FriendProfilePanels.module.css'

const stagger: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
}

const rise: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 380, damping: 28 },
  },
}

interface FriendProfilePanelsProps {
  level: number
  locationLabel?: string
  xp: number
  progressPercent: number
  reservationsTotal: number
  promotionsEstimate: number
  missionsCompleted: number
  foodPreferences: string[]
  earnedAchievements: MissionProgress[]
}

function EpicTagline({ children }: { children: ReactNode }) {
  return (
    <span className="epicTagline">
      <span className="epicTaglineDot" aria-hidden="true" />
      {children}
      <span className="epicTaglineDot" aria-hidden="true" />
    </span>
  )
}

function StatBubble({
  icon,
  value,
  label,
  ornament,
  level,
}: {
  icon: ReactNode
  value: number
  label: string
  ornament: string
  level: number
}) {
  return (
    <motion.div variants={rise} whileHover={{ y: -3, scale: 1.02 }} className={styles.statWrap}>
      <EpicBubbleFrame variant="stat" ornament={ornament} level={level} aria-label={`${value} ${label}`}>
        <div className={styles.statInner}>
          <span className={`epicIconMedallion epicIconMedallionRound ${styles.statMedallion}`}>{icon}</span>
          <strong className={`epicHeadline ${styles.statValue}`}>{value.toLocaleString('es-ES')}</strong>
          <span className={`epicEyebrow ${styles.statLabel}`}>{label}</span>
        </div>
      </EpicBubbleFrame>
    </motion.div>
  )
}

function FriendProfilePanels({
  level,
  locationLabel,
  xp,
  progressPercent,
  reservationsTotal,
  promotionsEstimate,
  missionsCompleted,
  foodPreferences,
  earnedAchievements,
}: FriendProfilePanelsProps) {
  const badgeTheme = getLevelProfileBadgeTheme(level)
  const ornament = badgeTheme.ornament

  return (
    <motion.div className={styles.panels} variants={stagger} initial="hidden" animate="show">
      {locationLabel ? (
        <motion.div variants={rise} className={styles.locationWrap}>
          <EpicBubbleFrame variant="pill" ornament={ornament} level={level} aria-label={`Ubicación: ${locationLabel}`}>
            <div className={styles.locationInner}>
              <span className={`epicIconMedallion epicIconMedallionRound ${styles.locationMedallion}`}>
                <IconMapPin className={styles.medallionIcon} />
              </span>
              <span className={`epicHeadline ${styles.locationText}`}>{locationLabel}</span>
            </div>
          </EpicBubbleFrame>
        </motion.div>
      ) : null}

      <motion.div variants={rise}>
        <EpicBubbleFrame
          variant="panel"
          ornament={ornament}
          level={level}
          sparkles={level === 11}
          aria-label={`${xp.toLocaleString('es-ES')} XP, ${progressPercent}% al siguiente nivel`}
        >
          <div className={styles.xpInner}>
            <span className={`epicIconMedallion ${styles.xpMedallion}`}>
              <IconSpark className={styles.medallionIconLg} />
            </span>
            <div className={styles.xpCopy}>
              <span className="epicEyebrow">Experiencia acumulada</span>
              <strong className={`epicHeadline ${styles.xpHeadline}`}>{xp.toLocaleString('es-ES')} XP</strong>
              <EpicTagline>{progressPercent}% al siguiente nivel</EpicTagline>
            </div>
            <div className={styles.xpMeter} aria-hidden="true">
              <motion.span
                className={styles.xpMeterFill}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(8, progressPercent)}%` }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              />
            </div>
          </div>
        </EpicBubbleFrame>
      </motion.div>

      <motion.section className={styles.statsGrid} aria-label="Actividad" variants={rise}>
        <StatBubble
          icon={<IconCalendar className={styles.medallionIcon} />}
          value={reservationsTotal}
          label="Reservas"
          ornament={ornament}
          level={level}
        />
        <StatBubble
          icon={<IconTag className={styles.medallionIcon} />}
          value={promotionsEstimate}
          label="Promos"
          ornament={ornament}
          level={level}
        />
        <StatBubble
          icon={<IconTarget className={styles.medallionIcon} />}
          value={missionsCompleted}
          label="Misiones"
          ornament={ornament}
          level={level}
        />
      </motion.section>

      {foodPreferences.length > 0 && (
        <motion.div variants={rise}>
          <EpicBubbleFrame variant="panel" ornament={ornament} level={level} aria-label="Gustos y preferencias culinarias">
            <header className={styles.panelHeader}>
              <span className={`epicIconMedallion ${styles.panelMedallion}`}>
                <IconUtensils className={styles.medallionIconLg} />
              </span>
              <div className={styles.panelHeaderText}>
                <span className="epicEyebrow">Preferencias culinarias</span>
                <h2 className={`epicHeadline ${styles.panelHeadline}`}>Gustos</h2>
                <EpicTagline>Sabores favoritos</EpicTagline>
              </div>
            </header>
            <div className={styles.tasteGrid}>
              {foodPreferences.map((item) => (
                <span key={item} className={styles.tasteChip}>
                  <span className={styles.tasteDot} aria-hidden="true" />
                  <span className={`epicHeadline ${styles.tasteLabel}`}>{item}</span>
                </span>
              ))}
            </div>
          </EpicBubbleFrame>
        </motion.div>
      )}

      <motion.div variants={rise}>
        <EpicBubbleFrame
          variant="panel"
          ornament={ornament}
          level={level}
          sparkles={level === 11}
          aria-label={`Logros, ${earnedAchievements.length} desbloqueados`}
        >
          <header className={styles.panelHeader}>
            <span className={`epicIconMedallion ${styles.panelMedallion}`}>
              <IconTrophy className={styles.medallionIconLg} />
            </span>
            <div className={styles.panelHeaderText}>
              <span className="epicEyebrow">Misiones históricas</span>
              <h2 className={`epicHeadline ${styles.panelHeadline}`}>Logros</h2>
              <EpicTagline>Camino recorrido</EpicTagline>
            </div>
            <div className={styles.countMedallion}>
              <strong className={`epicHeadline ${styles.countValue}`}>{earnedAchievements.length}</strong>
              <span className={`epicEyebrow ${styles.countLabel}`}>desbloq.</span>
            </div>
          </header>

          {earnedAchievements.length > 0 ? (
            <div className={styles.logrosStage}>
              <div className={styles.logrosGrid}>
                {earnedAchievements.map((item, index) => (
                  <motion.div
                    key={item.mission.id}
                    className={styles.logroItem}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + index * 0.04, type: 'spring', stiffness: 420, damping: 26 }}
                  >
                    <AchievementBadgeCard item={item} earned />
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <p className={`epicTagline ${styles.emptyLogros}`}>Todavía no ha desbloqueado logros históricos.</p>
          )}
        </EpicBubbleFrame>
      </motion.div>
    </motion.div>
  )
}

export default FriendProfilePanels

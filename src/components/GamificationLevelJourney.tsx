import type { CSSProperties } from 'react'
import { GAMIFICATION_LEVELS } from '../data/gamificationLevels'
import type { GamificationLevel } from '../types/gamification'
import styles from './GamificationLevelJourney.module.css'

interface GamificationLevelJourneyProps {
  currentLevel: GamificationLevel
  xp: number
  levelProgress: number
  xpToNext: number | null
  celebrate?: boolean
}

const START_LEVEL = GAMIFICATION_LEVELS[0]
const LEGEND_LEVEL = GAMIFICATION_LEVELS[GAMIFICATION_LEVELS.length - 1]

function GamificationLevelJourney({
  currentLevel,
  xp,
  levelProgress: _levelProgress,
  xpToNext: _xpToNext,
  celebrate = false,
}: GamificationLevelJourneyProps) {
  void _levelProgress
  void _xpToNext

  const currentIndex = GAMIFICATION_LEVELS.findIndex((level) => level.level === currentLevel.level)
  const pathProgress = currentIndex <= 0 ? 10 : 10 + (currentIndex / (GAMIFICATION_LEVELS.length - 1)) * 80
  const legendUnlocked = currentLevel.level >= LEGEND_LEVEL.level

  const journeyStyle = { '--path-progress': `${pathProgress}%` } as CSSProperties

  return (
    <div className={styles.wrap}>
      <div className={styles.progressBanner}>
        <span className={styles.nowBadge}>Tu ascenso · Nv. {currentLevel.level}</span>
        <strong>{currentLevel.title}</strong>
        <span>{xp.toLocaleString('es-ES')} XP</span>
      </div>

      <div className={styles.journey} style={journeyStyle}>
        <div className={styles.startSlot}>
          <p className={styles.slotLabel}>Inicio</p>
          <article className={styles.startCard} aria-label={`Nivel ${START_LEVEL.level}: ${START_LEVEL.title}`}>
            <span className={styles.startCardBadge}>Nv. {START_LEVEL.level}</span>
            <h3 className={styles.startCardTitle}>{START_LEVEL.title}</h3>
            <p className={styles.startHint}>Todos empiezan aquí</p>
          </article>
        </div>

        <div className={styles.pathColumn} aria-label="Camino hacia el rango legendario">
          <div className={styles.arrowTrack}>
            <div className={styles.arrowRail} aria-hidden="true">
              <div className={styles.arrowFill} />
            </div>
            <div className={styles.arrowHead} aria-hidden="true">
              <span>▲</span>
            </div>
            <div
              className={`${styles.travelerPin} ${celebrate ? styles.travelerPinCelebrate : ''}`}
              aria-hidden="true"
            >
              <span>{currentLevel.level}</span>
            </div>
          </div>
          <p className={styles.pathLabel}>Sube</p>
        </div>

        <div className={styles.legendSlot}>
          <p className={styles.slotLabel}>Meta</p>
          <article className={`${styles.legendCard} ${legendUnlocked ? styles.legendUnlocked : ''}`}>
            <div className={styles.flameLayer} aria-hidden="true">
              <span className={styles.flame} />
              <span className={styles.flame} />
              <span className={styles.flame} />
            </div>
            <div className={styles.legendFrame} aria-hidden="true" />
            <div className={styles.legendInner}>
              <span className={styles.legendCrown} aria-hidden="true">👑</span>
              <span className={styles.legendBadge}>Nv. {LEGEND_LEVEL.level}</span>
              <h4>{LEGEND_LEVEL.title}</h4>
              <p className={styles.legendXp}>{LEGEND_LEVEL.minXp.toLocaleString('es-ES')}+ XP</p>
              <span className={styles.legendHint}>
                {legendUnlocked
                  ? 'Dominas la mesa · leyenda desbloqueada'
                  : 'Negro obsidiana · borde de oro · llamas eternas'}
              </span>
            </div>
          </article>
        </div>
      </div>

      <div className={styles.levelMarkers} aria-hidden="true">
        {GAMIFICATION_LEVELS.map((levelItem) => (
          <span
            key={levelItem.level}
            className={currentLevel.level >= levelItem.level ? styles.markerDone : styles.markerPending}
          >
            {levelItem.level}
          </span>
        ))}
      </div>

      <p className={styles.ascendCopy}>
        Reserva, completa misiones y gana XP para llegar a la tarjeta legendaria.
      </p>
    </div>
  )
}

export default GamificationLevelJourney

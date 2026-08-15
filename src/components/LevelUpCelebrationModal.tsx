import { useEffect, useState, type CSSProperties } from 'react'
import GamificationLevelFrameCard from './GamificationLevelFrameCard'
import type { LevelUpStep } from '../hooks/useLevelUpCelebration'
import {
  getGamificationLevelByNumber,
  getGamificationLevelTitle,
  getProfileRewardForLevel,
} from '../data/gamificationLevels'
import styles from './LevelUpCelebrationModal.module.css'

interface LevelUpCelebrationModalProps {
  step: LevelUpStep | null
  displayName: string
  handle?: string
  photoUrl?: string
  xp: number
  onDismiss: () => void
  dismissing?: boolean
}

type AnimationPhase = 'intro' | 'old' | 'flip' | 'new' | 'done'

function LevelUpCelebrationModal({
  step,
  displayName,
  handle,
  photoUrl,
  xp,
  onDismiss,
  dismissing = false,
}: LevelUpCelebrationModalProps) {
  const [phase, setPhase] = useState<AnimationPhase>('intro')

  useEffect(() => {
    if (!step) {
      setPhase('intro')
      return
    }

    setPhase('intro')

    const timers = [
      window.setTimeout(() => setPhase('old'), 180),
      window.setTimeout(() => setPhase('flip'), 1100),
      window.setTimeout(() => setPhase('new'), 1850),
      window.setTimeout(() => setPhase('done'), 2600),
    ]

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [step])

  if (!step) {
    return null
  }

  const previousLevel = getGamificationLevelByNumber(step.fromLevel)
  const nextLevel = getGamificationLevelByNumber(step.toLevel)
  const reward = getProfileRewardForLevel(step.toLevel)

  return (
    <div
      className={`${styles.overlay} ${phase !== 'intro' ? styles.overlayVisible : ''}`}
      role="presentation"
    >
      <div className={styles.backdropGlow} aria-hidden="true" />
      <div className={styles.confetti} aria-hidden="true">
        {Array.from({ length: 24 }, (_, index) => (
          <span key={index} className={styles.confettiPiece} style={{ '--i': index } as CSSProperties} />
        ))}
      </div>

      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-up-title"
      >
        <div className={`${styles.badge} ${phase === 'done' ? styles.badgeVisible : ''}`}>
          <span className={styles.badgeIcon} aria-hidden="true">👑</span>
          <span>Subida de nivel</span>
        </div>

        <h2
          id="level-up-title"
          className={`${styles.title} ${phase === 'new' || phase === 'done' ? styles.titleVisible : ''}`}
        >
          ¡Nivel {step.toLevel}!
        </h2>

        <p className={`${styles.subtitle} ${phase === 'done' ? styles.subtitleVisible : ''}`}>
          {getGamificationLevelTitle(step.toLevel)}
        </p>

        <div className={styles.stage}>
          <div
            className={`${styles.cardScene} ${phase === 'flip' || phase === 'new' || phase === 'done' ? styles.cardSceneFlipping : ''}`}
          >
            <div className={styles.cardOld}>
              <GamificationLevelFrameCard
                level={previousLevel.level}
                levelTitle={previousLevel.title}
                displayName={displayName}
                handle={handle}
                photoUrl={photoUrl}
                xp={Math.max(previousLevel.minXp, xp - 1)}
                showProgress={false}
              />
            </div>

            <div className={styles.cardNew}>
              <GamificationLevelFrameCard
                level={nextLevel.level}
                levelTitle={nextLevel.title}
                displayName={displayName}
                handle={handle}
                photoUrl={photoUrl}
                xp={xp}
                showProgress={false}
                highlight
              />
            </div>
          </div>

          <div className={`${styles.burst} ${phase === 'flip' || phase === 'new' ? styles.burstActive : ''}`} aria-hidden="true" />
          <div className={`${styles.ring} ${phase === 'new' || phase === 'done' ? styles.ringActive : ''}`} aria-hidden="true" />
        </div>

        {reward ? (
          <p className={`${styles.reward} ${phase === 'done' ? styles.rewardVisible : ''}`}>
            Desbloqueado: <strong>{reward}</strong>
          </p>
        ) : null}

        <button
          type="button"
          className={`${styles.cta} ${phase === 'done' ? styles.ctaVisible : ''}`}
          onClick={() => void onDismiss()}
          disabled={phase !== 'done' || dismissing}
        >
          {dismissing ? 'Guardando…' : '¡Genial!'}
        </button>
      </div>
    </div>
  )
}

export default LevelUpCelebrationModal

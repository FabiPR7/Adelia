import { useEffect, useState, type CSSProperties } from 'react'
import type { LevelUpStep } from '../hooks/useLevelUpCelebration'
import {
  getGamificationLevelByNumber,
  getGamificationLevelTitle,
  getProfileRewardForLevel,
} from '../data/gamificationLevels'
import { getInventoryItem, rewardsForLevel, type InventoryItemDefinition } from '../data/inventoryItems'
import { getLevelUpCelebrationTheme } from '../utils/levelUpCelebrationThemes'
import { getStripEmblem } from '../utils/levelRankingStripAssets'
import InventoryItemCard from './InventoryItemCard'
import LevelUpHeroCard from './LevelUpHeroCard'
import LevelUpParticles from './LevelUpParticles'
import styles from './LevelUpCelebrationModal.module.css'

interface LevelUpCelebrationModalProps {
  step: LevelUpStep | null
  displayName: string
  handle?: string
  photoUrl?: string
  xp: number
  onDismiss: () => void
  dismissing?: boolean
  preview?: boolean
  onPreviewCycle?: (delta: -1 | 1) => void
}

type AnimationPhase = 'intro' | 'impact' | 'reveal' | 'done'

function LevelUpCelebrationModal({
  step,
  displayName,
  handle,
  photoUrl,
  xp,
  onDismiss,
  dismissing = false,
  preview = false,
  onPreviewCycle,
}: LevelUpCelebrationModalProps) {
  const [phase, setPhase] = useState<AnimationPhase>('intro')

  useEffect(() => {
    if (!step) {
      setPhase('intro')
      return
    }

    setPhase('intro')

    const timers = [
      window.setTimeout(() => setPhase('impact'), 280),
      window.setTimeout(() => setPhase('reveal'), 720),
      window.setTimeout(() => setPhase('done'), 2100),
    ]

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [step])

  useEffect(() => {
    if (!preview || !onPreviewCycle) {
      return
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        onPreviewCycle(-1)
      }
      if (event.key === 'ArrowRight') {
        onPreviewCycle(1)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview, onPreviewCycle])

  if (!step) {
    return null
  }

  const nextLevel = getGamificationLevelByNumber(step.toLevel)
  const theme = getLevelUpCelebrationTheme(step.toLevel)
  const reward = getProfileRewardForLevel(step.toLevel) ?? theme.flavorReward
  const itemRewards = rewardsForLevel(step.toLevel)
    .map((grant) => {
      const item = getInventoryItem(grant.itemId)
      return item ? { item, quantity: grant.quantity } : null
    })
    .filter((entry): entry is { item: InventoryItemDefinition; quantity: number } => Boolean(entry))
  const emblem = getStripEmblem(step.toLevel)
  const fromEmblem = step.fromLevel > 0 && step.fromLevel !== step.toLevel
    ? getStripEmblem(step.fromLevel)
    : null
  const revealed = phase === 'reveal' || phase === 'done'

  const cssVars = {
    '--lu-accent': theme.accent,
    '--lu-accent-hot': theme.accentHot,
    '--lu-overlay': theme.overlay,
    '--lu-title-glow': theme.titleGlow,
    '--lu-cta': theme.ctaGradient,
  } as CSSProperties

  return (
    <div
      className={`${styles.overlay} ${styles[theme.impact]}`}
      style={cssVars}
      role="presentation"
    >
      <div className={styles.backdropGlow} aria-hidden="true" />
      <LevelUpParticles level={step.toLevel} active={revealed} />

      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-up-title"
      >
        {preview && onPreviewCycle ? (
          <div className={styles.pager}>
            <button
              type="button"
              className={styles.pagerBtn}
              onClick={() => onPreviewCycle(-1)}
              aria-label="Ver nivel anterior"
            >
              ‹
            </button>
            <span>Vista previa · {step.toLevel} / 12</span>
            <button
              type="button"
              className={styles.pagerBtn}
              onClick={() => onPreviewCycle(1)}
              aria-label="Ver siguiente nivel"
            >
              ›
            </button>
          </div>
        ) : null}

        <div className={`${styles.badge} ${revealed ? styles.badgeVisible : ''}`}>
          <img src={emblem} alt="" className={styles.badgeEmblem} />
          <span>{theme.badgeLabel}</span>
        </div>

        <div className={`${styles.fromRow} ${phase === 'impact' ? styles.fromRowGone : ''}`}>
          {fromEmblem ? (
            <img src={fromEmblem} alt="" className={styles.fromEmblem} />
          ) : null}
        </div>

        <div className={`${styles.burst} ${phase !== 'intro' ? styles.burstActive : ''}`} aria-hidden="true" />

        <h2
          id="level-up-title"
          className={`${styles.title} ${revealed ? styles.titleVisible : ''}`}
        >
          ¡Nivel {step.toLevel}!
        </h2>

        <p className={`${styles.subtitle} ${phase === 'done' ? styles.subtitleVisible : ''}`}>
          {getGamificationLevelTitle(step.toLevel)}
        </p>

        <div className={styles.stage}>
          <LevelUpHeroCard
            key={step.toLevel}
            level={nextLevel.level}
            levelTitle={nextLevel.title}
            displayName={displayName}
            handle={handle}
            photoUrl={photoUrl}
            xp={xp}
            reveal={revealed}
          />
          <div className={`${styles.ring} ${revealed ? styles.ringActive : ''}`} aria-hidden="true" />
        </div>

        {itemRewards.length > 0 ? (
          <div className={`${styles.itemDrops} ${phase === 'done' ? styles.itemDropsVisible : ''}`}>
            {itemRewards.map(({ item, quantity }) => (
              <div key={item.id} className={styles.itemDrop}>
                <InventoryItemCard item={item} quantity={quantity} mini />
              </div>
            ))}
          </div>
        ) : null}

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

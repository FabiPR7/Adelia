import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dices, Flame, Grid3x3, Layers, Timer } from 'lucide-react'
import {
  CHALLENGE_MINIGAME_IDS,
  CHALLENGE_MINIGAME_LABELS,
  type ChallengeMinigameId,
  type ReservationChallenge,
} from '../../types/reservationChallenges'
import { ChallengeTableHero } from './ChallengeTableHero'
import styles from './ChallengeGameRoulette.module.css'

const GAME_ICONS = {
  three_cards: Layers,
  odds_evens: Dices,
  stopwatch: Timer,
  maze: Grid3x3,
  hot_cold: Flame,
} as const

interface ChallengeGameRouletteProps {
  challenge: ReservationChallenge
  onDone: () => void
}

function spinDelay(step: number, last: number) {
  const progress = last <= 0 ? 1 : step / last
  if (progress < 0.58) {
    return 52
  }
  if (progress < 0.74) {
    return 78
  }
  if (progress < 0.86) {
    return 120
  }
  if (progress < 0.94) {
    return 180
  }
  return 260
}

function ChallengeGameRoulette({ challenge, onDone }: ChallengeGameRouletteProps) {
  const target = challenge.minigameId
  const [activeId, setActiveId] = useState<ChallengeMinigameId>(CHALLENGE_MINIGAME_IDS[0] ?? 'three_cards')
  const [landed, setLanded] = useState(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const ids = CHALLENGE_MINIGAME_IDS
    const count = ids.length
    const targetIndex = Math.max(0, ids.indexOf(target))
    const offset = Math.floor(Math.random() * count)
    const extra = (targetIndex - offset + count) % count
    const last = 3 * count + extra
    let step = 0
    let timer = 0

    const tick = () => {
      const id = ids[(offset + step) % count]
      if (id) {
        setActiveId(id)
      }
      if (step >= last) {
        setLanded(true)
        timer = window.setTimeout(() => onDoneRef.current(), 720)
        return
      }
      step += 1
      timer = window.setTimeout(tick, spinDelay(step, last))
    }

    tick()
    return () => window.clearTimeout(timer)
  }, [target])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="El duelo elige minijuego"
      className={`${styles.root} fixed inset-0 z-[80] overflow-hidden`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {challenge.companyPhotoUrl ? (
        <img src={challenge.companyPhotoUrl} alt="" className={styles.photo} />
      ) : null}
      <div className={styles.backdrop} />
      <span className={styles.grain} aria-hidden />
      <span className={styles.orbA} aria-hidden />
      <span className={styles.orbB} aria-hidden />

      <div className="relative z-[2] flex h-full flex-col px-3 pb-[max(0.8rem,env(safe-area-inset-bottom))] pt-[max(0.65rem,env(safe-area-inset-top))]">
        <ChallengeTableHero title="El duelo elige" lead="El minijuego se elige ahora" venue={challenge.companyName} />

        <div className={styles.stage}>
          <p className={styles.kicker}>{landed ? 'Se juega a' : 'Pasando minijuegos'}</p>
          <AnimatePresence mode="wait">
            <motion.h2
              key={activeId}
              className={styles.title}
              initial={{ y: 10, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: landed ? 1.04 : 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              {CHALLENGE_MINIGAME_LABELS[activeId]}
            </motion.h2>
          </AnimatePresence>

          <ul className={styles.grid} aria-live="polite">
            {CHALLENGE_MINIGAME_IDS.map((id) => {
              const Icon = GAME_ICONS[id]
              const selected = id === activeId
              return (
                <motion.li
                  key={id}
                  className={`${styles.tile} ${selected ? styles.tileOn : ''} ${landed && selected ? styles.tileWin : ''} ${selected ? '' : styles.tileDim}`}
                  animate={{
                    scale: selected ? (landed ? 1.08 : 1.05) : 0.92,
                    y: selected ? -6 : 0,
                  }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                >
                  <span className={styles.tileIcon}>
                    <Icon size={22} />
                  </span>
                  <span className={styles.tileLabel}>{CHALLENGE_MINIGAME_LABELS[id]}</span>
                </motion.li>
              )
            })}
          </ul>
        </div>
      </div>
    </motion.div>
  )
}

export default ChallengeGameRoulette

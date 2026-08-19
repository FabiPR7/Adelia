import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  Flag,
  Flame,
  Snowflake,
  Sun,
  Target,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import type { ReservationChallenge } from '../../types/reservationChallenges'
import {
  HOT_COLD_DIRECTION_LABELS,
  HOT_COLD_HEAT_RANK,
  HOT_COLD_TEMPERATURE_LABELS,
  hotColdCountdownLabel,
  hotColdRaceOpen,
  type HotColdClue,
  type HotColdTemperature,
} from '../../types/hotCold'
import { burstChallengeConfetti } from '../../utils/challengeConfetti'
import { AdeliaMark, playerInitials, usablePlayerPhoto } from './challengeBrand'
import { ChallengeTableHero } from './ChallengeTableHero'
import styles from './HotColdTable.module.css'

interface HotColdTableProps {
  challenge: ReservationChallenge
  currentUid: string
  busy?: boolean
  error?: string | null
  onPick: (value: number) => void | Promise<unknown>
  onForfeit: () => void
  onAckResult?: () => void
}

type Finale = 'play' | 'recap' | 'winner'

const STEPS = [
  { id: 'secret', label: 'Tu nº' },
  { id: 'r1', label: 'Pista 1' },
  { id: 'r2', label: 'Pista 2' },
  { id: 'guess', label: 'Adivina' },
]

function firstName(name: string | undefined | null, fallback: string) {
  const trimmed = (name ?? '').trim()
  if (!trimmed) {
    return fallback
  }
  return trimmed.split(/\s+/)[0] ?? fallback
}

function Avatar({ name, photoUrl, live = false }: { name: string; photoUrl: string; live?: boolean }) {
  const photo = usablePlayerPhoto(photoUrl)
  const initial = playerInitials(name)
  const ring = live
    ? 'ring-2 ring-[#ff6b4a] shadow-[0_0_12px_rgba(255,79,143,0.35)]'
    : 'ring-2 ring-[#5ec8ff]/30'
  if (photo) {
    return <img src={photo} alt="" className={`h-11 w-11 rounded-full object-cover ${ring}`} />
  }
  return (
    <div className={`flex h-11 w-11 items-center justify-center rounded-full bg-[#fff1ea] font-[family-name:var(--font-display)] text-base text-[#5c4a3a] ${ring}`}>
      {initial}
    </div>
  )
}

function heatClass(stylesMap: { readonly [key: string]: string }, temperature: HotColdTemperature) {
  return stylesMap[`heat_${temperature}`] ?? ''
}

function HeatIcon({ temperature, size = 22 }: { temperature: HotColdTemperature; size?: number }) {
  if (temperature === 'boiling' || temperature === 'hot') {
    return <Flame size={size} />
  }
  if (temperature === 'warm') {
    return <Sun size={size} />
  }
  return <Snowflake size={size} />
}

function DirectionMark({ clue }: { clue: HotColdClue }) {
  if (clue.direction === 'exact') {
    return <Target size={14} />
  }
  if (clue.direction === 'higher') {
    return <ChevronUp size={16} />
  }
  return <ChevronDown size={16} />
}

function stepIndex(phase: string, round: number) {
  if (phase === 'pick_secret') {
    return 0
  }
  if (phase === 'probe') {
    return round <= 1 ? 1 : 2
  }
  return 3
}

function HotColdTable({
  challenge,
  currentUid,
  busy = false,
  error,
  onPick,
  onForfeit,
  onAckResult,
}: HotColdTableProps) {
  const { profile } = useAuth()
  const game = challenge.hotCold
  const [confirmForfeit, setConfirmForfeit] = useState(false)
  const [finale, setFinale] = useState<Finale>('play')
  const [canSkipRecap, setCanSkipRecap] = useState(false)
  const [localPick, setLocalPick] = useState<number | null>(null)
  const [flashClue, setFlashClue] = useState<HotColdClue | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const confettiRef = useRef('')
  const clueCountRef = useRef(0)
  const pickKeyRef = useRef('')

  const isChallenged = challenge.challengedUid === currentUid
  const meName = isChallenged ? challenge.challengedDisplayName : challenge.challengerDisplayName
  const rivalName = isChallenged ? challenge.challengerDisplayName : challenge.challengedDisplayName
  const livePhoto = usablePlayerPhoto(profile?.photoUrl)
  const mePhoto = livePhoto || (isChallenged ? challenge.challengedPhotoUrl : challenge.challengerPhotoUrl)
  const rivalPhoto = isChallenged ? challenge.challengerPhotoUrl : challenge.challengedPhotoUrl
  const meShort = firstName(meName, 'Tú')
  const rivalShort = firstName(rivalName, 'el rival')

  const phase = game?.phase ?? 'pick_secret'
  const round = game?.round ?? 0
  const options = game?.options ?? []
  const clues = game?.clues ?? []
  const mySecret = game?.mySecret ?? null
  const guessAttempt = game?.guessAttempt ?? 0
  const pickKey = `${phase}-${round}-${guessAttempt}`
  const shownPick = localPick != null && pickKeyRef.current === pickKey
    ? localPick
    : (game?.myPick ?? null)
  const finished = phase === 'done' || challenge.status === 'resolved'
  const iWon = game?.iWon === true || challenge.winnerUid === currentUid
  const winnerShort = iWon ? meShort : rivalShort
  const startAt = game?.guessStartAt ?? null
  const countLabel = finale === 'play' && phase === 'guess' && !finished
    ? hotColdCountdownLabel(startAt, now)
    : null
  const raceOpen = phase !== 'guess' || hotColdRaceOpen(startAt, now)
  const canChoose = Boolean(game)
    && finale === 'play'
    && !finished
    && shownPick == null
    && Boolean(game?.canPick)
    && raceOpen
  const currentStep = stepIndex(phase, round)
  const latest = clues[clues.length - 1] ?? null
  const heat = latest?.temperature ?? game?.lastTemperature ?? null
  const heatRank = heat ? HOT_COLD_HEAT_RANK[heat] : 0

  useEffect(() => {
    setConfirmForfeit(false)
  }, [challenge.id])

  useEffect(() => {
    if (pickKeyRef.current !== pickKey) {
      pickKeyRef.current = pickKey
      setLocalPick(null)
    }
  }, [pickKey])

  useEffect(() => {
    if (error) {
      setLocalPick(null)
    }
  }, [error])

  useEffect(() => {
    if (clues.length > clueCountRef.current) {
      const newest = clues[clues.length - 1]
      if (newest) {
        setFlashClue(newest)
      }
    }
    clueCountRef.current = clues.length
  }, [clues])

  useEffect(() => {
    if (!flashClue) {
      return
    }
    const id = window.setTimeout(() => setFlashClue(null), 1700)
    return () => window.clearTimeout(id)
  }, [flashClue])

  useEffect(() => {
    if (phase !== 'guess' || finished) {
      return
    }
    const tick = () => setNow(Date.now())
    tick()
    const id = window.setInterval(tick, 50)
    return () => window.clearInterval(id)
  }, [phase, startAt, finished, guessAttempt])

  useEffect(() => {
    if (!finished) {
      setFinale('play')
      setCanSkipRecap(false)
      return
    }
    setFinale((prev) => (prev === 'play' ? 'recap' : prev))
  }, [finished])

  useEffect(() => {
    if (finale !== 'recap') {
      return
    }
    const skipAt = window.setTimeout(() => setCanSkipRecap(true), 1100)
    const goWinner = window.setTimeout(() => setFinale('winner'), 3200)
    return () => {
      window.clearTimeout(skipAt)
      window.clearTimeout(goWinner)
    }
  }, [finale])

  useEffect(() => {
    if (finale !== 'winner' || !iWon) {
      return
    }
    if (confettiRef.current === challenge.id) {
      return
    }
    confettiRef.current = challenge.id
    burstChallengeConfetti()
  }, [challenge.id, finale, iWon])

  const copy = (() => {
    if (!game) {
      return {
        kicker: 'Frío y caliente',
        title: 'Preparando el duelo…',
        hint: 'Un segundo. Si no aparece, recarga la app.',
      }
    }
    if (phase === 'pick_secret' && shownPick == null) {
      return {
        kicker: 'Tu número secreto',
        title: 'Elige una burbuja',
        hint: 'Tres números del 1 al 99. El rival tendrá que adivinar el tuyo.',
      }
    }
    if (phase === 'pick_secret') {
      return {
        kicker: 'Tu número secreto',
        title: `Esperando a ${rivalShort}`,
        hint: 'Cuando elija el suyo, empiezan las pistas.',
      }
    }
    if (phase === 'probe' && shownPick == null) {
      return {
        kicker: `Ronda ${round} de 3 · Pista`,
        title: '¿Frío o caliente?',
        hint: `Elige un número. Te diré si el de ${rivalShort} está más alto o más bajo.`,
      }
    }
    if (phase === 'probe') {
      return {
        kicker: `Ronda ${round} de 3 · Pista`,
        title: heat ? HOT_COLD_TEMPERATURE_LABELS[heat] : `Esperando a ${rivalShort}`,
        hint: latest
          ? `Tu ${latest.pick} · ${HOT_COLD_DIRECTION_LABELS[latest.direction]}. Esperando a ${rivalShort}.`
          : `Cuando ${rivalShort} elija, sigue la siguiente ronda.`,
      }
    }
    if (phase === 'guess' && !raceOpen) {
      return {
        kicker: game.lastGuessOutcome === 'tie'
          ? 'Empate · se vuelve a jugar'
          : game.lastGuessOutcome === 'both_miss'
            ? 'Los dos fallasteis'
            : 'Ronda 3 · A la vez',
        title: 'Entre esas tres está el suyo',
        hint: `El primero que acierte el número de ${rivalShort} se queda la mesa.`,
      }
    }
    if (phase === 'guess' && shownPick == null) {
      return {
        kicker: 'Ronda 3 · ¡Ahora!',
        title: `Acierta el de ${rivalShort}`,
        hint: 'Uno de los tres es el número secreto del rival. El primero que lo toque gana.',
      }
    }
    if (phase === 'guess') {
      return {
        kicker: 'Ronda 3',
        title: 'Ya está lanzado',
        hint: `Si fallaste, ${rivalShort} aún puede llevarse la reserva.`,
      }
    }
    return {
      kicker: 'Frío y caliente',
      title: game.prompt,
      hint: '',
    }
  })()

  const lockNumber = (value: number) => {
    if (!canChoose) {
      return
    }
    pickKeyRef.current = pickKey
    setLocalPick(value)
    void onPick(value)
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Frío y caliente"
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
      <span className={styles.orbIce} aria-hidden />
      <span className={styles.orbFire} aria-hidden />

      <div className="relative z-[2] flex h-full flex-col px-3 pb-[max(0.8rem,env(safe-area-inset-bottom))] pt-[max(0.65rem,env(safe-area-inset-top))]">
        <ChallengeTableHero title="Frío y caliente" lead="3 rondas" venue={challenge.companyName} />

        {finale !== 'winner' ? (
          <header className={styles.hud}>
            <div className={`${styles.player} ${finale === 'play' || iWon ? styles.playerLive : ''}`}>
              <Avatar name={meName} photoUrl={mePhoto} live={finale === 'play' || iWon} />
              <div className={styles.meta}>
                <span className={styles.role}>Tú</span>
                <span className={styles.name}>{meShort}</span>
                <span className={styles.secretTag}>{mySecret != null ? `nº ${mySecret}` : 'Elige'}</span>
              </div>
            </div>
            <div className={styles.vsWrap}>
              <motion.div
                className={styles.vsCoin}
                animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 2.2 }}
              >
                <Flame size={16} className="text-[#ff6b4a]" />
                <Snowflake size={16} className="text-[#5ec8ff]" />
              </motion.div>
            </div>
            <div className={`${styles.player} ${styles.playerRight} ${finale !== 'play' && !iWon ? styles.playerLive : ''}`}>
              <Avatar name={rivalName} photoUrl={rivalPhoto} live={Boolean(game?.rivalReady) || (finale !== 'play' && !iWon)} />
              <div className={styles.meta}>
                <span className={styles.role}>Rival</span>
                <span className={styles.name}>{rivalShort}</span>
                <span className={styles.secretTag}>
                  {game?.rivalHasSecret || game?.rivalReady ? 'Listo' : 'Elige…'}
                </span>
              </div>
            </div>
          </header>
        ) : null}

        {finale === 'play' ? (
          <ol className={styles.steps} aria-label="Rondas">
            {STEPS.map((step, index) => (
              <li
                key={step.id}
                className={`${styles.step} ${index === currentStep ? styles.stepOn : ''} ${index < currentStep ? styles.stepDone : ''}`}
              >
                <span>{index + 1}</span>
                {step.label}
              </li>
            ))}
          </ol>
        ) : null}

        <AnimatePresence mode="wait">
          {finale === 'play' ? (
            <motion.div
              key={`play-${pickKey}`}
              className="relative flex min-h-0 flex-1 flex-col"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              <div className={styles.ribbon}>
                <p className={styles.kicker}>{copy.kicker}</p>
                <h2 className={styles.title}>{copy.title}</h2>
                {copy.hint ? <p className={styles.hint}>{copy.hint}</p> : null}
              </div>

              <div className={styles.stage}>
                {heat && phase !== 'pick_secret' ? (
                  <div className={styles.thermo} aria-hidden>
                    <Snowflake size={14} />
                    <div className={styles.thermoTrack}>
                      <motion.span
                        className={`${styles.thermoFill} ${heat ? heatClass(styles, heat) : ''}`}
                        animate={{ height: `${18 + heatRank * 16}%` }}
                        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                      />
                    </div>
                    <span className={styles.thermoCap} />
                  </div>
                ) : null}

                <div className={styles.bubbles}>
                  {(options.length ? options : [null, null, null]).map((value, index) => {
                    const selected = value != null && shownPick === value
                    const locked = shownPick != null
                    return (
                      <motion.button
                        key={`${pickKey}-${value ?? index}`}
                        type="button"
                        disabled={!canChoose || value == null}
                        onClick={() => value != null && lockNumber(value)}
                        className={[
                          styles.bubble,
                          phase === 'guess' ? styles.bubbleGuess : '',
                          phase === 'pick_secret' ? styles.bubbleSecret : '',
                          selected ? styles.bubbleOn : '',
                          locked && !selected ? styles.bubbleDim : '',
                        ].join(' ')}
                        initial={{ y: 18, opacity: 0, scale: 0.86 }}
                        animate={{
                          y: selected ? -10 : [0, -7, 0],
                          opacity: 1,
                          scale: selected ? 1.06 : 1,
                        }}
                        transition={{
                          y: selected
                            ? { type: 'spring', stiffness: 320, damping: 18 }
                            : { repeat: Infinity, duration: 2.4 + index * 0.25, delay: index * 0.08 },
                          opacity: { duration: 0.28 },
                        }}
                        whileTap={canChoose ? { scale: 0.94 } : undefined}
                      >
                        <span className={styles.bubbleShine} aria-hidden />
                        <span className={styles.bubbleValue}>{value ?? '·'}</span>
                      </motion.button>
                    )
                  })}
                </div>

                {clues.length > 0 ? (
                  <ul className={styles.clues}>
                    {clues.map((clue) => (
                      <li key={clue.round} className={`${styles.clue} ${heatClass(styles, clue.temperature)}`}>
                        <span className={styles.clueRound}>R{clue.round}</span>
                        <strong>{clue.pick}</strong>
                        <HeatIcon temperature={clue.temperature} size={14} />
                        <span>{HOT_COLD_TEMPERATURE_LABELS[clue.temperature]}</span>
                        <span className={styles.clueDir}>
                          <DirectionMark clue={clue} />
                          {HOT_COLD_DIRECTION_LABELS[clue.direction]}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <AnimatePresence>
                {flashClue ? (
                  <motion.div
                    className={`${styles.flash} ${heatClass(styles, flashClue.temperature)}`}
                    initial={{ opacity: 0, scale: 0.86 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.04 }}
                  >
                    <motion.span
                      className={styles.flashIcon}
                      initial={{ scale: 0.5, rotate: -18 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 14 }}
                    >
                      <HeatIcon temperature={flashClue.temperature} size={42} />
                    </motion.span>
                    <p className={styles.flashKicker}>Tu {flashClue.pick}</p>
                    <h3>{HOT_COLD_TEMPERATURE_LABELS[flashClue.temperature]}</h3>
                    <p className={styles.flashDir}>
                      {flashClue.direction === 'exact'
                        ? '¡Has clavado el número!'
                        : `El de ${rivalShort} es ${HOT_COLD_DIRECTION_LABELS[flashClue.direction].toLowerCase()}`}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <AnimatePresence>
                {countLabel ? (
                  <motion.div
                    className={styles.countOverlay}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <p className={styles.countHint}>
                      {game?.lastGuessOutcome === 'tie'
                        ? 'Empate · otra vez'
                        : game?.lastGuessOutcome === 'both_miss'
                          ? 'Nadie acertó · otra vez'
                          : 'Salís a la vez'}
                    </p>
                    <motion.span
                      key={countLabel}
                      className={styles.countDigit}
                      initial={{ scale: 0.45, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                    >
                      {countLabel}
                    </motion.span>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          ) : null}

          {finale === 'recap' ? (
            <motion.div
              key="recap"
              className={styles.recap}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            >
              <p className={styles.recapKicker}>Los secretos</p>
              <h2 className={styles.recapTitle}>{iWon ? 'Lo has cazado' : `${winnerShort} lo cazó`}</h2>
              <div className={styles.recapSecrets}>
                <div>
                  <span>Tú</span>
                  <strong>{game?.mySecret ?? '—'}</strong>
                </div>
                <Flame size={18} className="text-[#ff6b4a]" />
                <div>
                  <span>{rivalShort}</span>
                  <strong>{game?.rivalSecret ?? '—'}</strong>
                </div>
              </div>
              {clues.length > 0 ? (
                <ul className={styles.recapClues}>
                  {clues.map((clue) => (
                    <li key={clue.round}>
                      R{clue.round} · {clue.pick} · {HOT_COLD_TEMPERATURE_LABELS[clue.temperature]}
                    </li>
                  ))}
                </ul>
              ) : null}
            </motion.div>
          ) : null}

          {finale === 'winner' ? (
            <motion.div
              key="winner"
              className={styles.winner}
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <span className={styles.winnerRays} aria-hidden />
              <motion.div
                className={styles.winnerMark}
                initial={{ scale: 0.6, rotate: -16 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 14 }}
              >
                <AdeliaMark className="h-12 w-12 object-contain" />
              </motion.div>
              <p className={styles.winnerKicker}>{iWon ? 'Has ganado el duelo' : 'Duelo resuelto'}</p>
              <h2 className={styles.winnerTitle}>Ganó {winnerShort}</h2>
              <p className={styles.winnerBody}>
                {iWon
                  ? `La reserva de ${challenge.companyName} queda a tu nombre. ${rivalShort} entra como invitado.`
                  : `La reserva de ${challenge.companyName} se queda a nombre de ${winnerShort}. Entras como invitado: en esta mesa no sumas XP ni premios.`}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {error ? <p className={styles.error}>{error}</p> : null}

        <footer className="relative z-[3] mt-1 flex flex-col items-center gap-2">
          {finale === 'winner' ? (
            challenge.status === 'resolved' && onAckResult ? (
              <button type="button" disabled={busy} onClick={onAckResult} className={styles.cta}>
                {iWon ? '¡Vamos!' : 'Entendido'}
              </button>
            ) : (
              <p className={styles.hint}>Cerrando el duelo…</p>
            )
          ) : finale === 'recap' && canSkipRecap ? (
            <button type="button" className={styles.skip} onClick={() => setFinale('winner')}>
              Ver quién ganó
            </button>
          ) : finale === 'play' ? (
            confirmForfeit ? (
              <>
                <button type="button" disabled={busy} onClick={onForfeit} className={styles.danger}>
                  Sí, cedo la reserva
                </button>
                <button type="button" disabled={busy} onClick={() => setConfirmForfeit(false)} className={styles.ghost}>
                  Seguir jugando
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmForfeit(true)}
                className={styles.forfeit}
                aria-label="Rendirse"
              >
                <Flag size={13} />
                Bandera blanca
              </button>
            )
          ) : null}
        </footer>
      </div>
    </motion.div>
  )
}

export default HotColdTable

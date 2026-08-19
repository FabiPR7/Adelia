import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flag } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import type { ReservationChallenge } from '../../types/reservationChallenges'
import { errorForStopwatch } from '../../types/stopwatch'
import { burstChallengeConfetti } from '../../utils/challengeConfetti'
import { AdeliaMark, playerInitials, usablePlayerPhoto } from './challengeBrand'
import { ChallengeTableHero } from './ChallengeTableHero'
import styles from './StopwatchTable.module.css'

interface StopwatchTableProps {
  challenge: ReservationChallenge
  currentUid: string
  busy?: boolean
  error?: string | null
  onStart: () => void | Promise<unknown>
  onStop: (hundredths: number) => void | Promise<unknown>
  onForfeit: () => void
  onAckResult?: () => void
}

type Finale = 'play' | 'recap' | 'winner'

function firstName(name: string | undefined | null, fallback: string) {
  const trimmed = (name ?? '').trim()
  if (!trimmed) {
    return fallback
  }
  return trimmed.split(/\s+/)[0] ?? fallback
}

function splitStopwatch(hundredths: number) {
  const safe = Math.max(0, Math.min(9_999, Math.round(hundredths)))
  const seconds = Math.floor(safe / 100)
  const frac = safe % 100
  return {
    seconds: String(seconds).padStart(2, '0'),
    frac: String(frac).padStart(2, '0'),
  }
}

function LcdTime({
  hundredths,
  size = 'md',
  muted = false,
  onDark = false,
  blank = false,
}: {
  hundredths: number
  size?: 'lg' | 'md' | 'sm'
  muted?: boolean
  onDark?: boolean
  blank?: boolean
}) {
  const parts = splitStopwatch(hundredths)
  const sizeClass = size === 'lg' ? styles.lcdLg : size === 'sm' ? styles.lcdSm : styles.lcdMd
  return (
    <span
      className={[
        styles.lcd,
        sizeClass,
        muted ? styles.lcdMuted : '',
        onDark ? styles.lcdOnDark : '',
      ].join(' ')}
      aria-label={blank ? undefined : `${Number.parseInt(parts.seconds, 10)},${parts.frac}`}
    >
      {(blank ? '--' : parts.seconds).split('').map((digit, index) => (
        <span key={`s${index}`} className={`${styles.lcdDigit} ${styles.lcdGhost}`}>
          {digit}
        </span>
      ))}
      <span className={styles.lcdSep}>,</span>
      {(blank ? '--' : parts.frac).split('').map((digit, index) => (
        <span key={`h${index}`} className={`${styles.lcdHundredths} ${styles.lcdGhost}`}>
          {digit}
        </span>
      ))}
    </span>
  )
}

function Avatar({ name, photoUrl, live = false }: { name: string; photoUrl: string; live?: boolean }) {
  const photo = usablePlayerPhoto(photoUrl)
  const initial = playerInitials(name)
  const ring = live
    ? 'ring-2 ring-[#ff6b4a] shadow-[0_0_12px_rgba(255,79,143,0.35)]'
    : 'ring-2 ring-[#ff6b4a]/25'
  if (photo) {
    return <img src={photo} alt="" className={`h-11 w-11 rounded-full object-cover ${ring}`} />
  }
  return (
    <div className={`flex h-11 w-11 items-center justify-center rounded-full bg-[#fff1ea] font-[family-name:var(--font-display)] text-base text-[#5c4a3a] ${ring}`}>
      {initial}
    </div>
  )
}

function WatchTicks({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className={styles.ticks} style={{ color: onDark ? '#fff8f4' : '#ff6b4a' }} aria-hidden>
      {Array.from({ length: 12 }, (_, index) => (
        <span
          key={index}
          className={`${styles.tick} ${index % 3 === 0 ? styles.tickHour : ''}`}
          style={{ transform: `rotate(${index * 30}deg)` }}
        />
      ))}
    </span>
  )
}

function ResultList({
  times,
  targets,
  align,
}: {
  times: number[]
  targets: number[]
  align: 'left' | 'right'
}) {
  const slots = Math.max(3, times.length)
  return (
    <ul className={`${styles.results} ${align === 'right' ? styles.resultsRight : ''}`}>
      {Array.from({ length: slots }, (_, index) => {
        const time = times[index]
        if (time == null) {
          return (
            <li key={index} className={styles.resultEmpty}>
              <LcdTime hundredths={0} size="sm" blank muted />
            </li>
          )
        }
        const target = targets[index] ?? targets[targets.length - 1] ?? 0
        const delta = errorForStopwatch(time, target)
        return (
          <li key={index} className={styles.result}>
            <LcdTime hundredths={time} size="sm" />
            <em>+{delta}</em>
          </li>
        )
      })}
    </ul>
  )
}

function CountUp({ value, active }: { value: number; active: boolean }) {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!active) {
      setShown(0)
      return
    }
    const start = performance.now()
    let frame = 0
    const loop = (now: number) => {
      const t = Math.min(1, (now - start) / 720)
      setShown(Math.round(value * t))
      if (t < 1) {
        frame = window.requestAnimationFrame(loop)
      }
    }
    frame = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(frame)
  }, [active, value])

  return <>{shown}</>
}

function StopwatchTable({
  challenge,
  currentUid,
  busy = false,
  error,
  onStart,
  onStop,
  onForfeit,
  onAckResult,
}: StopwatchTableProps) {
  const { profile } = useAuth()
  const game = challenge.stopwatch
  const [confirmForfeit, setConfirmForfeit] = useState(false)
  const [runningLocal, setRunningLocal] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [finale, setFinale] = useState<Finale>('play')
  const [canSkipRecap, setCanSkipRecap] = useState(false)
  const [, setTick] = useState(0)
  const originRef = useRef(0)
  const startPromiseRef = useRef<Promise<unknown>>(Promise.resolve())
  const confettiRef = useRef('')

  const isChallenged = challenge.challengedUid === currentUid
  const meName = isChallenged ? challenge.challengedDisplayName : challenge.challengerDisplayName
  const rivalName = isChallenged ? challenge.challengerDisplayName : challenge.challengedDisplayName
  const livePhoto = usablePlayerPhoto(profile?.photoUrl)
  const mePhoto = livePhoto || (isChallenged ? challenge.challengedPhotoUrl : challenge.challengerPhotoUrl)
  const rivalPhoto = isChallenged ? challenge.challengerPhotoUrl : challenge.challengedPhotoUrl
  const meShort = firstName(meName, 'Tú')
  const rivalShort = firstName(rivalName, 'el rival')

  const target = game?.targetHundredths ?? 0
  const roundTargets = game?.roundTargets?.length ? game.roundTargets : [target]
  const myTimes = game?.myTimes ?? []
  const rivalTimes = game?.rivalTimes ?? []
  const myTurn = Boolean(game?.myTurn)
  const showStart = Boolean(game?.canStart) && !runningLocal && !stopping && finale === 'play'
  const showStop = (runningLocal || Boolean(game?.canStop) || stopping) && finale === 'play'
  const finished = game?.phase === 'done' || challenge.status === 'resolved'
  const iWon = game?.iWon === true || challenge.winnerUid === currentUid
  const winnerShort = iWon ? meShort : rivalShort
  const roundCount = Math.max(3, roundTargets.length, myTimes.length, rivalTimes.length)
  const currentRound = Math.min(roundCount, game?.round ?? 1)

  useEffect(() => {
    setConfirmForfeit(false)
    setStopping(false)
    setRunningLocal(false)
  }, [game?.turnIndex])

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
    const skipAt = window.setTimeout(() => setCanSkipRecap(true), 1400)
    const goWinner = window.setTimeout(() => setFinale('winner'), 3600)
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

  useEffect(() => {
    if (game?.running && !runningLocal && !stopping && finale === 'play') {
      const started = game.startedAt ? Date.parse(game.startedAt) : Date.now()
      originRef.current = performance.now() - Math.max(0, Date.now() - started)
      setRunningLocal(true)
    }
  }, [finale, game?.running, game?.startedAt, runningLocal, stopping])

  useEffect(() => {
    if (!runningLocal) {
      return
    }
    let frame = 0
    let lastShown = -1
    const loop = () => {
      const next = Math.max(0, Math.floor((performance.now() - originRef.current) / 10))
      if (next !== lastShown) {
        lastShown = next
        setTick(next)
      }
      frame = window.requestAnimationFrame(loop)
    }
    frame = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(frame)
  }, [runningLocal])

  const liveHundredths = runningLocal
    ? Math.max(0, Math.floor((performance.now() - originRef.current) / 10))
    : 0

  const copy = (() => {
    if (game?.canStart && !runningLocal) {
      return {
        kicker: `Ronda ${game.round} · Te toca`,
        hint: 'Inicia y para lo más cerca posible. Cada ronda cambia el objetivo.',
      }
    }
    if (runningLocal || game?.canStop || stopping) {
      return {
        kicker: `Ronda ${game?.round ?? 1} · ¡Ahora!`,
        hint: 'Para cuando llegues al objetivo.',
      }
    }
    if (game?.rivalRunning) {
      return {
        kicker: `Ronda ${game.round} · Turno de ${rivalShort}`,
        hint: `${rivalShort} está cronometrando.`,
      }
    }
    return {
      kicker: `Ronda ${game?.round ?? 1} · Esperando`,
      hint: `Le toca a ${rivalShort}.`,
    }
  })()

  const recapRows = Array.from({ length: Math.max(myTimes.length, rivalTimes.length, 3) }, (_, index) => {
    const targetForRound = roundTargets[index] ?? roundTargets[roundTargets.length - 1] ?? 0
    const mine = myTimes[index]
    const theirs = rivalTimes[index]
    const myDelta = mine == null ? null : errorForStopwatch(mine, targetForRound)
    const rivalDelta = theirs == null ? null : errorForStopwatch(theirs, targetForRound)
    return { index, targetForRound, mine, theirs, myDelta, rivalDelta }
  })

  let watchFace: ReactNode = null
  if (showStart) {
    watchFace = (
      <motion.button
        type="button"
        className={styles.watch}
        whileTap={{ scale: 0.96 }}
        disabled={busy}
        onClick={() => {
          originRef.current = performance.now()
          setRunningLocal(true)
          startPromiseRef.current = Promise.resolve(onStart()).catch(() => undefined)
        }}
      >
        <WatchTicks />
        <span className={styles.watchMark}>
          <AdeliaMark className="h-16 w-16 object-contain" />
        </span>
        <span className={styles.watchInner}>
          <LcdTime hundredths={0} size="md" />
          <span className={styles.watchLabel}>Iniciar</span>
        </span>
      </motion.button>
    )
  } else if (showStop) {
    watchFace = (
      <motion.button
        type="button"
        className={`${styles.watch} ${styles.watchStop}`}
        whileTap={{ scale: 0.96 }}
        disabled={stopping}
        onClick={() => {
          const hundredths = Math.max(0, Math.round((performance.now() - originRef.current) / 10))
          setStopping(true)
          void startPromiseRef.current.finally(() => onStop(hundredths))
        }}
      >
        <WatchTicks onDark />
        <span className={styles.watchInner}>
          <LcdTime hundredths={liveHundredths} size="md" onDark />
          <span className={styles.watchLabel}>Parar</span>
        </span>
      </motion.button>
    )
  } else if (finale === 'play') {
    watchFace = (
      <div className={styles.watchWait}>
        <WatchTicks />
        <span className={styles.watchMark}>
          <AdeliaMark className="h-16 w-16 object-contain" />
        </span>
        <span className={styles.watchInner}>
          <LcdTime hundredths={0} size="md" blank muted />
          <span className={styles.watchLabel}>
            {game?.rivalRunning ? `${rivalShort}…` : 'Espera'}
          </span>
        </span>
      </div>
    )
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Cronómetro"
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
        <ChallengeTableHero title="Cronómetro" lead="3 rondas" venue={challenge.companyName} />

        {finale !== 'winner' ? (
          <header className={styles.hud}>
            <div className={`${styles.player} ${myTurn && finale === 'play' ? styles.playerLive : ''} ${finale !== 'play' && iWon ? styles.playerLive : ''}`}>
              <Avatar name={meName} photoUrl={mePhoto} live={myTurn || (finale !== 'play' && iWon)} />
              <div className={styles.meta}>
                <span className={styles.role}>Tú</span>
                <span className={styles.name}>{meShort}</span>
                <span className={styles.errorTag}>error {game?.myError ?? 0}</span>
              </div>
            </div>

            <div className={styles.vsWrap}>
              <motion.div
                className={styles.vsCoin}
                animate={{ rotate: finale === 'play' ? [0, -8, 8, 0] : 0, scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 2.4 }}
              >
                <AdeliaMark className="h-7 w-7 object-contain" />
              </motion.div>
            </div>

            <div className={`${styles.player} ${styles.playerRight} ${!myTurn && finale === 'play' && game?.phase !== 'done' ? styles.playerLive : ''} ${finale !== 'play' && !iWon ? styles.playerLive : ''}`}>
              <Avatar name={rivalName} photoUrl={rivalPhoto} live={(!myTurn && finale === 'play') || (finale !== 'play' && !iWon)} />
              <div className={styles.meta}>
                <span className={styles.role}>Rival</span>
                <span className={styles.name}>{rivalShort}</span>
                <span className={styles.errorTag}>error {game?.rivalError ?? 0}</span>
              </div>
            </div>
          </header>
        ) : null}

        <AnimatePresence mode="wait">
          {finale === 'play' ? (
            <motion.div
              key="play"
              className="flex min-h-0 flex-1 flex-col"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              <div className={styles.ribbon}>
                <p className={styles.kicker}>{copy.kicker}</p>
                <p className={styles.objectiveLabel}>Objetivo</p>
                <h2 className={styles.title}>
                  <LcdTime hundredths={target} size="lg" />
                </h2>
                {copy.hint ? <p className={styles.hint}>{copy.hint}</p> : null}
                <div className={styles.rounds} aria-hidden>
                  {Array.from({ length: roundCount }, (_, index) => (
                    <span
                      key={index}
                      className={`${styles.roundDot} ${index < currentRound ? styles.roundOn : ''}`}
                    />
                  ))}
                </div>
              </div>

              <div className={styles.stage}>
                <div className={styles.sideCol}>
                  <ResultList times={myTimes} targets={roundTargets} align="left" />
                </div>
                <div className={styles.watchWrap}>{watchFace}</div>
                <div className={styles.sideCol}>
                  <ResultList times={rivalTimes} targets={roundTargets} align="right" />
                </div>
              </div>
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
              <div className={styles.recapHead}>
                <p>Marcador final</p>
                <h2>Resultados</h2>
              </div>
              <div className={styles.recapGrid}>
                <span>Ronda</span>
                <span style={{ textAlign: 'center' }}>Tú</span>
                <span style={{ textAlign: 'center' }}>{rivalShort}</span>
              </div>
              <ul className={styles.recapRows}>
                {recapRows.map((row) => {
                  const mineBest = row.myDelta != null && (row.rivalDelta == null || row.myDelta < row.rivalDelta)
                  const theirsBest = row.rivalDelta != null && (row.myDelta == null || row.rivalDelta < row.myDelta)
                  return (
                    <motion.li
                      key={row.index}
                      className={styles.recapRow}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.18 + row.index * 0.28 }}
                    >
                      <span className={styles.recapRound}>
                        {row.index + 1}
                        <br />
                        <LcdTime hundredths={row.targetForRound} size="sm" muted />
                      </span>
                      <div className={`${styles.recapCell} ${mineBest ? styles.recapBest : ''}`}>
                        {row.mine == null ? (
                          <LcdTime hundredths={0} size="sm" blank muted />
                        ) : (
                          <>
                            <LcdTime hundredths={row.mine} size="sm" />
                            <span className={styles.recapDelta}>+{row.myDelta}</span>
                          </>
                        )}
                      </div>
                      <div className={`${styles.recapCell} ${theirsBest ? styles.recapBest : ''}`}>
                        {row.theirs == null ? (
                          <LcdTime hundredths={0} size="sm" blank muted />
                        ) : (
                          <>
                            <LcdTime hundredths={row.theirs} size="sm" />
                            <span className={styles.recapDelta}>+{row.rivalDelta}</span>
                          </>
                        )}
                      </div>
                    </motion.li>
                  )
                })}
              </ul>
              <motion.div
                className={styles.recapTotals}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + recapRows.length * 0.28 }}
              >
                <span className={styles.recapRound}>Error</span>
                <strong><CountUp value={game?.myError ?? 0} active /></strong>
                <strong><CountUp value={game?.rivalError ?? 0} active /></strong>
              </motion.div>
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

export default StopwatchTable

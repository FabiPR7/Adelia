import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flag } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import type { ReservationChallenge } from '../../types/reservationChallenges'
import { oddsEvensSideLabel, type OddsEvensSide } from '../../types/oddsEvens'
import { burstChallengeConfetti } from '../../utils/challengeConfetti'
import { AdeliaMark, playerInitials, usablePlayerPhoto } from './challengeBrand'
import { ChallengeTableHero } from './ChallengeTableHero'
import styles from './OddsEvensTable.module.css'

interface OddsEvensTableProps {
  challenge: ReservationChallenge
  currentUid: string
  busy?: boolean
  error?: string | null
  onPickSide: (side: OddsEvensSide) => void
  onPickNumber: (value: number) => void
  onForfeit: () => void
  onAckResult?: () => void
}

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
type Finale = 'play' | 'recap' | 'winner'

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

function ScorePips({ score }: { score: number }) {
  return (
    <div className={styles.pips}>
      {[0, 1].map((index) => (
        <span key={index} className={`${styles.pip} ${index < score ? styles.pipOn : ''}`} />
      ))}
    </div>
  )
}

function TurnTimer({ deadlineAt }: { deadlineAt: string | null }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 120)
    return () => window.clearInterval(id)
  }, [])

  const total = 15_000
  const remaining = deadlineAt ? Math.max(0, Date.parse(deadlineAt) - now) : total
  const seconds = Math.max(0, Math.ceil(remaining / 1000))
  const progress = deadlineAt ? remaining / total : 1
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const urgent = Boolean(deadlineAt) && seconds <= 5

  return (
    <div className={styles.timer}>
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="#fff" stroke="rgba(255,107,74,0.2)" strokeWidth="5" />
        {deadlineAt ? (
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            stroke={urgent ? '#b54a4a' : '#ff6b4a'}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        ) : null}
      </svg>
      <motion.span
        className={styles.timerValue}
        animate={urgent ? { scale: [1, 1.12, 1] } : { scale: 1 }}
        transition={urgent ? { repeat: Infinity, duration: 0.7 } : undefined}
      >
        {deadlineAt ? seconds : 'VS'}
      </motion.span>
    </div>
  )
}

function NumberCard({
  value,
  size = 'md',
  hidden = false,
}: {
  value: number
  size?: 'md' | 'lg'
  hidden?: boolean
}) {
  return (
    <div className={`${styles.tile} ${size === 'lg' ? styles.tileLg : ''} ${hidden ? styles.tileBack : ''}`}>
      {hidden ? '?' : value}
    </div>
  )
}

function OddsEvensTable({
  challenge,
  currentUid,
  busy = false,
  error,
  onPickSide,
  onPickNumber,
  onForfeit,
  onAckResult,
}: OddsEvensTableProps) {
  const { profile } = useAuth()
  const game = challenge.oddsEvens
  const [confirmForfeit, setConfirmForfeit] = useState(false)
  const [localPick, setLocalPick] = useState<{ round: number; value: number } | null>(null)
  const [finale, setFinale] = useState<Finale>('play')
  const [canSkipRecap, setCanSkipRecap] = useState(false)
  const confettiRef = useRef('')

  const isChallenged = challenge.challengedUid === currentUid
  const meName = isChallenged ? challenge.challengedDisplayName : challenge.challengerDisplayName
  const rivalName = isChallenged ? challenge.challengerDisplayName : challenge.challengedDisplayName
  const livePhoto = usablePlayerPhoto(profile?.photoUrl)
  const mePhoto = livePhoto || (isChallenged ? challenge.challengedPhotoUrl : challenge.challengerPhotoUrl)
  const rivalPhoto = isChallenged ? challenge.challengerPhotoUrl : challenge.challengedPhotoUrl
  const meShort = firstName(meName, 'Tú')
  const rivalShort = firstName(rivalName, 'el rival')

  const phase = game?.phase ?? 'choose_side'
  const round = game?.round ?? 1
  const iChoose = game?.chooserUid === currentUid
  const mySide = game?.mySide ?? null
  const shownPick = phase === 'reveal' || phase === 'done'
    ? (game?.myPick ?? null)
    : (localPick?.round === round ? localPick.value : (game?.myPick ?? null))
  const canChoose = Boolean(game) && phase === 'choose_side' && iChoose && !busy
  const canPickNumber = Boolean(game) && phase === 'pick_number' && shownPick == null
  const bothLocked = shownPick != null && Boolean(game?.rivalPicked || game?.rivalPick != null)
  const deadline = phase === 'choose_side'
    ? game?.chooseDeadlineAt ?? null
    : phase === 'pick_number' && shownPick == null
      ? game?.pickDeadlineAt ?? null
      : null
  const finished = phase === 'done' || challenge.status === 'resolved'
  const iWon = game?.iWon === true || challenge.winnerUid === currentUid
  const winnerShort = iWon ? meShort : rivalShort
  const rounds = game?.rounds?.length
    ? game.rounds
    : (game?.lastSum != null && shownPick != null && game.rivalPick != null
      ? [{
          round: game.round,
          myPick: shownPick,
          rivalPick: game.rivalPick,
          sum: game.lastSum,
          parity: game.lastParity ?? 'even',
          iWon: Boolean(game.iWonRound),
        }]
      : [])

  useEffect(() => {
    setConfirmForfeit(false)
    setLocalPick((prev) => (prev && prev.round !== round ? null : prev))
  }, [round])

  useEffect(() => {
    if (error) {
      setLocalPick(null)
    }
  }, [error])

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

  const copy = (() => {
    if (!game) {
      return {
        kicker: 'Pares y nones',
        title: 'Preparando el duelo…',
        hint: 'Un segundo. Si no aparece, recarga la app.',
      }
    }
    if (phase === 'choose_side' && canChoose) {
      return {
        kicker: 'Suerte de salida',
        title: '¿Pares o nones?',
        hint: 'Quien acierte la suma se lleva la ronda. Al mejor de 3.',
      }
    }
    if (phase === 'choose_side') {
      return {
        kicker: 'Suerte de salida',
        title: `Empieza ${rivalShort}`,
        hint: `${rivalShort} está eligiendo pares o nones.`,
      }
    }
    if (phase === 'pick_number' && bothLocked) {
      return {
        kicker: `Ronda ${round} · Tú eres ${oddsEvensSideLabel(mySide)}`,
        title: '¡A la suma!',
        hint: 'Los dos números ya están en la mesa.',
      }
    }
    if (phase === 'pick_number' && shownPick == null) {
      return {
        kicker: `Ronda ${round} · Tú eres ${oddsEvensSideLabel(mySide)}`,
        title: 'Lanza tu número',
        hint: 'Del 1 al 9. Si los dos elegís antes, la suma sale ya.',
      }
    }
    if (phase === 'pick_number') {
      return {
        kicker: `Ronda ${round} · Tú eres ${oddsEvensSideLabel(mySide)}`,
        title: `Esperando a ${rivalShort}`,
        hint: 'Tu número ya está elegido. Cuando elija el rival, se suma.',
      }
    }
    if (phase === 'reveal') {
      const parity = game?.lastParity === 'even' ? 'par' : 'non'
      return {
        kicker: `Suma ${game?.lastSum ?? ''} · ${parity}`,
        title: game?.iWonRound ? '¡Ronda tuya!' : `Ronda para ${rivalShort}`,
        hint: game?.iWonRound ? 'Una más y la reserva es tuya.' : 'Aún se puede dar la vuelta.',
      }
    }
    return {
      kicker: 'Pares y nones',
      title: game?.prompt ?? 'Preparando el duelo…',
      hint: 'Al mejor de 3. El primero que gane 2 rondas se queda la mesa.',
    }
  })()

  const lockNumber = (value: number) => {
    if (!canPickNumber) {
      return
    }
    setLocalPick({ round, value })
    onPickNumber(value)
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Pares y nones"
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
        <ChallengeTableHero title="Pares y nones" lead="Mejor de 3" venue={challenge.companyName} />

        {finale !== 'winner' ? (
          <header className={styles.hud}>
            <div className={`${styles.player} ${phase !== 'choose_side' || iChoose || (finale !== 'play' && iWon) ? styles.playerLive : ''}`}>
              <Avatar name={meName} photoUrl={mePhoto} live={phase !== 'choose_side' || iChoose || (finale !== 'play' && iWon)} />
              <div className={styles.meta}>
                <span className={styles.role}>Tú</span>
                <span className={styles.name}>{meShort}</span>
                <span className={styles.sideTag}>{oddsEvensSideLabel(mySide) || '—'}</span>
                <ScorePips score={game?.myScore ?? 0} />
              </div>
            </div>

            <div className={styles.vsWrap}>
              {deadline && finale === 'play' && (phase === 'choose_side' || phase === 'pick_number') ? (
                <TurnTimer deadlineAt={deadline} />
              ) : (
                <motion.div
                  className={styles.vsCoin}
                  animate={{ rotate: finale === 'play' ? [0, -8, 8, 0] : 0, scale: [1, 1.06, 1] }}
                  transition={{ repeat: Infinity, duration: 2.4 }}
                >
                  <AdeliaMark className="h-7 w-7 object-contain" />
                </motion.div>
              )}
            </div>

            <div className={`${styles.player} ${styles.playerRight} ${(phase === 'choose_side' && !iChoose) || (finale !== 'play' && !iWon) ? styles.playerLive : ''}`}>
              <Avatar name={rivalName} photoUrl={rivalPhoto} live={(phase === 'choose_side' && !iChoose) || (finale !== 'play' && !iWon)} />
              <div className={styles.meta}>
                <span className={styles.role}>Rival</span>
                <span className={styles.name}>{rivalShort}</span>
                <span className={styles.sideTag}>{oddsEvensSideLabel(game?.rivalSide ?? null) || '—'}</span>
                <ScorePips score={game?.rivalScore ?? 0} />
              </div>
            </div>
          </header>
        ) : null}

        <AnimatePresence mode="wait">
          {finale === 'play' ? (
            <motion.div
              key="play"
              className="flex min-h-0 flex-1 flex-col overflow-y-auto"
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
                {!game ? (
                  <motion.div
                    className={styles.waitingMark}
                    animate={{ opacity: [0.55, 1, 0.55] }}
                    transition={{ repeat: Infinity, duration: 1.6 }}
                  >
                    Preparando el duelo…
                  </motion.div>
                ) : null}

                {game && phase === 'choose_side' && canChoose ? (
                  <div className={styles.choiceRow}>
                    <motion.button
                      type="button"
                      className={`${styles.choice} ${styles.choiceEven}`}
                      whileTap={{ scale: 0.96, y: 3 }}
                      onClick={() => onPickSide('even')}
                    >
                      Pares
                      <span className={styles.choiceCaption}>2, 4, 6, 8…</span>
                    </motion.button>
                    <motion.button
                      type="button"
                      className={styles.choice}
                      whileTap={{ scale: 0.96, y: 3 }}
                      onClick={() => onPickSide('odd')}
                    >
                      Nones
                      <span className={styles.choiceCaption}>1, 3, 5, 7…</span>
                    </motion.button>
                  </div>
                ) : null}

                {game && phase === 'choose_side' && !canChoose ? (
                  <motion.div
                    className={styles.waitingMark}
                    animate={{ opacity: [0.55, 1, 0.55] }}
                    transition={{ repeat: Infinity, duration: 1.6 }}
                  >
                    {rivalShort} está eligiendo el lado…
                  </motion.div>
                ) : null}

                {phase === 'pick_number' && shownPick == null ? (
                  <div className={styles.grid}>
                    {NUMBERS.map((value) => (
                      <motion.button
                        key={value}
                        type="button"
                        disabled={!canPickNumber}
                        onClick={() => lockNumber(value)}
                        className={styles.tile}
                        whileTap={canPickNumber ? { scale: 0.94 } : undefined}
                      >
                        {value}
                      </motion.button>
                    ))}
                  </div>
                ) : null}

                {phase === 'pick_number' && shownPick != null ? (
                  <motion.div
                    className={styles.lockedRow}
                    initial={{ scale: 0.86, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                  >
                    <div>
                      <NumberCard value={shownPick} size="lg" />
                      <p className={styles.lockedCaption}>Tú</p>
                    </div>
                    <div>
                      <NumberCard value={game?.rivalPick ?? 0} size="lg" hidden={game?.rivalPick == null} />
                      <p className={styles.lockedCaption}>
                        {game?.rivalPick != null || game?.rivalPicked ? rivalShort : 'Rival…'}
                      </p>
                    </div>
                  </motion.div>
                ) : null}

                {phase === 'reveal' ? (
                  <div className={styles.merge}>
                    <motion.div
                      initial={{ x: -80, opacity: 0, rotate: -12 }}
                      animate={{ x: 8, opacity: 1, rotate: -6 }}
                      transition={{ type: 'spring', stiffness: 240, damping: 18 }}
                    >
                      <NumberCard value={shownPick ?? game?.myPick ?? 0} />
                    </motion.div>
                    <motion.div
                      className={styles.sumCard}
                      initial={{ scale: 0.4, opacity: 0, rotateY: 80 }}
                      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                      transition={{ delay: 0.18, type: 'spring', stiffness: 220, damping: 16 }}
                    >
                      <span className={styles.sumValue}>{game?.lastSum ?? ''}</span>
                      <span className={styles.stamp}>
                        {game?.lastParity === 'even' ? 'Par' : 'Non'}
                      </span>
                    </motion.div>
                    <motion.div
                      initial={{ x: 80, opacity: 0, rotate: 12 }}
                      animate={{ x: -8, opacity: 1, rotate: 6 }}
                      transition={{ type: 'spring', stiffness: 240, damping: 18 }}
                    >
                      <NumberCard value={game?.rivalPick ?? 0} />
                    </motion.div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          ) : null}

          {finale === 'recap' ? (
            <motion.div
              key="recap"
              className={styles.recap}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            >
              <div className={styles.recapHead}>
                <p>Marcador final</p>
                <h2>Resultados</h2>
              </div>
              <ul className={styles.recapRows}>
                {(rounds.length ? rounds : [{ round: 1, myPick: shownPick ?? 0, rivalPick: game?.rivalPick ?? 0, sum: game?.lastSum ?? 0, parity: game?.lastParity ?? 'even', iWon: Boolean(iWon) }]).map((row, index) => (
                  <motion.li
                    key={row.round}
                    className={styles.recapRow}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.16 + index * 0.24 }}
                  >
                    <span className={styles.recapRound}>R{row.round}</span>
                    <span className={`${styles.recapCell} ${row.iWon ? styles.recapWin : ''}`}>{row.myPick}</span>
                    <span className={styles.recapSum}>{row.sum} {row.parity === 'even' ? 'par' : 'non'}</span>
                    <span className={`${styles.recapCell} ${!row.iWon ? styles.recapWin : ''}`}>{row.rivalPick}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ) : null}

          {finale === 'winner' ? (
            <motion.div
              key="winner"
              className={styles.winner}
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
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

export default OddsEvensTable

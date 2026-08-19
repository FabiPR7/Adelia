import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Flag, Footprints, Trophy } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import type { ReservationChallenge } from '../../types/reservationChallenges'
import {
  mazeCanMove,
  mazeCellIndex,
  mazeCellWalls,
  mazeCountdownLabel,
  mazeRaceOpen,
  mazeStep,
  type MazeDirection,
} from '../../types/maze'
import { burstChallengeConfetti } from '../../utils/challengeConfetti'
import { ChallengeTableHero } from './ChallengeTableHero'
import { AdeliaMark, playerInitials, usablePlayerPhoto } from './challengeBrand'
import styles from './MazeTable.module.css'

interface MazeTableProps {
  challenge: ReservationChallenge
  currentUid: string
  busy?: boolean
  error?: string | null
  onMove: (direction: MazeDirection) => void | Promise<unknown>
  onForfeit: () => void
  onAckResult?: () => void
  onFinish?: (ganadorId: string) => void
}

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

function cellStyle(bits: number, thin: boolean): CSSProperties {
  const walls = mazeCellWalls(bits)
  const w = thin ? 1 : 2
  const shadows = [
    walls.north ? `inset 0 ${w}px 0 #3d3229` : '',
    walls.east ? `inset -${w}px 0 0 #3d3229` : '',
    walls.south ? `inset 0 -${w}px 0 #3d3229` : '',
    walls.west ? `inset ${w}px 0 0 #3d3229` : '',
  ].filter(Boolean)
  return { boxShadow: shadows.join(', ') }
}

function MazeTable({
  challenge,
  currentUid,
  busy = false,
  error,
  onMove,
  onForfeit,
  onAckResult,
  onFinish,
}: MazeTableProps) {
  const { profile } = useAuth()
  const game = challenge.maze
  const [confirmForfeit, setConfirmForfeit] = useState(false)
  const [finale, setFinale] = useState<Finale>('play')
  const [canSkipRecap, setCanSkipRecap] = useState(false)
  const [local, setLocal] = useState({
    x: challenge.maze?.myX ?? challenge.maze?.startX ?? 0,
    y: challenge.maze?.myY ?? challenge.maze?.startY ?? 0,
  })
  const [bump, setBump] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const pendingRef = useRef(0)
  const queueRef = useRef(Promise.resolve<unknown>(undefined))
  const confettiRef = useRef('')
  const finishRef = useRef('')

  const isChallenged = challenge.challengedUid === currentUid
  const meName = isChallenged ? challenge.challengedDisplayName : challenge.challengerDisplayName
  const rivalName = isChallenged ? challenge.challengerDisplayName : challenge.challengedDisplayName
  const livePhoto = usablePlayerPhoto(profile?.photoUrl)
  const mePhoto = livePhoto || (isChallenged ? challenge.challengedPhotoUrl : challenge.challengerPhotoUrl)
  const rivalPhoto = isChallenged ? challenge.challengerPhotoUrl : challenge.challengedPhotoUrl
  const meShort = firstName(meName, 'Tú')
  const rivalShort = firstName(rivalName, 'el rival')
  const meInitial = playerInitials(meName)
  const rivalInitial = playerInitials(rivalName)

  const size = game?.size ?? 15
  const walls = game?.walls ?? []
  const goalX = game?.goalX ?? size - 1
  const goalY = game?.goalY ?? size - 1
  const startX = game?.startX ?? 0
  const startY = game?.startY ?? 0
  const rivalStartX = game?.rivalStartX ?? startX
  const rivalStartY = game?.rivalStartY ?? startY
  const rivalX = game?.rivalX ?? rivalStartX
  const rivalY = game?.rivalY ?? rivalStartY
  const tokenPct = Math.max(4.6, 68 / size)
  const startAt = game?.startAt ?? null
  const finished = game?.phase === 'done' || challenge.status === 'resolved'
  const countLabel = finale === 'play' && !finished ? mazeCountdownLabel(startAt, now) : null
  const raceOpen = mazeRaceOpen(startAt, now)
  const iWon = game?.iWon === true || challenge.winnerUid === currentUid
  const winnerUid = game?.winnerUid || challenge.winnerUid
  const winnerShort = iWon ? meShort : rivalShort
  const canPlay = Boolean(game) && finale === 'play' && !finished && raceOpen
  const sameCell = local.x === rivalX && local.y === rivalY
  const meLive = finale === 'play' || (finale === 'recap' && iWon)
  const rivalLive = finale === 'play' || (finale === 'recap' && !iWon)
  const canPlayRef = useRef(canPlay)
  const localRef = useRef(local)
  const wallsRef = useRef(walls)
  const sizeRef = useRef(size)
  const onMoveRef = useRef(onMove)
  canPlayRef.current = canPlay
  localRef.current = local
  wallsRef.current = walls
  sizeRef.current = size
  onMoveRef.current = onMove

  useEffect(() => {
    setConfirmForfeit(false)
  }, [challenge.id])

  useEffect(() => {
    if (!startAt || finished) {
      return
    }
    const at = Date.parse(startAt)
    if (!Number.isFinite(at) || Date.now() >= at + 520) {
      return
    }
    const tick = () => setNow(Date.now())
    tick()
    const id = window.setInterval(tick, 50)
    return () => window.clearInterval(id)
  }, [startAt, finished])

  useEffect(() => {
    if (!game) {
      return
    }
    if (pendingRef.current === 0 || game.phase === 'done') {
      setLocal({ x: game.myX, y: game.myY })
    }
  }, [game?.myX, game?.myY, game?.myMoves, game?.phase])

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
    const skipAt = window.setTimeout(() => setCanSkipRecap(true), 900)
    const goWinner = window.setTimeout(() => setFinale('winner'), 1800)
    return () => {
      window.clearTimeout(skipAt)
      window.clearTimeout(goWinner)
    }
  }, [finale])

  useEffect(() => {
    if (!finished || !iWon) {
      return
    }
    if (confettiRef.current === challenge.id) {
      return
    }
    confettiRef.current = challenge.id
    burstChallengeConfetti()
  }, [challenge.id, finished, iWon])

  useEffect(() => {
    if (!winnerUid || !finished) {
      return
    }
    if (finishRef.current === challenge.id) {
      return
    }
    finishRef.current = challenge.id
    onFinish?.(winnerUid)
  }, [challenge.id, finished, onFinish, winnerUid])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!canPlayRef.current) {
        return
      }
      const map: Record<string, MazeDirection> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        w: 'up',
        a: 'left',
        s: 'down',
        d: 'right',
        W: 'up',
        A: 'left',
        S: 'down',
        D: 'right',
      }
      const direction = map[event.key]
      if (!direction) {
        return
      }
      event.preventDefault()
      step(direction)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function step(direction: MazeDirection) {
    if (!canPlayRef.current) {
      return
    }
    const current = localRef.current
    const currentWalls = wallsRef.current
    const currentSize = sizeRef.current
    if (currentWalls.length !== currentSize * currentSize) {
      return
    }
    if (!mazeCanMove(currentWalls, currentSize, current.x, current.y, direction)) {
      setBump((value) => value + 1)
      return
    }
    const next = mazeStep(current.x, current.y, direction)
    localRef.current = next
    setLocal(next)
    pendingRef.current += 1
    queueRef.current = queueRef.current
      .then(() => onMoveRef.current(direction))
      .catch(() => undefined)
      .finally(() => {
        pendingRef.current = Math.max(0, pendingRef.current - 1)
      })
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Laberinto"
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
        <ChallengeTableHero
          title="Laberinto"
          lead="Salís juntos · el primero en la meta gana"
          venue={challenge.companyName}
        />

        {finale !== 'winner' ? (
          <header className={styles.hud}>
            <div className={`${styles.player} ${meLive ? styles.playerLive : ''}`}>
              <Avatar name={meName} photoUrl={mePhoto} live={meLive} />
              <div className={styles.meta}>
                <span className={styles.role}>Tú</span>
                <span className={styles.name}>{meShort}</span>
                <span className={styles.stat}>{game?.myMoves ?? 0} pasos</span>
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

            <div className={`${styles.player} ${styles.playerRight} ${rivalLive ? styles.playerLive : ''}`}>
              <Avatar name={rivalName} photoUrl={rivalPhoto} live={rivalLive} />
              <div className={styles.meta}>
                <span className={styles.role}>Rival</span>
                <span className={styles.name}>{rivalShort}</span>
                <span className={styles.stat}>{game?.rivalMoves ?? 0} pasos</span>
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
              <p className={styles.prompt}>
                {game?.prompt ?? 'Salís los dos desde la misma casilla. El primero en la meta gana.'}
              </p>

              <div className={styles.boardWrap}>
                <div
                  className={styles.board}
                  style={{ ['--maze-size' as string]: size }}
                  aria-label={`Laberinto ${size} por ${size}`}
                >
                  <div
                    className={styles.grid}
                    style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
                  >
                    {Array.from({ length: size * size }, (_, index) => {
                      const x = index % size
                      const y = Math.floor(index / size)
                      const bits = walls[mazeCellIndex(x, y, size)] ?? 15
                      const isStart = x === startX && y === startY
                      const isGoal = x === goalX && y === goalY
                      return (
                        <div
                          key={index}
                          className={[
                            styles.cell,
                            isStart ? styles.cellStart : '',
                            isGoal ? styles.cellGoal : '',
                          ].join(' ')}
                          style={cellStyle(bits, size >= 11)}
                        >
                          {isStart && !isGoal ? (
                            <span className={`${styles.cellMark} ${styles.cellMarkStart}`} aria-label="Salida">
                              <Footprints strokeWidth={2.6} />
                            </span>
                          ) : null}
                          {isGoal ? (
                            <span className={`${styles.cellMark} ${styles.cellMarkGoal}`} aria-label="Meta">
                              <Trophy strokeWidth={2.4} />
                            </span>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>

                  <div className={styles.tokens}>
                    <motion.div
                      className={`${styles.token} ${styles.tokenRival}`}
                      style={{ width: `${tokenPct}%`, height: `${tokenPct}%`, marginLeft: `${-tokenPct / 2}%`, marginTop: `${-tokenPct / 2}%` }}
                      animate={{
                        left: `${((rivalX + 0.5 + (sameCell ? 0.16 : 0)) / size) * 100}%`,
                        top: `${((rivalY + 0.5 + (sameCell ? 0.16 : 0)) / size) * 100}%`,
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                      aria-label={`Rival en ${rivalX + 1}, ${rivalY + 1}`}
                    >
                      {usablePlayerPhoto(rivalPhoto) ? (
                        <img src={usablePlayerPhoto(rivalPhoto)} alt="" />
                      ) : rivalInitial}
                    </motion.div>
                    <motion.div
                      className={`${styles.token} ${styles.tokenMe}`}
                      style={{ width: `${tokenPct}%`, height: `${tokenPct}%`, marginLeft: `${-tokenPct / 2}%`, marginTop: `${-tokenPct / 2}%` }}
                      animate={{
                        left: `${((local.x + 0.5 + (sameCell ? -0.16 : 0)) / size) * 100}%`,
                        top: `${((local.y + 0.5 + (sameCell ? -0.16 : 0)) / size) * 100}%`,
                        x: bump ? [0, -5, 5, -3, 0] : 0,
                      }}
                      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                      aria-label={`Tú en ${local.x + 1}, ${local.y + 1}`}
                    >
                      {usablePlayerPhoto(mePhoto) ? (
                        <img src={usablePlayerPhoto(mePhoto)} alt="" />
                      ) : meInitial}
                    </motion.div>
                  </div>

                  <AnimatePresence>
                    {countLabel ? (
                      <motion.div
                        className={styles.countOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <p className={styles.countHint}>Salís a la vez</p>
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
                </div>
              </div>

              <div className={styles.pad} role="group" aria-label="Cruceta">
                <span />
                <motion.button
                  type="button"
                  className={styles.padBtn}
                  whileTap={{ scale: 0.92 }}
                  disabled={!canPlay}
                  aria-label="Arriba"
                  onClick={() => step('up')}
                >
                  <ChevronUp size={32} />
                </motion.button>
                <span />
                <motion.button
                  type="button"
                  className={styles.padBtn}
                  whileTap={{ scale: 0.92 }}
                  disabled={!canPlay}
                  aria-label="Izquierda"
                  onClick={() => step('left')}
                >
                  <ChevronLeft size={32} />
                </motion.button>
                <div className={styles.padHub}>
                  <AdeliaMark className="h-7 w-7 object-contain" />
                </div>
                <motion.button
                  type="button"
                  className={styles.padBtn}
                  whileTap={{ scale: 0.92 }}
                  disabled={!canPlay}
                  aria-label="Derecha"
                  onClick={() => step('right')}
                >
                  <ChevronRight size={32} />
                </motion.button>
                <span />
                <motion.button
                  type="button"
                  className={styles.padBtn}
                  whileTap={{ scale: 0.92 }}
                  disabled={!canPlay}
                  aria-label="Abajo"
                  onClick={() => step('down')}
                >
                  <ChevronDown size={32} />
                </motion.button>
                <span />
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
              <span className={styles.recapMark} aria-hidden>{iWon ? '🏁' : '🌒'}</span>
              <h2 className={styles.recapTitle}>{iWon ? 'Has llegado a la meta' : `${winnerShort} llegó primero`}</h2>
              <p className={styles.recapBody}>
                {iWon
                  ? `Llegaste en ${game?.myMoves ?? 0} pasos. ${rivalShort} se queda a ${game?.rivalMoves ?? 0}.`
                  : `${winnerShort} pisó la meta. Tú ibas por ${game?.myMoves ?? 0} pasos.`}
              </p>
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
              <p className={styles.prompt}>Cerrando el duelo…</p>
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

export default MazeTable

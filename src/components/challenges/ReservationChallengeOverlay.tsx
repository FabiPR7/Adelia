import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Swords, X } from 'lucide-react'
import ChallengeMinigameSlot from './ChallengeMinigameSlot'
import ChallengeGameRoulette from './ChallengeGameRoulette'
import ThreeCardsTable from './ThreeCardsTable'
import OddsEvensTable from './OddsEvensTable'
import StopwatchTable from './StopwatchTable'
import MazeTable from './MazeTable'
import HotColdTable from './HotColdTable'
import { burstChallengeConfetti } from '../../utils/challengeConfetti'
import { CHALLENGE_MINIGAME_LABELS } from '../../types/reservationChallenges'
import type { ReservationChallenge } from '../../types/reservationChallenges'
import type { OddsEvensSide } from '../../types/oddsEvens'
import type { MazeDirection } from '../../types/maze'
import { useAuth } from '../../context/AuthContext'
import { AdeliaMark, playerInitials, usablePlayerPhoto } from './challengeBrand'
import styles from './ReservationChallengeOverlay.module.css'

interface ReservationChallengeOverlayProps {
  challenge: ReservationChallenge
  currentUid: string
  busy?: boolean
  error?: string | null
  onAccept: () => void
  onDecline: () => void
  onAckResult: () => void
  onPickDeck: (deckId: string) => void
  onRemoveCard: (cardId: string) => void
  onPickFinalCard: (cardId: string) => void
  onPickSide: (side: OddsEvensSide) => void
  onPickNumber: (value: number) => void
  onStartWatch: () => void | Promise<unknown>
  onStopWatch: (hundredths: number) => void | Promise<unknown>
  onMoveMaze: (direction: MazeDirection) => void | Promise<unknown>
  onPickHotCold: (value: number) => void | Promise<unknown>
  onForfeit: () => void
}

function Avatar({
  name,
  photoUrl,
  size = 'lg',
}: {
  name: string
  photoUrl: string
  size?: 'md' | 'lg'
}) {
  const photo = usablePlayerPhoto(photoUrl)
  const box = size === 'lg' ? styles.avatarLg : styles.avatarMd

  return (
    <div className={`${styles.avatar} ${box}`}>
      {photo ? (
        <img src={photo} alt="" />
      ) : (
        playerInitials(name)
      )}
    </div>
  )
}

function formatReservationWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PrimaryButton({
  children,
  onClick,
  busy,
}: {
  children: ReactNode
  onClick: () => void
  busy?: boolean
}) {
  return (
    <button type="button" disabled={busy} onClick={onClick} className={styles.primary}>
      {children}
    </button>
  )
}

function GhostButton({
  children,
  onClick,
  busy,
}: {
  children: ReactNode
  onClick: () => void
  busy?: boolean
}) {
  return (
    <button type="button" disabled={busy} onClick={onClick} className={styles.ghost}>
      {children}
    </button>
  )
}

function spinStorageKey(challengeId: string) {
  return `adelia.challenge.spin.${challengeId}`
}

function alreadySpun(challengeId: string) {
  try {
    return sessionStorage.getItem(spinStorageKey(challengeId)) === '1'
  } catch {
    return false
  }
}

function rememberSpin(challengeId: string) {
  try {
    sessionStorage.setItem(spinStorageKey(challengeId), '1')
  } catch {
    // private mode
  }
}

function ReservationChallengeOverlay({
  challenge,
  currentUid,
  busy = false,
  error,
  onAccept,
  onDecline,
  onAckResult,
  onPickDeck,
  onRemoveCard,
  onPickFinalCard,
  onPickSide,
  onPickNumber,
  onStartWatch,
  onStopWatch,
  onMoveMaze,
  onPickHotCold,
  onForfeit,
}: ReservationChallengeOverlayProps) {
  const { profile } = useAuth()
  const isChallenged = challenge.challengedUid === currentUid
  const isChallenger = challenge.challengerUid === currentUid
  const iWon = challenge.winnerUid === currentUid
  const confettiKeyRef = useRef('')
  const viewerPhoto = usablePlayerPhoto(profile?.photoUrl)
  const [spinDone, setSpinDone] = useState(() => alreadySpun(challenge.id))

  useEffect(() => {
    setSpinDone(alreadySpun(challenge.id))
  }, [challenge.id])

  useEffect(() => {
    if (
      challenge.status !== 'resolved'
      || !iWon
      || challenge.minigameId === 'stopwatch'
      || challenge.minigameId === 'odds_evens'
      || challenge.minigameId === 'maze'
      || challenge.minigameId === 'hot_cold'
      || challenge.minigameId === 'three_cards'
    ) {
      return
    }
    if (confettiKeyRef.current === challenge.id) {
      return
    }
    confettiKeyRef.current = challenge.id
    burstChallengeConfetti()
  }, [challenge.id, challenge.status, iWon])

  const opponentName = isChallenged ? challenge.challengerDisplayName : challenge.challengedDisplayName
  const opponentPhoto = isChallenged ? challenge.challengerPhotoUrl : challenge.challengedPhotoUrl
  const selfName = isChallenged ? challenge.challengedDisplayName : challenge.challengerDisplayName
  const selfPhoto = viewerPhoto || (isChallenged ? challenge.challengedPhotoUrl : challenge.challengerPhotoUrl)
  const winnerName = challenge.winnerUid === challenge.challengerUid
    ? challenge.challengerDisplayName
    : challenge.challengedDisplayName
  const whenLabel = formatReservationWhen(challenge.startTime)
  const showRoulette = challenge.status === 'active' && !spinDone

  if (showRoulette) {
    return (
      <ChallengeGameRoulette
        challenge={challenge}
        onDone={() => {
          rememberSpin(challenge.id)
          setSpinDone(true)
        }}
      />
    )
  }

  if (
    challenge.minigameId === 'three_cards'
    && (challenge.status === 'active' || (challenge.status === 'resolved' && challenge.threeCards))
  ) {
    return (
      <ThreeCardsTable
        challenge={challenge}
        currentUid={currentUid}
        busy={busy}
        error={error}
        onPickDeck={onPickDeck}
        onRemoveCard={onRemoveCard}
        onPickFinalCard={onPickFinalCard}
        onForfeit={onForfeit}
        onAckResult={onAckResult}
      />
    )
  }

  if (
    challenge.minigameId === 'odds_evens'
    && (challenge.status === 'active' || (challenge.status === 'resolved' && challenge.oddsEvens))
  ) {
    return (
      <OddsEvensTable
        challenge={challenge}
        currentUid={currentUid}
        busy={busy}
        error={error}
        onPickSide={onPickSide}
        onPickNumber={onPickNumber}
        onForfeit={onForfeit}
        onAckResult={onAckResult}
      />
    )
  }

  if (
    challenge.minigameId === 'stopwatch'
    && (challenge.status === 'active' || challenge.status === 'resolved')
    && (challenge.status === 'active' || challenge.stopwatch)
  ) {
    return (
      <StopwatchTable
        challenge={challenge}
        currentUid={currentUid}
        busy={busy}
        error={error}
        onStart={onStartWatch}
        onStop={onStopWatch}
        onForfeit={onForfeit}
        onAckResult={onAckResult}
      />
    )
  }

  if (
    challenge.minigameId === 'maze'
    && (challenge.status === 'active' || (challenge.status === 'resolved' && challenge.maze))
  ) {
    return (
      <MazeTable
        challenge={challenge}
        currentUid={currentUid}
        busy={busy}
        error={error}
        onMove={onMoveMaze}
        onForfeit={onForfeit}
        onAckResult={onAckResult}
      />
    )
  }

  if (
    challenge.minigameId === 'hot_cold'
    && (challenge.status === 'active' || (challenge.status === 'resolved' && challenge.hotCold))
  ) {
    return (
      <HotColdTable
        challenge={challenge}
        currentUid={currentUid}
        busy={busy}
        error={error}
        onPick={onPickHotCold}
        onForfeit={onForfeit}
        onAckResult={onAckResult}
      />
    )
  }

  const sheetClass = challenge.status === 'resolved'
    ? `${styles.sheet} ${iWon ? styles.sheetWin : styles.sheetLose}`
    : styles.sheet

  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="challenge-title"
        className={sheetClass}
        initial={{ y: 28, scale: 0.92, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 16, scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        <span className={`${styles.glow} ${styles.glowA}`} />
        <span className={`${styles.glow} ${styles.glowB}`} />

        {challenge.status === 'ringing' || challenge.status === 'active' ? (
          <button
            type="button"
            className={styles.close}
            onClick={onDecline}
            disabled={busy}
            aria-label="Cerrar reto"
          >
            <X size={18} />
          </button>
        ) : null}

        <div className={styles.brand}>
          <AdeliaMark className="h-10 w-auto object-contain" />
        </div>

        {challenge.status === 'ringing' && isChallenged ? (
          <>
            <p className={styles.kicker}>Te están retando</p>
            <h2 id="challenge-title" className={styles.title}>
              {challenge.challengerDisplayName} quiere tu mesa
            </h2>
            <p className={styles.venue}>
              {challenge.companyName}
              {whenLabel ? ` · ${whenLabel}` : ''}
            </p>

            <div className={styles.duel}>
              <div className={styles.player}>
                <Avatar name={challenge.challengerDisplayName} photoUrl={challenge.challengerPhotoUrl} />
                <span className={styles.playerName}>{challenge.challengerDisplayName}</span>
              </div>
              <motion.div
                className={styles.vs}
                animate={{ rotate: [0, -14, 14, 0], scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <Swords size={22} />
              </motion.div>
              <div className={styles.player}>
                <Avatar name={selfName} photoUrl={selfPhoto} />
                <span className={styles.playerName}>{selfName}</span>
              </div>
            </div>

            <div className={styles.stakes}>
              <p className={styles.stake}>
                <span className={styles.stakeIcon} aria-hidden>🏆</span>
                Si gana, la reserva de {challenge.companyName} pasa a su nombre.
              </p>
              <p className={styles.stake}>
                <span className={styles.stakeIcon} aria-hidden>🎟️</span>
                Si pierdes, entras como invitado: sin XP ni premios de esa mesa.
              </p>
            </div>
          </>
        ) : null}

        {challenge.status === 'ringing' && isChallenger ? (
          <>
            <p className={styles.kicker}>Reto enviado</p>
            <h2 id="challenge-title" className={styles.title}>
              Esperando a {opponentName}
            </h2>
            <p className={styles.waitCopy}>
              Le acaba de llegar el duelo por {challenge.companyName}.
            </p>
            <div className={styles.duel}>
              <div className={styles.player}>
                <Avatar name={selfName} photoUrl={selfPhoto} />
                <span className={styles.playerName}>Tú</span>
              </div>
              <motion.div
                className={styles.vs}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 4.5, ease: 'linear' }}
              >
                <Swords size={22} />
              </motion.div>
              <div className={styles.player}>
                <Avatar name={opponentName} photoUrl={opponentPhoto} />
                <span className={styles.playerName}>{opponentName}</span>
              </div>
            </div>
          </>
        ) : null}

        {challenge.status === 'active' ? (
          <>
            <p className={styles.kicker}>Duelo en {challenge.companyName}</p>
            <h2 id="challenge-title" className={styles.title}>
              {CHALLENGE_MINIGAME_LABELS[challenge.minigameId]}
            </h2>
            <div className={styles.duel}>
              <div className={styles.player}>
                <Avatar name={challenge.challengerDisplayName} photoUrl={challenge.challengerPhotoUrl} size="md" />
                <span className={styles.playerName}>{challenge.challengerDisplayName}</span>
              </div>
              <span className={styles.vs}>VS</span>
              <div className={styles.player}>
                <Avatar name={challenge.challengedDisplayName} photoUrl={challenge.challengedPhotoUrl} size="md" />
                <span className={styles.playerName}>{challenge.challengedDisplayName}</span>
              </div>
            </div>
            <div className="mt-6 w-full">
              <ChallengeMinigameSlot minigameId={challenge.minigameId} />
            </div>
          </>
        ) : null}

        {challenge.status === 'resolved' && iWon ? (
          <div className={styles.spectacle}>
            <p className={styles.kicker}>Has ganado el duelo</p>
            <h2 id="challenge-title" className={styles.title}>
              La reserva es tuya
            </h2>
            <motion.div
              className={`${styles.medal} ${styles.medalWin}`}
              initial={{ scale: 0.6, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14 }}
            >
              🏆
            </motion.div>
            <p className={styles.venue}>{challenge.companyName}</p>
            <p className={styles.body}>
              La mesa queda a tu nombre. {opponentName} entra como invitado.
            </p>
            <div className={styles.duel}>
              <div className={styles.player}>
                <Avatar name={selfName} photoUrl={selfPhoto} size="md" />
                <span className={styles.playerName}>Tú</span>
              </div>
              <span className={styles.vs}>👑</span>
              <div className={styles.player}>
                <Avatar name={opponentName} photoUrl={opponentPhoto} size="md" />
                <span className={styles.playerName}>{opponentName}</span>
              </div>
            </div>
          </div>
        ) : null}

        {challenge.status === 'resolved' && !iWon ? (
          <div className={styles.spectacle}>
            <p className={styles.kicker}>Has perdido el duelo</p>
            <h2 id="challenge-title" className={styles.title}>
              Esta vez no pudo ser
            </h2>
            <motion.div
              className={`${styles.medal} ${styles.medalLose}`}
              initial={{ scale: 0.7, y: 12 }}
              animate={{ scale: 1, y: 0 }}
            >
              💔
            </motion.div>
            <p className={styles.body}>
              La reserva de {challenge.companyName} se queda a nombre de {winnerName}.
              Entras como invitado: en esta mesa no sumas XP ni premios.
            </p>
            <div className={styles.duel}>
              <div className={styles.player}>
                <Avatar name={selfName} photoUrl={selfPhoto} size="md" />
                <span className={styles.playerName}>Tú</span>
              </div>
              <span className={styles.vs}>⚔️</span>
              <div className={styles.player}>
                <Avatar name={winnerName} photoUrl={opponentPhoto} size="md" />
                <span className={styles.playerName}>{winnerName}</span>
              </div>
            </div>
          </div>
        ) : null}

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          {challenge.status === 'ringing' && isChallenged ? (
            <>
              <PrimaryButton busy={busy} onClick={onAccept}>
                <Swords size={17} />
                Aceptar el duelo
              </PrimaryButton>
              <GhostButton busy={busy} onClick={onDecline}>
                Ahora no
              </GhostButton>
            </>
          ) : null}

          {challenge.status === 'ringing' && isChallenger ? (
            <GhostButton busy={busy} onClick={onDecline}>
              Cancelar reto
            </GhostButton>
          ) : null}

          {challenge.status === 'active' ? (
            <GhostButton busy={busy} onClick={onDecline}>
              Salir por ahora
            </GhostButton>
          ) : null}

          {challenge.status === 'resolved' ? (
            <PrimaryButton busy={busy} onClick={onAckResult}>
              {iWon ? '¡Vamos!' : 'Entendido'}
            </PrimaryButton>
          ) : null}
        </div>
      </motion.section>
    </motion.div>
  )
}

export default ReservationChallengeOverlay

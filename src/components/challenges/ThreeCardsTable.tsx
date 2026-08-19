import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flag } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { cardRankLabel } from '../../types/threeCards'
import type { ReservationChallenge } from '../../types/reservationChallenges'
import { burstChallengeConfetti } from '../../utils/challengeConfetti'
import { AdeliaMark, playerInitials, usablePlayerPhoto } from './challengeBrand'
import { ChallengeTableHero } from './ChallengeTableHero'
import styles from './ThreeCardsTable.module.css'

interface ThreeCardsTableProps {
  challenge: ReservationChallenge
  currentUid: string
  busy?: boolean
  error?: string | null
  onPickDeck: (deckId: string) => void
  onRemoveCard: (cardId: string) => void
  onPickFinalCard: (cardId: string) => void
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

function rankDrama(rank: number) {
  if (rank === 13) {
    return { title: '¡El Rey!', stamp: 'Rey', high: true }
  }
  if (rank === 12) {
    return { title: '¡La Reina!', stamp: 'Reina', high: true }
  }
  if (rank === 11) {
    return { title: '¡La Jota!', stamp: 'Jota', high: true }
  }
  if (rank === 10) {
    return { title: '¡Un 10!', stamp: '10', high: true }
  }
  if (rank >= 8) {
    return { title: `¡Un ${rank}!`, stamp: String(rank), high: true }
  }
  if (rank === 1) {
    return { title: 'Solo un as…', stamp: 'As', high: false }
  }
  return { title: `Sale un ${rank}`, stamp: String(rank), high: false }
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

function PlayingCard({
  rank,
  selected = false,
  onClick,
  size = 'md',
  disabled = false,
  dimmed = false,
  stamp,
}: {
  rank: number | null
  selected?: boolean
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  dimmed?: boolean
  stamp?: string
}) {
  const box = size === 'lg'
    ? 'h-[8.1rem] w-[5.7rem] text-[2.6rem]'
    : size === 'sm'
      ? 'h-[5.25rem] w-[3.65rem] text-[1.55rem]'
      : 'h-[6.55rem] w-[4.55rem] text-[2rem]'
  const faceUp = rank != null
  const high = rank != null && rank >= 10

  return (
    <motion.button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      whileTap={onClick && !disabled ? { scale: 0.96, y: 2 } : undefined}
      animate={{
        y: selected ? -16 : 0,
        scale: selected ? 1.07 : 1,
        opacity: dimmed ? 0.42 : 1,
        rotate: selected ? -2 : 0,
      }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className={`${styles.card} ${box} shrink-0 ${faceUp ? styles.cardFace : styles.cardBack} ${
        selected ? styles.cardSelected : ''
      } ${high ? styles.highCard : ''} disabled:cursor-default`}
    >
      {faceUp ? null : <span className={styles.cardShine} aria-hidden />}
      {stamp ? <span className={styles.stamp}>{stamp}</span> : null}
      {faceUp ? (
        <>
          <span className={`${styles.corner} ${styles.cornerTl}`}>{cardRankLabel(rank)}</span>
          <span className={`${styles.corner} ${styles.cornerBr}`}>{cardRankLabel(rank)}</span>
          <div className="flex h-full flex-col items-center justify-center">
            <span className={`${styles.rank} font-[family-name:var(--font-display)] font-semibold leading-none`}>
              {cardRankLabel(rank)}
            </span>
            <span className={styles.rankCaption}>
              {rank === 1 ? 'as' : rank === 11 ? 'jota' : rank === 12 ? 'reina' : rank === 13 ? 'rey' : ''}
            </span>
          </div>
        </>
      ) : (
        <div className={styles.cardBackMark}>
          <span className={styles.cardBackPlate}>
            <AdeliaMark className="h-7 w-7 object-contain" />
          </span>
        </div>
      )}
    </motion.button>
  )
}

function DeckStack({
  selected,
  onClick,
  disabled,
  index,
}: {
  selected: boolean
  onClick: () => void
  disabled: boolean
  index: number
}) {
  const fan = (index - 2) * 7

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      initial={{ y: 28, opacity: 0, rotate: fan - 8 }}
      animate={{
        y: selected ? -22 : Math.abs(index - 2) * 6,
        scale: selected ? 1.12 : 1,
        opacity: 1,
        rotate: selected ? fan * 0.35 : fan,
      }}
      transition={{ delay: index * 0.07, type: 'spring', stiffness: 280, damping: 18 }}
      className={`${styles.deck} ${selected ? styles.deckSelected : ''}`}
      aria-label={`Mazo ${index + 1}`}
    >
      <span className={styles.deckStack}>
        {[0, 1, 2, 3, 4].map((layer) => (
          <span
            key={layer}
            className={styles.deckLayer}
            style={{
              transform: `translate(${(4 - layer) * 2.6}px, ${(4 - layer) * 2.6}px)`,
              zIndex: layer,
            }}
          />
        ))}
        <span className={styles.deckTop}>
          <span className={styles.cardShine} aria-hidden />
          <AdeliaMark className={styles.deckLogo} />
          <span className={styles.deckCaption}>Adelia</span>
        </span>
      </span>
      <span className={styles.deckIndex}>{index + 1}</span>
    </motion.button>
  )
}

function TurnTimer({
  deadlineAt,
  myTurn,
  waiting,
}: {
  deadlineAt: string | null
  myTurn: boolean
  waiting: boolean
}) {
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
  const urgent = myTurn && seconds <= 5

  return (
    <div className={styles.timer}>
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="#fff" stroke="rgba(255,107,74,0.2)" strokeWidth="5" />
        {myTurn && deadlineAt ? (
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
        {myTurn && deadlineAt ? seconds : waiting ? '…' : 'VS'}
      </motion.span>
    </div>
  )
}

function PickConfirm({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={styles.pickConfirm}
      initial={{ opacity: 0, y: 8, scale: 0.86 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileTap={{ scale: 0.96, y: 1 }}
    >
      {label}
    </motion.button>
  )
}

function SparkBurst({ burstKey }: { burstKey: string }) {
  const bits = useMemo(() => (
    Array.from({ length: 16 }, (_, index) => {
      const angle = (index / 16) * Math.PI * 2
      const distance = 68 + (index % 4) * 16
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * (distance * 0.72) - 12,
        delay: index * 0.03,
      }
    })
  ), [burstKey])

  return (
    <div className={styles.sparkLayer} aria-hidden>
      {bits.map((bit, index) => (
        <motion.span
          key={`${burstKey}-${index}`}
          className={styles.spark}
          initial={{ x: '-50%', y: '-50%', opacity: 1, scale: 0.35 }}
          animate={{
            x: `calc(-50% + ${bit.x}px)`,
            y: `calc(-50% + ${bit.y}px)`,
            opacity: 0,
            scale: 1.25,
          }}
          transition={{ duration: 1.05, delay: bit.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

function ThreeCardsTable({
  challenge,
  currentUid,
  busy = false,
  error,
  onPickDeck,
  onRemoveCard,
  onPickFinalCard,
  onForfeit,
  onAckResult,
}: ThreeCardsTableProps) {
  const { profile } = useAuth()
  const game = challenge.threeCards
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmForfeit, setConfirmForfeit] = useState(false)
  const [finale, setFinale] = useState<Finale>('play')
  const [canSkipRecap, setCanSkipRecap] = useState(false)
  const seenRemovalRef = useRef<string | null>(null)
  const [burst, setBurst] = useState<{ key: string; high: boolean; lost: boolean } | null>(null)
  const confettiRef = useRef('')

  const isChallenged = challenge.challengedUid === currentUid
  const meName = isChallenged ? challenge.challengedDisplayName : challenge.challengerDisplayName
  const rivalName = isChallenged ? challenge.challengerDisplayName : challenge.challengedDisplayName
  const livePhoto = usablePlayerPhoto(profile?.photoUrl)
  const mePhoto = livePhoto || (isChallenged ? challenge.challengedPhotoUrl : challenge.challengerPhotoUrl)
  const rivalPhoto = isChallenged ? challenge.challengerPhotoUrl : challenge.challengedPhotoUrl
  const rivalShort = firstName(rivalName, 'el rival')
  const meShort = firstName(meName, 'Tú')

  const phase = game?.phase ?? 'pick_deck'
  const myTurn = Boolean(game && game.turnUid === currentUid)
  const canPickDeck = phase === 'pick_deck' && !game?.myDeckId
  const canRemove = phase === 'remove' && myTurn
  const canFinal = phase === 'final_pick' && myTurn
  const finished = phase === 'done' || challenge.status === 'resolved'
  const iWon = game?.iWon === true || challenge.winnerUid === currentUid
  const winnerShort = iWon ? meShort : rivalShort

  useEffect(() => {
    setSelectedId(null)
    setConfirmForfeit(false)
  }, [phase, game?.turnUid, game?.myDeckId, game?.lastRemoved?.cardId])

  useEffect(() => {
    const removed = game?.lastRemoved
    if (!removed) {
      return
    }
    if (seenRemovalRef.current === removed.cardId) {
      return
    }
    seenRemovalRef.current = removed.cardId
    const drama = rankDrama(removed.rank)
    const lost = removed.fromUid === currentUid
    setBurst({
      key: removed.cardId,
      high: drama.high,
      lost,
    })
    const timeout = window.setTimeout(() => setBurst(null), 1400)
    return () => window.clearTimeout(timeout)
  }, [currentUid, game?.lastRemoved])

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
    const skipAt = window.setTimeout(() => setCanSkipRecap(true), 1200)
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

  const action = useMemo(() => {
    if (!selectedId || busy) {
      return null
    }
    if (canPickDeck) {
      return { label: 'Me quedo este mazo', run: () => onPickDeck(selectedId) }
    }
    if (canRemove) {
      return { label: '¡Fuera esta carta!', run: () => onRemoveCard(selectedId) }
    }
    if (canFinal) {
      return { label: 'Esta es la mía', run: () => onPickFinalCard(selectedId) }
    }
    return null
  }, [busy, canFinal, canPickDeck, canRemove, onPickDeck, onPickFinalCard, onRemoveCard, selectedId])

  const copy = useMemo(() => {
    const removed = game?.lastRemoved
    if (phase === 'pick_deck' && canPickDeck) {
      return {
        kicker: 'Primera jugada',
        title: 'Escoge tu mazo',
        hint: 'Cinco mazos. Cuatro cartas. El rey manda y el as es el más débil.',
      }
    }
    if (phase === 'pick_deck') {
      return {
        kicker: 'Mazo listo',
        title: `Aguardando a ${rivalShort}`,
        hint: 'Cuando los dos hayáis elegido, empieza el duelo.',
      }
    }
    if (phase === 'tie') {
      return {
        kicker: 'Empate',
        title: 'Otro mazo, otra vida',
        hint: 'Nadie se rinde todavía. Elige de nuevo.',
      }
    }
    if (phase === 'remove' && canRemove) {
      return {
        kicker: 'Tu turno',
        title: `Roba una carta a ${rivalShort}`,
        hint: 'Busca el rey. Si fallas, puede doler.',
      }
    }
    if (phase === 'remove') {
      return {
        kicker: 'Aguanta',
        title: `${rivalShort} está cazando`,
        hint: 'Está eligiendo qué carta quitarte…',
      }
    }
    if (phase === 'reveal' && removed) {
      const drama = rankDrama(removed.rank)
      const lost = removed.fromUid === currentUid
      const stole = removed.byUid === currentUid
      return {
        kicker: drama.high ? (lost ? 'Menudo golpe' : 'Qué jugada') : 'Carta al descubierto',
        title: lost && drama.high
          ? `¡Te han birlado ${drama.stamp}!`
          : stole && drama.high
            ? `¡Te has llevado ${drama.stamp}!`
            : drama.title,
        hint: lost
          ? (drama.high ? 'Esa dolió. Aún puedes darle la vuelta.' : 'Menos mal. No era para tanto.')
          : (drama.high ? `Se la has birlado a ${rivalShort}.` : 'No era la gran amenaza.'),
      }
    }
    if (phase === 'showdown') {
      return {
        kicker: 'Cara a cara',
        title: 'Que hable la mesa',
        hint: 'La carta más alta se queda la reserva.',
      }
    }
    if (phase === 'final_pick' && canFinal) {
      return {
        kicker: 'Última ronda',
        title: 'Quédate con una',
        hint: 'Elige con cabeza. Esta decide el duelo.',
      }
    }
    if (phase === 'final_pick') {
      return {
        kicker: 'Última ronda',
        title: `${rivalShort} elige carta`,
        hint: 'Respira. Esto se acaba.',
      }
    }
    return {
      kicker: '3 cartas',
      title: game?.prompt ?? 'Preparando la mesa…',
      hint: '',
    }
  }, [canFinal, canPickDeck, canRemove, currentUid, game?.lastRemoved, game?.prompt, phase, rivalShort])

  const timedPhase = phase === 'remove' || phase === 'final_pick'
  const myCardsLeft = game?.myCards?.length ?? 0
  const rivalCardsLeft = game?.rivalCards?.length ?? 0

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="3 cartas"
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

      <AnimatePresence>
        {burst?.high ? (
          <motion.div
            key={`flash-${burst.key}`}
            className={styles.flash}
            initial={{ opacity: 0.42, background: burst.lost ? 'rgba(255,79,143,0.22)' : 'rgba(255,107,74,0.2)' }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
          />
        ) : null}
      </AnimatePresence>
      {burst ? <SparkBurst burstKey={burst.key} /> : null}

      <div className="relative z-[2] flex h-full flex-col px-3 pb-[max(0.8rem,env(safe-area-inset-bottom))] pt-[max(0.65rem,env(safe-area-inset-top))]">
        <ChallengeTableHero title="3 cartas" lead="El rey manda" venue={challenge.companyName} />

        {finale !== 'winner' ? (
          <header className={styles.hud}>
            <div className={`${styles.player} ${myTurn || (finale !== 'play' && iWon) ? styles.playerLive : ''}`}>
              <Avatar name={meName} photoUrl={mePhoto} live={myTurn || (finale !== 'play' && iWon)} />
              <div className={styles.meta}>
                <span className={styles.role}>{myTurn ? 'Tu turno' : 'Tú'}</span>
                <span className={styles.name}>{meShort}</span>
                <span className={styles.stock}>{myCardsLeft} {myCardsLeft === 1 ? 'carta' : 'cartas'}</span>
              </div>
            </div>

            <div className={styles.vsWrap}>
              {timedPhase && finale === 'play' ? (
                <TurnTimer
                  deadlineAt={game?.turnDeadlineAt ?? null}
                  myTurn={myTurn}
                  waiting={!myTurn}
                />
              ) : (
                <motion.div
                  className={styles.vsCoin}
                  animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.06, 1] }}
                  transition={{ repeat: Infinity, duration: 2.4 }}
                >
                  <AdeliaMark className="h-7 w-7 object-contain" />
                </motion.div>
              )}
            </div>

            <div className={`${styles.player} ${styles.playerRight} ${(!myTurn && game?.turnUid) || (finale !== 'play' && !iWon) ? styles.playerLive : ''}`}>
              <Avatar name={rivalName} photoUrl={rivalPhoto} live={(!myTurn && Boolean(game?.turnUid)) || (finale !== 'play' && !iWon)} />
              <div className={styles.meta}>
                <span className={styles.role}>{!myTurn && game?.turnUid ? 'Su turno' : 'Rival'}</span>
                <span className={styles.name}>{rivalShort}</span>
                <span className={styles.stock}>{rivalCardsLeft} {rivalCardsLeft === 1 ? 'carta' : 'cartas'}</span>
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
                <h2 className={styles.title}>{copy.title}</h2>
                {copy.hint ? <p className={styles.hint}>{copy.hint}</p> : null}
              </div>

              <div className={`${styles.stage} mt-3`}>
                {phase === 'pick_deck' || phase === 'tie' ? (
                  <div className="flex flex-1 flex-col items-center justify-center">
                    <div className={styles.deckRow}>
                      {(game?.decks ?? []).map((deck, index) => (
                        <div key={deck.id} className={styles.pickWrap}>
                          <DeckStack
                            index={index}
                            selected={selectedId === deck.id}
                            disabled={!canPickDeck || busy}
                            onClick={() => setSelectedId(deck.id)}
                          />
                          {canPickDeck && selectedId === deck.id ? (
                            <PickConfirm label="Aceptar" disabled={busy} onClick={() => onPickDeck(deck.id)} />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {phase === 'final_pick' ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-5">
                    <div className="flex flex-wrap items-end justify-center gap-3 pb-8">
                      {(game?.finalCards ?? []).map((card) => (
                        <div key={card.id} className={styles.pickWrap}>
                          <PlayingCard
                            rank={card.rank}
                            selected={selectedId === card.id}
                            disabled={!canFinal || Boolean(card.takenBy) || busy}
                            dimmed={Boolean(card.takenBy) && card.takenBy !== currentUid}
                            onClick={canFinal && !card.takenBy ? () => setSelectedId(card.id) : undefined}
                          />
                          {canFinal && selectedId === card.id && !card.takenBy ? (
                            <PickConfirm label="Aceptar" disabled={busy} onClick={() => onPickFinalCard(card.id)} />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {phase === 'remove' || phase === 'reveal' || phase === 'showdown' || phase === 'done' ? (
                  <>
                    {phase === 'remove' || phase === 'reveal' ? (
                      <div className="flex justify-center gap-2 pb-9 pt-1">
                        {(game?.rivalCards ?? []).map((card) => (
                          <div key={card.id} className={styles.pickWrap}>
                            <PlayingCard
                              rank={null}
                              size="sm"
                              selected={canRemove && selectedId === card.id}
                              disabled={!canRemove || busy}
                              onClick={canRemove ? () => setSelectedId(card.id) : undefined}
                            />
                            {canRemove && selectedId === card.id ? (
                              <PickConfirm label="Quitar" disabled={busy} onClick={() => onRemoveCard(card.id)} />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-6" />
                    )}

                    <div className="flex flex-1 flex-col items-center justify-center">
                      <AnimatePresence mode="wait">
                        {phase === 'remove' ? (
                          <motion.div
                            key="waiting-mark"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 0.7, scale: 1, rotate: [0, 8, -8, 0] }}
                            transition={{ rotate: { repeat: Infinity, duration: 6, ease: 'easeInOut' } }}
                          >
                            <AdeliaMark className="h-[4.5rem] w-[4.5rem] object-contain" />
                          </motion.div>
                        ) : null}

                        {phase === 'reveal' && game?.lastRemoved ? (
                          <motion.div
                            key={game.lastRemoved.cardId}
                            initial={{ rotateY: 110, scale: 0.55, opacity: 0, y: 24 }}
                            animate={{ rotateY: 0, scale: 1, opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16, scale: 0.9 }}
                            transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                            className="flex flex-col items-center gap-3"
                          >
                            <PlayingCard
                              rank={game.lastRemoved.rank}
                              size="lg"
                              stamp={rankDrama(game.lastRemoved.rank).stamp}
                            />
                          </motion.div>
                        ) : null}

                        {phase === 'showdown' && game?.showdown ? (
                          <motion.div
                            key="showdown"
                            initial={{ opacity: 0, scale: 0.86 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-end gap-5"
                          >
                            <motion.div
                              className="flex flex-col items-center gap-2"
                              initial={{ x: -30, rotate: -8 }}
                              animate={{ x: 0, rotate: -3 }}
                            >
                              <PlayingCard rank={game.showdown.myRank} size="lg" />
                              <span className={styles.showLabel}>Tú</span>
                            </motion.div>
                            <motion.span
                              className={styles.showVs}
                              animate={{ scale: [1, 1.18, 1] }}
                              transition={{ repeat: Infinity, duration: 1.4 }}
                            >
                              VS
                            </motion.span>
                            <motion.div
                              className="flex flex-col items-center gap-2"
                              initial={{ x: 30, rotate: 8 }}
                              animate={{ x: 0, rotate: 3 }}
                            >
                              <PlayingCard rank={game.showdown.rivalRank} size="lg" />
                              <span className={styles.showLabel}>{rivalShort}</span>
                            </motion.div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>

                    {phase === 'remove' || phase === 'reveal' ? (
                      <div className="mb-2 flex justify-center gap-2">
                        {(game?.myCards ?? []).map((card) => (
                          <PlayingCard key={card.id} rank={card.rank} disabled />
                        ))}
                      </div>
                    ) : (
                      <div className="mb-2 h-6" />
                    )}
                  </>
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
              exit={{ opacity: 0, y: -18, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            >
              <span className={styles.recapMark} aria-hidden>{iWon ? 'K' : 'A'}</span>
              <h2 className={styles.recapTitle}>{iWon ? 'Tu carta ha ganado' : `Gana la de ${winnerShort}`}</h2>
              <p className={styles.recapBody}>
                {iWon
                  ? `La más alta se queda la mesa de ${challenge.companyName}.`
                  : `${winnerShort} se queda la reserva. Entras como invitado.`}
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
              <>
                {action && !canRemove && !canFinal && !canPickDeck ? (
                  <motion.button
                    type="button"
                    disabled={busy}
                    onClick={action.run}
                    className={styles.cta}
                    whileTap={{ y: 3 }}
                  >
                    <span className={styles.ctaShine} />
                    {action.label}
                  </motion.button>
                ) : null}
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
              </>
            )
          ) : null}
        </footer>
      </div>
    </motion.div>
  )
}

export default ThreeCardsTable

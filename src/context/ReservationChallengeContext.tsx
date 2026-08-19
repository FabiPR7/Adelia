import { createContext, useContext, type ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import ReservationChallengeOverlay from '../components/challenges/ReservationChallengeOverlay'
import { useReservationChallenges } from '../hooks/useReservationChallenges'

type ReservationChallengeContextValue = ReturnType<typeof useReservationChallenges>

const ReservationChallengeContext = createContext<ReservationChallengeContextValue | null>(null)

export function ReservationChallengeProvider({ children }: { children: ReactNode }) {
  const api = useReservationChallenges()
  const challenge = api.visibleChallenge

  return (
    <ReservationChallengeContext.Provider value={api}>
      {children}
      <AnimatePresence>
        {challenge && api.currentUid ? (
          <ReservationChallengeOverlay
            key={challenge.id}
            challenge={challenge}
            currentUid={api.currentUid}
            busy={api.busy}
            error={api.error}
            onAccept={() => void api.acceptChallenge(challenge.id)}
            onDecline={() => void api.declineChallenge(challenge.id)}
            onAckResult={() => void api.ackResult(challenge.id)}
            onPickDeck={(deckId) => void api.pickDeck(challenge.id, deckId)}
            onRemoveCard={(cardId) => void api.removeCard(challenge.id, cardId)}
            onPickFinalCard={(cardId) => void api.pickFinalCard(challenge.id, cardId)}
            onPickSide={(side) => void api.pickSide(challenge.id, side)}
            onPickNumber={(number) => void api.pickNumber(challenge.id, number)}
            onStartWatch={() => api.startWatch(challenge.id)}
            onStopWatch={(hundredths) => api.stopWatch(challenge.id, hundredths)}
            onMoveMaze={(direction) => api.moveMaze(challenge.id, direction)}
            onPickHotCold={(value) => api.pickHotCold(challenge.id, value)}
            onForfeit={() => void api.forfeitGame(challenge.id)}
          />
        ) : null}
      </AnimatePresence>
    </ReservationChallengeContext.Provider>
  )
}

export function useReservationChallengeContext() {
  const context = useContext(ReservationChallengeContext)
  if (!context) {
    throw new Error('useReservationChallengeContext must be used within ReservationChallengeProvider')
  }
  return context
}

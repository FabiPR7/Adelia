import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  acceptReservationChallenge,
  ackReservationChallengeResult,
  createReservationChallenge,
  declineReservationChallenge,
  fetchLiveReservationChallenges,
  forfeitThreeCardsGame,
  pickOddsEvensNumber,
  pickOddsEvensSide,
  pickThreeCardsDeck,
  pickThreeCardsFinalCard,
  removeThreeCardsCard,
  startStopwatchGame,
  stopStopwatchGame,
  moveMazeGame,
  pickHotColdNumber,
  subscribeReservationChallenges,
} from '../services/customerReservationChallenges'
import { isLiveChallengeStatus, type ReservationChallenge } from '../types/reservationChallenges'
import type { MazeDirection } from '../types/maze'
import { usablePlayerPhoto } from '../components/challenges/challengeBrand'

function pickVisibleChallenge(uid: string, challenges: ReservationChallenge[]): ReservationChallenge | null {
  const live = challenges.filter((item) => {
    if (!isLiveChallengeStatus(item.status)) {
      return false
    }
    if (item.status === 'resolved' && item.resultAckedUids.includes(uid)) {
      return false
    }
    return true
  })

  const incoming = live.find((item) => item.status === 'ringing' && item.challengedUid === uid)
  if (incoming) {
    return incoming
  }

  const playing = live.find((item) => item.status === 'active')
  if (playing) {
    return playing
  }

  const outgoing = live.find((item) => item.status === 'ringing' && item.challengerUid === uid)
  if (outgoing) {
    return outgoing
  }

  return live.find((item) => item.status === 'resolved') ?? null
}

function pickPhoto(next: string, previous?: string): string {
  return usablePlayerPhoto(next) || usablePlayerPhoto(previous) || ''
}

function mergeOddsEvens(
  previous: ReservationChallenge['oddsEvens'] | null | undefined,
  incoming: ReservationChallenge['oddsEvens'] | null | undefined,
): ReservationChallenge['oddsEvens'] | null {
  if (!incoming) {
    return previous ?? null
  }
  if (!previous) {
    return incoming
  }
  if (incoming.round !== previous.round) {
    return incoming.round > previous.round ? incoming : previous
  }
  const rank = (phase: string) => (
    phase === 'done' ? 5
      : phase === 'reveal' ? 4
        : phase === 'pick_number' ? 3
          : 2
  )
  if (rank(incoming.phase) < rank(previous.phase)) {
    return previous
  }
  if (rank(incoming.phase) > rank(previous.phase)) {
    return incoming
  }
  if (incoming.phase === 'pick_number') {
    return {
      ...incoming,
      myPick: incoming.myPick ?? previous.myPick,
      rivalPicked: incoming.rivalPicked || previous.rivalPicked,
    }
  }
  return incoming
}

function mergeMaze(
  previous: ReservationChallenge['maze'] | null | undefined,
  incoming: ReservationChallenge['maze'] | null | undefined,
): ReservationChallenge['maze'] | null {
  if (!incoming) {
    return previous ?? null
  }
  if (!previous) {
    return incoming
  }
  if (incoming.phase === 'done') {
    return incoming
  }
  if (previous.phase === 'done') {
    return previous
  }
  const mine = incoming.myMoves >= previous.myMoves
    ? { myX: incoming.myX, myY: incoming.myY, myMoves: incoming.myMoves }
    : { myX: previous.myX, myY: previous.myY, myMoves: previous.myMoves }
  const rival = incoming.rivalMoves >= previous.rivalMoves
    ? { rivalX: incoming.rivalX, rivalY: incoming.rivalY, rivalMoves: incoming.rivalMoves }
    : { rivalX: previous.rivalX, rivalY: previous.rivalY, rivalMoves: previous.rivalMoves }
  return {
    ...incoming,
    ...mine,
    ...rival,
  }
}

function mergeHotCold(
  previous: ReservationChallenge['hotCold'] | null | undefined,
  incoming: ReservationChallenge['hotCold'] | null | undefined,
): ReservationChallenge['hotCold'] | null {
  if (!incoming) {
    return previous ?? null
  }
  if (!previous) {
    return incoming
  }
  if (incoming.phase === 'done') {
    return incoming
  }
  if (previous.phase === 'done') {
    return previous
  }
  if (incoming.guessAttempt !== previous.guessAttempt) {
    return incoming.guessAttempt > previous.guessAttempt ? incoming : previous
  }
  if (incoming.round !== previous.round) {
    return incoming.round > previous.round ? incoming : previous
  }
  const rank = (phase: string) => (
    phase === 'done' ? 5
      : phase === 'guess' ? 4
        : phase === 'probe' ? 3
          : 2
  )
  if (rank(incoming.phase) < rank(previous.phase)) {
    return previous
  }
  if (rank(incoming.phase) > rank(previous.phase)) {
    return incoming
  }
  return {
    ...incoming,
    myPick: incoming.myPick ?? previous.myPick,
    mySecret: incoming.mySecret ?? previous.mySecret,
    rivalReady: incoming.rivalReady || previous.rivalReady,
    rivalPicked: incoming.rivalPicked || previous.rivalPicked,
    clues: incoming.clues.length >= previous.clues.length ? incoming.clues : previous.clues,
  }
}

function mergeStopwatch(
  previous: ReservationChallenge['stopwatch'] | null | undefined,
  incoming: ReservationChallenge['stopwatch'] | null | undefined,
): ReservationChallenge['stopwatch'] | null {
  if (!incoming) {
    return previous ?? null
  }
  if (!previous) {
    return incoming
  }
  if (incoming.phase === 'done') {
    return incoming
  }
  if (incoming.turnIndex < previous.turnIndex) {
    return previous
  }
  if (
    incoming.turnIndex === previous.turnIndex
    && incoming.phase === 'idle'
    && previous.phase === 'running'
    && previous.myTimes.length >= incoming.myTimes.length
  ) {
    return previous
  }
  return incoming
}

function statusRank(status: ReservationChallenge['status']): number {
  if (status === 'resolved') {
    return 4
  }
  if (status === 'cancelled' || status === 'declined') {
    return 3
  }
  if (status === 'active') {
    return 2
  }
  return 1
}

function mergeChallengeStatus(
  previous: ReservationChallenge['status'] | undefined,
  incoming: ReservationChallenge['status'],
): ReservationChallenge['status'] {
  if (!previous || previous === incoming) {
    return incoming
  }
  return statusRank(previous) > statusRank(incoming) ? previous : incoming
}

function rememberClosedIds(items: ReservationChallenge[], into: Set<string>) {
  for (const item of items) {
    if (item.status === 'cancelled' || item.status === 'declined') {
      into.add(item.id)
    }
  }
}

function rejectResurrected(
  items: ReservationChallenge[],
  closedIds: Set<string>,
): ReservationChallenge[] {
  return items.filter((item) => {
    if (!closedIds.has(item.id)) {
      return true
    }
    return item.status !== 'ringing' && item.status !== 'active'
  })
}

function withPreservedGame(
  current: ReservationChallenge[],
  incoming: ReservationChallenge[],
): ReservationChallenge[] {
  const currentById = new Map(current.map((item) => [item.id, item]))
  return incoming
    .map((item) => {
      const previous = currentById.get(item.id)
      return {
        ...item,
        status: mergeChallengeStatus(previous?.status, item.status),
        challengerPhotoUrl: pickPhoto(item.challengerPhotoUrl, previous?.challengerPhotoUrl),
        challengedPhotoUrl: pickPhoto(item.challengedPhotoUrl, previous?.challengedPhotoUrl),
        threeCards: item.threeCards ?? previous?.threeCards ?? null,
        oddsEvens: mergeOddsEvens(previous?.oddsEvens, item.oddsEvens),
        stopwatch: mergeStopwatch(previous?.stopwatch, item.stopwatch),
        maze: mergeMaze(previous?.maze, item.maze),
        hotCold: mergeHotCold(previous?.hotCold, item.hotCold),
      }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function upsertChallenge(current: ReservationChallenge[], next: ReservationChallenge): ReservationChallenge[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  const prev = byId.get(next.id)
  byId.set(next.id, {
    ...next,
    status: mergeChallengeStatus(prev?.status, next.status),
    threeCards: next.threeCards ?? prev?.threeCards ?? null,
    oddsEvens: mergeOddsEvens(prev?.oddsEvens, next.oddsEvens),
    stopwatch: mergeStopwatch(prev?.stopwatch, next.stopwatch),
    maze: mergeMaze(prev?.maze, next.maze),
    hotCold: mergeHotCold(prev?.hotCold, next.hotCold),
  })
  return [...byId.values()]
}

export function useReservationChallenges() {
  const { user, profile } = useAuth()
  const [challenges, setChallenges] = useState<ReservationChallenge[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closedIdsRef = useRef(new Set<string>())

  const uid = user?.uid
  const hasActiveTimedGame = challenges.some((item) => {
    const timed = item.minigameId === 'three_cards'
      || item.minigameId === 'odds_evens'
      || item.minigameId === 'stopwatch'
      || item.minigameId === 'maze'
      || item.minigameId === 'hot_cold'
    if (!timed) {
      return false
    }
    if (item.status === 'active') {
      return true
    }
    return item.status === 'resolved'
      && (
        item.minigameId === 'stopwatch'
        || item.minigameId === 'odds_evens'
        || item.minigameId === 'maze'
        || item.minigameId === 'hot_cold'
        || item.minigameId === 'three_cards'
      )
      && Boolean(uid)
      && !item.resultAckedUids.includes(uid ?? '')
  })

  const hasActiveMaze = challenges.some((item) => (
    item.minigameId === 'maze'
    && (
      item.status === 'active'
      || (
        item.status === 'resolved'
        && Boolean(uid)
        && !item.resultAckedUids.includes(uid ?? '')
      )
    )
  ))
  const hasActiveHotCold = challenges.some((item) => (
    item.minigameId === 'hot_cold'
    && (
      item.status === 'active'
      || (
        item.status === 'resolved'
        && Boolean(uid)
        && !item.resultAckedUids.includes(uid ?? '')
      )
    )
  ))

  useEffect(() => {
    if (!user?.uid || profile?.role !== 'customer') {
      setChallenges([])
      return
    }

    return subscribeReservationChallenges(user.uid, (rows) => {
      setChallenges((current) => {
        rememberClosedIds(current, closedIdsRef.current)
        rememberClosedIds(rows, closedIdsRef.current)
        return withPreservedGame(current, rejectResurrected(rows, closedIdsRef.current))
      })
    })
  }, [user?.uid, profile?.role])

  useEffect(() => {
    if (!user?.uid || profile?.role !== 'customer') {
      return
    }

    let cancelled = false
    const pull = () => {
      void fetchLiveReservationChallenges()
        .then((rows) => {
          if (cancelled) {
            return
          }
          setChallenges((current) => {
            rememberClosedIds(current, closedIdsRef.current)
            rememberClosedIds(rows, closedIdsRef.current)
            const incoming = new Map(
              rejectResurrected(rows, closedIdsRef.current).map((item) => [item.id, item]),
            )
            const now = Date.now()
            for (const item of current) {
              if (incoming.has(item.id) || !isLiveChallengeStatus(item.status)) {
                continue
              }
              if (closedIdsRef.current.has(item.id)) {
                continue
              }
              const age = now - new Date(item.updatedAt).getTime()
              if (Number.isFinite(age) && age < 8000) {
                incoming.set(item.id, item)
              }
            }
            return withPreservedGame(current, [...incoming.values()])
          })
        })
        .catch(() => undefined)
    }

    pull()
    const interval = window.setInterval(pull, hasActiveMaze || hasActiveHotCold ? 700 : hasActiveTimedGame ? 800 : 2500)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [user?.uid, profile?.role, hasActiveTimedGame, hasActiveMaze, hasActiveHotCold])

  const visibleChallenge = useMemo(
    () => (user?.uid ? pickVisibleChallenge(user.uid, challenges) : null),
    [challenges, user?.uid],
  )

  const run = useCallback(async (task: () => Promise<ReservationChallenge | unknown>) => {
    setBusy(true)
    setError(null)
    try {
      const result = await task()
      if (result && typeof result === 'object' && 'id' in result && 'status' in result) {
        setChallenges((current) => {
          const next = upsertChallenge(current, result as ReservationChallenge)
          rememberClosedIds(next, closedIdsRef.current)
          return next
        })
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo completar el reto.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }, [])

  const challengeReservation = useCallback(async (reservationId: string) => {
    await run(() => createReservationChallenge(reservationId))
  }, [run])

  const acceptChallenge = useCallback(async (challengeId: string) => {
    await run(() => acceptReservationChallenge(challengeId))
  }, [run])

  const declineChallenge = useCallback(async (challengeId: string) => {
    await run(() => declineReservationChallenge(challengeId))
  }, [run])

  const ackResult = useCallback(async (challengeId: string) => {
    await run(() => ackReservationChallengeResult(challengeId))
  }, [run])

  const pickDeck = useCallback(async (challengeId: string, deckId: string) => {
    await run(() => pickThreeCardsDeck(challengeId, deckId))
  }, [run])

  const removeCard = useCallback(async (challengeId: string, cardId: string) => {
    await run(() => removeThreeCardsCard(challengeId, cardId))
  }, [run])

  const pickFinalCard = useCallback(async (challengeId: string, cardId: string) => {
    await run(() => pickThreeCardsFinalCard(challengeId, cardId))
  }, [run])

  const pickSide = useCallback(async (challengeId: string, side: 'even' | 'odd') => {
    await run(() => pickOddsEvensSide(challengeId, side))
  }, [run])

  const pickNumber = useCallback(async (challengeId: string, value: number) => {
    await run(() => pickOddsEvensNumber(challengeId, value))
  }, [run])

  const startWatch = useCallback(async (challengeId: string) => {
    await run(() => startStopwatchGame(challengeId))
  }, [run])

  const stopWatch = useCallback(async (challengeId: string, hundredths: number) => {
    await run(() => stopStopwatchGame(challengeId, hundredths))
  }, [run])

  const forfeitGame = useCallback(async (challengeId: string) => {
    await run(() => forfeitThreeCardsGame(challengeId))
  }, [run])

  const moveMaze = useCallback(async (challengeId: string, direction: MazeDirection) => {
    const apply = (result: ReservationChallenge) => {
      setChallenges((current) => {
        const next = upsertChallenge(current, result)
        rememberClosedIds(next, closedIdsRef.current)
        return next
      })
    }

    try {
      apply(await moveMazeGame(challengeId, direction))
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo mover en el laberinto.'
      const rateLimited = message.toLowerCase().includes('demasiad')
      if (rateLimited) {
        await new Promise((resolve) => window.setTimeout(resolve, 280))
        try {
          apply(await moveMazeGame(challengeId, direction))
          return
        } catch {
          return
        }
      }
      setError(message)
    }
  }, [])

  const pickHotCold = useCallback(async (challengeId: string, value: number) => {
    const apply = (result: ReservationChallenge) => {
      setChallenges((current) => {
        const next = upsertChallenge(current, result)
        rememberClosedIds(next, closedIdsRef.current)
        return next
      })
    }

    try {
      apply(await pickHotColdNumber(challengeId, value))
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'No se pudo elegir el número.'
      setError(message)
    }
  }, [])

  return {
    visibleChallenge,
    busy,
    error,
    clearError: () => setError(null),
    challengeReservation,
    acceptChallenge,
    declineChallenge,
    ackResult,
    pickDeck,
    removeCard,
    pickFinalCard,
    pickSide,
    pickNumber,
    startWatch,
    stopWatch,
    moveMaze,
    pickHotCold,
    forfeitGame,
    currentUid: user?.uid ?? '',
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CelebrationEvent } from '../utils/gamificationCelebration'
import {
  buildCelebrationEvents,
  createSnapshot,
  readGamificationSnapshot,
  writeGamificationSnapshot,
} from '../utils/gamificationCelebration'

interface UseGamificationCelebrationsOptions {
  userId?: string
  userName: string
  xp: number
  level: number
  levelTitle: string
  enabled: boolean
}

export function useGamificationCelebrations({
  userId,
  userName,
  xp,
  level,
  levelTitle,
  enabled,
}: UseGamificationCelebrationsOptions) {
  const [queue, setQueue] = useState<CelebrationEvent[]>([])
  const [activeEvent, setActiveEvent] = useState<CelebrationEvent | null>(null)
  const [rankJustImproved, setRankJustImproved] = useState(false)
  const [levelJustUp, setLevelJustUp] = useState(false)
  const bootstrappedRef = useRef(false)
  const lastXpRef = useRef<number | null>(null)

  const dismissActive = useCallback(() => {
    setActiveEvent(null)
  }, [])

  useEffect(() => {
    if (!enabled || !userId) {
      setQueue([])
      setActiveEvent(null)
      setRankJustImproved(false)
      setLevelJustUp(false)
      bootstrappedRef.current = false
      lastXpRef.current = null
      return
    }

    if (lastXpRef.current === xp && bootstrappedRef.current) {
      return
    }

    const snapshot = readGamificationSnapshot(userId)
    const nextSnapshot = createSnapshot(userName, xp, level, levelTitle)

    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true
      lastXpRef.current = xp

      if (snapshot && xp > snapshot.xp) {
        const events = buildCelebrationEvents(snapshot, userName, xp, level, levelTitle)
          .filter((event) => event.kind !== 'level_up')

        if (events.some((event) => event.kind === 'rank_up')) {
          setRankJustImproved(true)
          window.setTimeout(() => setRankJustImproved(false), 4500)
        }

        if (events.length > 0) {
          setQueue(events)
        }
      } else if (!snapshot) {
        writeGamificationSnapshot(userId, nextSnapshot)
        return
      }

      writeGamificationSnapshot(userId, nextSnapshot)
      return
    }

    if (snapshot && xp > snapshot.xp) {
      const events = buildCelebrationEvents(snapshot, userName, xp, level, levelTitle)

      if (events.some((event) => event.kind === 'rank_up')) {
        setRankJustImproved(true)
        window.setTimeout(() => setRankJustImproved(false), 4500)
      }

      if (events.length > 0) {
        setQueue((current) => [...current, ...events.filter((event) => event.kind !== 'level_up')])
      }
    }

    writeGamificationSnapshot(userId, nextSnapshot)
    lastXpRef.current = xp
  }, [enabled, userId, userName, xp, level, levelTitle])

  useEffect(() => {
    if (activeEvent || queue.length === 0) {
      return
    }

    const [next, ...rest] = queue
    setActiveEvent(next)
    setQueue(rest)
  }, [activeEvent, queue])

  useEffect(() => {
    if (!activeEvent) {
      return
    }

    const timeout = window.setTimeout(() => {
      setActiveEvent(null)
    }, 5200)

    return () => window.clearTimeout(timeout)
  }, [activeEvent])

  return {
    activeEvent,
    dismissActive,
    rankJustImproved,
    levelJustUp,
    hasCelebration: Boolean(activeEvent),
  }
}

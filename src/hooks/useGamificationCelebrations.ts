import { useCallback, useEffect, useRef, useState } from 'react'
import type { CelebrationEvent, CelebrationProgress } from '../utils/gamificationCelebration'
import {
  mergeCelebrationReceipts,
  missionCelebrationEvents,
  missionReceiptsForProgress,
  readCelebrationReceipts,
  unseenMissionCompletions,
  writeCelebrationReceipts,
} from '../utils/gamificationCelebration'

interface UseGamificationCelebrationsOptions {
  userId?: string
  weeklyCompleted: string[]
  monthlyCompleted: string[]
  completedMissions: string[]
  celebratedMissionIds: string[]
  weekKey: string
  monthKey: string
  enabled: boolean
  ready: boolean
  paused?: boolean
  onPersistReceipts?: (payload: {
    missionIds: string[]
    bootstrapped: boolean
  }) => void
}

function rememberLocalReceipts(userId: string, missionIds: string[]) {
  const current = readCelebrationReceipts(userId)
  writeCelebrationReceipts(userId, mergeCelebrationReceipts(current, {
    bootstrapped: true,
    missionIds,
  }))
}

export function useGamificationCelebrations({
  userId,
  weeklyCompleted,
  monthlyCompleted,
  completedMissions,
  celebratedMissionIds,
  weekKey,
  monthKey,
  enabled,
  ready,
  paused = false,
  onPersistReceipts,
}: UseGamificationCelebrationsOptions) {
  const [queue, setQueue] = useState<CelebrationEvent[]>([])
  const [activeEvent, setActiveEvent] = useState<CelebrationEvent | null>(null)
  const primedUserRef = useRef<string | null>(null)
  const absorbingInitialRef = useRef(false)
  const seenRef = useRef<Set<string>>(new Set())
  const persistRef = useRef(onPersistReceipts)
  persistRef.current = onPersistReceipts

  const progress: CelebrationProgress = {
    weeklyCompleted,
    monthlyCompleted,
    completedMissions,
  }

  const dismissActive = useCallback(() => {
    setActiveEvent(null)
  }, [])

  useEffect(() => {
    if (!userId) {
      primedUserRef.current = null
      absorbingInitialRef.current = false
      seenRef.current = new Set()
      setQueue([])
      setActiveEvent(null)
      return
    }

    if (!enabled || !ready) {
      return
    }

    const receipts = missionReceiptsForProgress(progress, weekKey, monthKey)
    const rawIds = [...weeklyCompleted, ...monthlyCompleted, ...completedMissions]

    if (primedUserRef.current !== userId) {
      primedUserRef.current = userId
      const localIds = readCelebrationReceipts(userId).missionIds
      seenRef.current = new Set([
        ...localIds,
        ...celebratedMissionIds,
        ...receipts,
        ...rawIds,
      ])
      absorbingInitialRef.current = receipts.length === 0 && rawIds.length === 0
      const missionIds = [...seenRef.current]
      rememberLocalReceipts(userId, missionIds)
      const alreadyStored = receipts.every((key) => celebratedMissionIds.includes(key))
        && rawIds.every((id) => celebratedMissionIds.includes(id))
      if (!alreadyStored && missionIds.length > 0) {
        persistRef.current?.({
          missionIds,
          bootstrapped: true,
        })
      }
      return
    }

    if (absorbingInitialRef.current) {
      for (const key of receipts) {
        seenRef.current.add(key)
      }
      for (const id of rawIds) {
        seenRef.current.add(id)
      }
      absorbingInitialRef.current = receipts.length === 0 && rawIds.length === 0
      if (!absorbingInitialRef.current) {
        rememberLocalReceipts(userId, [...seenRef.current])
        persistRef.current?.({
          missionIds: [...seenRef.current],
          bootstrapped: true,
        })
      }
      return
    }

    const unseen = unseenMissionCompletions(
      progress,
      [...seenRef.current, ...celebratedMissionIds],
      weekKey,
      monthKey,
    ).filter((item) => (
      !seenRef.current.has(item.receiptKey) && !seenRef.current.has(item.id)
    ))

    if (unseen.length === 0) {
      return
    }

    for (const item of unseen) {
      seenRef.current.add(item.receiptKey)
      seenRef.current.add(item.id)
    }

    const missionIds = [...seenRef.current]
    rememberLocalReceipts(userId, missionIds)
    persistRef.current?.({
      missionIds,
      bootstrapped: true,
    })

    const events = missionCelebrationEvents(unseen)
    setQueue((current) => {
      const seenEvents = new Set(current.map((event) => event.id))
      const fresh = events.filter((event) => !seenEvents.has(event.id))
      return fresh.length > 0 ? [...current, ...fresh] : current
    })
  }, [
    celebratedMissionIds,
    completedMissions,
    enabled,
    monthKey,
    monthlyCompleted,
    ready,
    userId,
    weekKey,
    weeklyCompleted,
  ])

  useEffect(() => {
    if (paused || activeEvent || queue.length === 0) {
      return
    }

    const [next, ...rest] = queue
    setActiveEvent(next)
    setQueue(rest)
  }, [activeEvent, paused, queue])

  useEffect(() => {
    if (!activeEvent || paused) {
      return
    }

    const timeout = window.setTimeout(() => {
      setActiveEvent(null)
    }, 5200)

    return () => window.clearTimeout(timeout)
  }, [activeEvent, paused])

  return {
    activeEvent,
    dismissActive,
    rankJustImproved: false,
    levelJustUp: false,
    hasCelebration: Boolean(activeEvent),
  }
}

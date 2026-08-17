import { useCallback, useEffect, useRef, useState } from 'react'
import type { CelebrationEvent, CelebrationProgress } from '../utils/gamificationCelebration'
import {
  applyProgressToReceipts,
  buildCelebrationEvents,
  mergeCelebrationReceipts,
  readCelebrationReceipts,
  receiptsToSnapshot,
  writeCelebrationReceipts,
} from '../utils/gamificationCelebration'

interface UseGamificationCelebrationsOptions {
  userId?: string
  userName: string
  xp: number
  level: number
  levelTitle: string
  weeklyCompleted: string[]
  monthlyCompleted: string[]
  completedMissions: string[]
  celebratedMissionIds: string[]
  celebrationsBootstrapped: boolean
  enabled: boolean
  hydrated: boolean
  paused?: boolean
  onPersistReceipts?: (payload: {
    missionIds: string[]
    bootstrapped: boolean
  }) => void
}

function progressFingerprint(xp: number, progress: CelebrationProgress, seenMissions: string[]): string {
  return [
    xp,
    [...progress.weeklyCompleted].sort().join(','),
    [...progress.monthlyCompleted].sort().join(','),
    [...progress.completedMissions].sort().join(','),
    [...seenMissions].sort().join(','),
  ].join('|')
}

export function useGamificationCelebrations({
  userId,
  userName,
  xp,
  level,
  levelTitle,
  weeklyCompleted,
  monthlyCompleted,
  completedMissions,
  celebratedMissionIds,
  celebrationsBootstrapped,
  enabled,
  hydrated,
  paused = false,
  onPersistReceipts,
}: UseGamificationCelebrationsOptions) {
  const [queue, setQueue] = useState<CelebrationEvent[]>([])
  const [activeEvent, setActiveEvent] = useState<CelebrationEvent | null>(null)
  const [rankJustImproved, setRankJustImproved] = useState(false)
  const [levelJustUp, setLevelJustUp] = useState(false)
  const lastFingerprintRef = useRef<string | null>(null)
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
    if (!enabled || !userId || !hydrated) {
      return
    }

    const local = readCelebrationReceipts(userId)
    const receipts = mergeCelebrationReceipts(local, {
      bootstrapped: celebrationsBootstrapped,
      missionIds: celebratedMissionIds,
    })

    if (!receipts.bootstrapped) {
      lastFingerprintRef.current = null
      return
    }

    const fingerprint = progressFingerprint(xp, progress, receipts.missionIds)
    if (lastFingerprintRef.current === fingerprint) {
      return
    }

    const events = buildCelebrationEvents(
      receiptsToSnapshot(receipts),
      userName,
      xp,
      level,
      levelTitle,
      progress,
    ).filter((event) => event.kind !== 'level_up')

    lastFingerprintRef.current = fingerprint

    if (events.length === 0) {
      return
    }

    const nextReceipts = applyProgressToReceipts(receipts, userName, xp, level, levelTitle, progress)
    writeCelebrationReceipts(userId, nextReceipts)
    persistRef.current?.({
      missionIds: nextReceipts.missionIds,
      bootstrapped: true,
    })

    if (events.some((event) => event.kind === 'rank_up')) {
      setRankJustImproved(true)
      window.setTimeout(() => setRankJustImproved(false), 4500)
    }

    if (level > receipts.lastCelebratedLevel && receipts.lastCelebratedLevel > 0) {
      setLevelJustUp(true)
      window.setTimeout(() => setLevelJustUp(false), 4500)
    }

    setQueue((current) => {
      const seen = new Set(current.map((event) => event.id))
      const fresh = events.filter((event) => !seen.has(event.id))
      return fresh.length > 0 ? [...current, ...fresh] : current
    })
  }, [
    celebratedMissionIds,
    celebrationsBootstrapped,
    completedMissions,
    enabled,
    hydrated,
    level,
    levelTitle,
    monthlyCompleted,
    userId,
    userName,
    weeklyCompleted,
    xp,
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
    rankJustImproved,
    levelJustUp,
    hasCelebration: Boolean(activeEvent),
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CustomerGamificationState } from '../types/gamification'
import {
  mergeCelebrationReceipts,
  readCelebrationReceipts,
  writeCelebrationReceipts,
} from '../utils/gamificationCelebration'

export interface LevelUpStep {
  fromLevel: number
  toLevel: number
}

interface UseLevelUpCelebrationOptions {
  userId?: string
  gamification: CustomerGamificationState
  currentLevel: number
  enabled: boolean
  ready: boolean
  refreshProfile: () => Promise<void>
  onAcknowledgedLevel?: (level: number, missionIds: string[]) => void
}

function buildLevelUpQueue(lastCelebrated: number, currentLevel: number): LevelUpStep[] {
  if (currentLevel <= lastCelebrated) {
    return []
  }

  const queue: LevelUpStep[] = []

  for (let level = lastCelebrated + 1; level <= currentLevel; level += 1) {
    queue.push({
      fromLevel: level - 1,
      toLevel: level,
    })
  }

  return queue
}

function rememberedLevel(userId: string): number {
  return readCelebrationReceipts(userId).lastCelebratedLevel
}

function rememberLocalLevel(userId: string, level: number) {
  const current = readCelebrationReceipts(userId)
  writeCelebrationReceipts(userId, mergeCelebrationReceipts(current, {
    bootstrapped: true,
    lastCelebratedLevel: level,
  }))
}

export function useLevelUpCelebration({
  userId,
  gamification,
  currentLevel,
  enabled,
  ready,
  refreshProfile,
  onAcknowledgedLevel,
}: UseLevelUpCelebrationOptions) {
  const [queue, setQueue] = useState<LevelUpStep[]>([])
  const [activeStep, setActiveStep] = useState<LevelUpStep | null>(null)
  const [acknowledging, setAcknowledging] = useState(false)
  const primedUserRef = useRef<string | null>(null)
  const seenLevelRef = useRef(0)
  const onAcknowledgedLevelRef = useRef(onAcknowledgedLevel)

  onAcknowledgedLevelRef.current = onAcknowledgedLevel

  useEffect(() => {
    if (!userId) {
      primedUserRef.current = null
      seenLevelRef.current = 0
      setQueue([])
      setActiveStep(null)
      return
    }

    if (!enabled || !ready) {
      return
    }

    const serverLast = typeof gamification.lastCelebratedLevel === 'number'
      ? gamification.lastCelebratedLevel
      : 0
    const knownLast = Math.max(serverLast, rememberedLevel(userId), seenLevelRef.current)

    if (primedUserRef.current !== userId) {
      primedUserRef.current = userId
      const baseline = Math.max(knownLast, currentLevel)
      seenLevelRef.current = baseline
      rememberLocalLevel(userId, baseline)
      if (serverLast < currentLevel) {
        onAcknowledgedLevelRef.current?.(
          currentLevel,
          gamification.celebratedMissionIds,
        )
      }
      return
    }

    if (currentLevel <= seenLevelRef.current) {
      if (knownLast > seenLevelRef.current) {
        seenLevelRef.current = knownLast
      }
      return
    }

    const previousSeen = seenLevelRef.current
    seenLevelRef.current = currentLevel
    rememberLocalLevel(userId, currentLevel)
    setQueue(buildLevelUpQueue(previousSeen, currentLevel))
    onAcknowledgedLevelRef.current?.(
      currentLevel,
      gamification.celebratedMissionIds,
    )
  }, [
    currentLevel,
    enabled,
    gamification.celebratedMissionIds,
    gamification.lastCelebratedLevel,
    ready,
    userId,
  ])

  useEffect(() => {
    if (activeStep || queue.length === 0) {
      return
    }

    const [next, ...rest] = queue
    setActiveStep(next)
    setQueue(rest)
  }, [activeStep, queue])

  const dismissActive = useCallback(async () => {
    if (!activeStep || !userId || acknowledging) {
      return
    }

    setAcknowledging(true)
    try {
      await refreshProfile()
    } catch {
      // El recibo ya se persistió al mostrar la animación.
    } finally {
      setActiveStep(null)
      setAcknowledging(false)
    }
  }, [activeStep, acknowledging, refreshProfile, userId])

  return {
    activeStep,
    dismissActive,
    acknowledging,
    hasLevelUpCelebration: Boolean(activeStep),
  }
}

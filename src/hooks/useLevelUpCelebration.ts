import { useCallback, useEffect, useRef, useState } from 'react'
import { acknowledgeCelebrations } from '../services/firestore'
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
  hydrated: boolean
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

function effectiveCelebratedLevel(userId: string, lastCelebrated: number | null): number {
  const local = readCelebrationReceipts(userId)
  const serverLevel = typeof lastCelebrated === 'number' && lastCelebrated > 0 ? lastCelebrated : 0
  return Math.max(local.lastCelebratedLevel, serverLevel)
}

export function useLevelUpCelebration({
  userId,
  gamification,
  currentLevel,
  enabled,
  hydrated,
  refreshProfile,
  onAcknowledgedLevel,
}: UseLevelUpCelebrationOptions) {
  const [queue, setQueue] = useState<LevelUpStep[]>([])
  const [activeStep, setActiveStep] = useState<LevelUpStep | null>(null)
  const [acknowledging, setAcknowledging] = useState(false)
  const pendingKeyRef = useRef('')
  const gamificationRef = useRef(gamification)
  const onAcknowledgedLevelRef = useRef(onAcknowledgedLevel)

  gamificationRef.current = gamification
  onAcknowledgedLevelRef.current = onAcknowledgedLevel

  useEffect(() => {
    if (!enabled || !userId) {
      setQueue([])
      setActiveStep(null)
      pendingKeyRef.current = ''
      return
    }

    if (!hydrated) {
      return
    }

    const bootstrapped =
      gamification.celebrationsBootstrapped
      || readCelebrationReceipts(userId).bootstrapped

    if (!bootstrapped) {
      return
    }

    const lastCelebrated = effectiveCelebratedLevel(userId, gamification.lastCelebratedLevel)

    if (lastCelebrated <= 0 || currentLevel <= lastCelebrated) {
      return
    }

    const pendingKey = `${lastCelebrated}->${currentLevel}`
    if (pendingKeyRef.current === pendingKey) {
      return
    }

    pendingKeyRef.current = pendingKey
    setQueue(buildLevelUpQueue(lastCelebrated, currentLevel))
  }, [
    enabled,
    userId,
    hydrated,
    gamification.celebrationsBootstrapped,
    gamification.lastCelebratedLevel,
    currentLevel,
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

    const receipts = mergeCelebrationReceipts(readCelebrationReceipts(userId), {
      bootstrapped: true,
      lastCelebratedLevel: activeStep.toLevel,
      missionIds: gamificationRef.current.celebratedMissionIds,
    })
    writeCelebrationReceipts(userId, receipts)
    onAcknowledgedLevelRef.current?.(activeStep.toLevel, receipts.missionIds)

    try {
      await acknowledgeCelebrations({
        level: activeStep.toLevel,
        missionIds: receipts.missionIds,
        bootstrapped: true,
      })
      await refreshProfile()
      setActiveStep(null)
    } catch {
      // Mantener el modal visible para reintentar.
    } finally {
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

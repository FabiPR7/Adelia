import { useCallback, useEffect, useRef, useState } from 'react'
import { acknowledgeLevelCelebration } from '../services/firestore'
import type { CustomerGamificationState } from '../types/gamification'

export interface LevelUpStep {
  fromLevel: number
  toLevel: number
}

interface UseLevelUpCelebrationOptions {
  userId?: string
  gamification: CustomerGamificationState
  currentLevel: number
  enabled: boolean
  refreshProfile: () => Promise<void>
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

export function useLevelUpCelebration({
  userId,
  gamification,
  currentLevel,
  enabled,
  refreshProfile,
}: UseLevelUpCelebrationOptions) {
  const [queue, setQueue] = useState<LevelUpStep[]>([])
  const [activeStep, setActiveStep] = useState<LevelUpStep | null>(null)
  const [acknowledging, setAcknowledging] = useState(false)
  const initializedRef = useRef(false)
  const pendingKeyRef = useRef('')
  const gamificationRef = useRef(gamification)

  gamificationRef.current = gamification

  useEffect(() => {
    if (!enabled || !userId) {
      setQueue([])
      setActiveStep(null)
      initializedRef.current = false
      return
    }

    const lastCelebrated = gamification.lastCelebratedLevel

    if (lastCelebrated == null) {
      if (initializedRef.current) {
        return
      }

      initializedRef.current = true
      void acknowledgeLevelCelebration(userId, gamification, currentLevel)
        .then(() => refreshProfile())
        .catch(() => {
          initializedRef.current = false
        })
      return
    }

    initializedRef.current = true

    if (currentLevel > lastCelebrated) {
      const pendingKey = `${lastCelebrated}->${currentLevel}`
      if (pendingKeyRef.current !== pendingKey) {
        pendingKeyRef.current = pendingKey
        setQueue(buildLevelUpQueue(lastCelebrated, currentLevel))
      }
    }
  }, [enabled, userId, gamification.lastCelebratedLevel, gamification, currentLevel, refreshProfile])

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
      await acknowledgeLevelCelebration(
        userId,
        gamificationRef.current,
        activeStep.toLevel,
      )
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

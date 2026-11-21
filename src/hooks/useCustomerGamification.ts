import { useEffect, useMemo, useRef, useState } from 'react'
import { PROFILE_REWARDS } from '../data/gamificationLevels'
import { useAuth } from '../context/AuthContext'
import { evaluateCustomerMissions, type ServerMissionsProgress } from '../services/firestore'
import { mergeMonotonicCelebrations } from '../utils/gamificationCelebration'
import type { Reservation } from '../types'
import type { CustomerGamificationState, MissionProgress } from '../types/gamification'
import { defaultGamificationState } from '../types/gamification'
import type { PublicDiscoveryRestaurant } from '../utils/publicDiscovery'
import type { CustomerVerifiedConsumption } from '../types/verifiedConsumption'
import { getLevelForXp, getLevelProgress, getXpToNextLevel } from '../utils/gamificationProgress'

interface UseCustomerGamificationOptions {
  reservations: Reservation[]
  favoriteSlugs: string[]
  /** Ya no se usa para calcular (lo hace el servidor); se mantiene por compatibilidad. */
  restaurants?: PublicDiscoveryRestaurant[]
  promotionCompanyIds?: Set<string>
  consumptions: CustomerVerifiedConsumption[]
  enabled: boolean
  onNewItemGrantBatches?: (
    batches: Array<{ grantKey: string; grants: Array<{ itemId: string; quantity: number }> }>,
  ) => void
}

const EMPTY_PROGRESS: ServerMissionsProgress = {
  weekly: [],
  monthly: [],
  historical: [],
  weeklyBonus: { completedCount: 0, bonusEarned: false, bonusXp: 0 },
  weeklyFeaturedCategory: '',
}

/**
 * Misiones y XP del cliente. El SERVIDOR evalúa el progreso con tus reservas,
 * consumos y favoritos, lo guarda y lo devuelve; aquí solo se pide y se pinta.
 * Se vuelve a pedir cuando cambian tus reservas, consumos o favoritos.
 */
export function useCustomerGamification({
  reservations,
  favoriteSlugs,
  consumptions,
  enabled,
  onNewItemGrantBatches,
}: UseCustomerGamificationOptions) {
  const { user, profile, patchProfileGamification } = useAuth()
  const [state, setState] = useState<CustomerGamificationState>(() =>
    profile?.gamification ?? defaultGamificationState(),
  )
  const [progress, setProgress] = useState<ServerMissionsProgress>(EMPTY_PROGRESS)
  const [syncing, setSyncing] = useState(false)
  const [evaluatedTick, setEvaluatedTick] = useState(0)
  const lastFingerprintRef = useRef('')
  const onNewItemGrantBatchesRef = useRef(onNewItemGrantBatches)
  onNewItemGrantBatchesRef.current = onNewItemGrantBatches
  const patchRef = useRef(patchProfileGamification)
  patchRef.current = patchProfileGamification

  useEffect(() => {
    if (!profile?.gamification) return
    setState((current) => mergeMonotonicCelebrations(current, profile.gamification))
  }, [profile?.gamification])

  // Lo que puede cambiar tu progreso: cuando cambia, se le pide al servidor otra vez.
  const fingerprint = useMemo(() => JSON.stringify({
    reservations: reservations.map((item) => `${item.id}:${item.status}:${item.promotionVisitStatus ?? ''}`).sort(),
    consumptions: consumptions.map((item) => item.id).sort(),
    favorites: [...favoriteSlugs].sort(),
  }), [reservations, consumptions, favoriteSlugs])

  useEffect(() => {
    if (!enabled || !user || profile?.role !== 'customer') return
    if (fingerprint === lastFingerprintRef.current) return
    let cancelled = false
    // Se espera a que los datos se asienten: al abrir llegan reservas, consumos y
    // favoritos por separado y antes se evaluaba dos veces (cada vez lee mucho).
    const timer = setTimeout(() => {
    lastFingerprintRef.current = fingerprint
    setSyncing(true)
    void evaluateCustomerMissions(fingerprint)
      .then((result) => {
        if (cancelled) return
        setState((current) => mergeMonotonicCelebrations(current, result.state))
        setProgress(result.progress)
        setEvaluatedTick((tick) => tick + 1)
        patchRef.current({
          xp: result.state.xp,
          inventory: result.state.inventory,
          grantedItemKeys: result.state.grantedItemKeys,
          weeklyCompleted: result.state.weeklyCompleted,
          monthlyCompleted: result.state.monthlyCompleted,
          completedMissions: result.state.completedMissions,
        })
        if (result.newItemGrantBatches.length > 0) {
          onNewItemGrantBatchesRef.current?.(result.newItemGrantBatches)
        }
      })
      .catch(() => {
        // Se reintenta en el siguiente cambio de datos.
        lastFingerprintRef.current = ''
      })
      .finally(() => {
        if (!cancelled) setSyncing(false)
      })
    }, 1200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [enabled, user, profile?.role, fingerprint])

  const level = useMemo(() => getLevelForXp(state.xp), [state.xp])
  const levelProgress = useMemo(() => getLevelProgress(state.xp, level), [state.xp, level])
  const xpToNext = useMemo(() => getXpToNextLevel(state.xp, level), [state.xp, level])
  const unlockedRewards = useMemo(
    () => PROFILE_REWARDS.filter((reward) => level.level >= reward.level),
    [level.level],
  )

  return {
    state,
    level,
    levelProgress,
    xpToNext,
    weeklyProgress: progress.weekly,
    monthlyProgress: progress.monthly,
    historicalProgress: progress.historical,
    weeklyBonus: progress.weeklyBonus,
    unlockedRewards,
    syncing,
    evaluatedTick,
    weeklyFeaturedCategory: progress.weeklyFeaturedCategory,
  }
}

export type CustomerGamificationView = ReturnType<typeof useCustomerGamification>

export function pickFeaturedMissions(progress: MissionProgress[], count = 4): MissionProgress[] {
  const incomplete = progress.filter((item) => !item.completed)
  const completed = progress.filter((item) => item.completed)

  return [...incomplete, ...completed].slice(0, count)
}

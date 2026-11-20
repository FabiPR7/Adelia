import { useSyncExternalStore } from 'react'
import { getIdToken } from './auth'
import type { PublicPromotion } from './publicPromotions'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

/**
 * Mapas de premios del cliente. El estado de cada escalón lo calcula el servidor
 * (server/promotions/ladderProgress.ts, mismas reglas que el canje); la web solo lo pinta.
 */
export type LadderNodeStatus =
  | 'claimed'
  | 'claimable'
  | 'awaiting'
  | 'in_progress'
  | 'active'
  | 'locked'

export interface LadderStepState {
  promotionId: string
  index: number
  required: number
  current: number
  status: 'claimed' | 'claimable' | 'in_progress' | 'active' | 'locked'
  awaiting: boolean
}

export interface LadderState {
  companyId: string
  confirmedCount: number
  baseline: number
  pendingCount: number
  completions: number
  activePromotionId: string | null
  focusPromotionId: string | null
  steps: LadderStepState[]
}

export type LaddersByCompany = Record<string, LadderState>

let current: LaddersByCompany = {}
let loadedAt = 0
let inFlight: Promise<LaddersByCompany> | null = null
const listeners = new Set<() => void>()
const FRESH_MS = 30_000

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function loadCustomerLadders(force = false): Promise<LaddersByCompany> {
  if (!force && loadedAt > 0 && Date.now() - loadedAt < FRESH_MS) return current
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const token = await getIdToken()
      if (!token) return current
      const response = await fetch(`${API_BASE}/api/customer/promotions/ladders`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) return current
      const payload = (await response.json()) as { ladders?: LaddersByCompany }
      current = payload.ladders ?? {}
      loadedAt = Date.now()
      emit()
      return current
    } catch {
      return current
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

/** Último estado cargado de tus mapas (lo comparten la lista, las tarjetas y el mapa). */
export function useCustomerLadders(): LaddersByCompany {
  return useSyncExternalStore(subscribe, () => current, () => current)
}

function stepOf(ladders: LaddersByCompany, promotion: Pick<PublicPromotion, 'id' | 'companyId'>) {
  return ladders[promotion.companyId]?.steps.find((step) => step.promotionId === promotion.id)
}

/** Estado de un escalón tal como lo pinta la web («awaiting» = a medias, pendiente de confirmar). */
export function ladderNodeStatus(
  ladders: LaddersByCompany,
  promotion: Pick<PublicPromotion, 'id' | 'companyId'>,
): LadderNodeStatus {
  const step = stepOf(ladders, promotion)
  if (!step) return 'locked'
  if (step.awaiting && (step.status === 'active' || step.status === 'in_progress')) return 'awaiting'
  return step.status
}

export function ladderStepProgress(
  ladders: LaddersByCompany,
  promotion: Pick<PublicPromotion, 'id' | 'companyId' | 'requiredReservations'>,
): { current: number; required: number } {
  const step = stepOf(ladders, promotion)
  return step
    ? { current: step.current, required: step.required }
    : { current: 0, required: Math.max(0, promotion.requiredReservations ?? 0) }
}

/** El mapa de este local va «en curso»: algo listo para reclamar, a medias o empezado. */
export function isLadderGroupActive(ladders: LaddersByCompany, companyId: string): boolean {
  return (ladders[companyId]?.steps ?? []).some(
    (step) => step.status === 'claimable' || step.status === 'in_progress' || step.awaiting,
  )
}

/** El escalón que toca ahora en este local, con su estado y progreso. */
export function activeLadderSummary(
  ladders: LaddersByCompany,
  ladderPromotions: PublicPromotion[],
): { promotion: PublicPromotion; status: LadderNodeStatus; current: number; required: number } | null {
  const companyId = ladderPromotions[0]?.companyId
  const state = companyId ? ladders[companyId] : undefined
  if (!state) return null
  const step = state.steps.find((item) => item.status !== 'claimed' && item.status !== 'locked')
  const promotion = step ? ladderPromotions.find((item) => item.id === step.promotionId) : undefined
  if (!step || !promotion) return null
  return { promotion, status: ladderNodeStatus(ladders, promotion), current: step.current, required: step.required }
}

/** Orden de los mapas en «En curso»: primero lo listo para reclamar, luego lo empezado, luego por distancia. */
export function compareLadderGroups(
  ladders: LaddersByCompany,
  left: { companyId: string; distanceKm: number | null },
  right: { companyId: string; distanceKm: number | null },
): number {
  const rank = (companyId: string) => {
    const steps = ladders[companyId]?.steps ?? []
    if (steps.some((step) => step.status === 'claimable')) return 0
    if (steps.some((step) => step.status === 'in_progress' || step.awaiting)) return 1
    return 2
  }
  return rank(left.companyId) - rank(right.companyId)
    || (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY)
}

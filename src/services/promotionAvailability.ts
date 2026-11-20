import { useSyncExternalStore } from 'react'
import { getIdToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

/**
 * Estado de cada promo para el cliente. Lo decide el servidor (hora de España, plazas,
 * límite por cliente, bloqueo por cancelaciones): la web solo lo pinta.
 * Servidor: server/promotions/promotionAvailability.ts
 */
export type PromotionLockReason =
  | 'promo_locked'
  | 'sold_out'
  | 'customer_limit'
  | 'outside_hours'
  | 'ended_today'

export interface PromotionAvailability {
  locked: boolean
  reason: PromotionLockReason | null
  badge: string | null
  title: string | null
  message: string | null
  action: 'reserve' | 'restaurant' | null
  usesLabel: string | null
  usesLeft: number | null
  notes: string[]
}

/** Premio del mapa de fidelidad: si se puede reclamar ahora. */
export interface LadderClaimStatus {
  soldOut: boolean
  limitReached: boolean
  windowClosed: boolean
  message: string | null
}

export interface PromotionAvailabilityState {
  availability: Record<string, PromotionAvailability>
  ladder: Record<string, LadderClaimStatus>
  promoLocked: boolean
}

let current: PromotionAvailabilityState | null = null
let loadedAt = 0
let inFlight: Promise<PromotionAvailabilityState | null> | null = null
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

export async function loadPromotionAvailability(force = false): Promise<PromotionAvailabilityState | null> {
  if (!force && current && Date.now() - loadedAt < FRESH_MS) return current
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const token = await getIdToken()
      if (!token) return null
      const response = await fetch(`${API_BASE}/api/customer/promotions/availability`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) return current
      const payload = (await response.json()) as Partial<PromotionAvailabilityState>
      current = {
        availability: payload.availability ?? {},
        ladder: payload.ladder ?? {},
        promoLocked: payload.promoLocked === true,
      }
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

/** Último estado cargado (lo comparten la lista de promos, la ficha y el mapa de premios). */
export function usePromotionAvailability(): PromotionAvailabilityState | null {
  return useSyncExternalStore(subscribe, () => current, () => null)
}

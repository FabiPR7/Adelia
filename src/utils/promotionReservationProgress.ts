import type { Reservation } from '../types'
import type { PublicPromotion } from '../services/publicPromotions'

export interface CompanyLadderRuntime {
  ladderBaselinesByCompany: Record<string, number>
  activeLadderPromotionByCompany: Record<string, string>
  ladderCompletionsByCompany: Record<string, number>
}

/** Reservas hechas pero sin confirmar asistencia en el restaurante. */
export function buildPendingReservationCounts(
  reservations: Reservation[],
): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const reservation of reservations) {
    if (reservation.status !== 'completed') {
      continue
    }

    counts[reservation.companyId] = (counts[reservation.companyId] ?? 0) + 1
  }

  return counts
}

export function sortCompanyLadderPromotions(
  promotions: PublicPromotion[],
): PublicPromotion[] {
  return promotions
    .filter(
      (promotion) =>
        promotion.type === 'reservation_ladder'
        && (promotion.requiredReservations ?? 0) > 0,
    )
    .sort(
      (left, right) =>
        (left.requiredReservations ?? 0) - (right.requiredReservations ?? 0)
        || left.id.localeCompare(right.id),
    )
}

/** Tras reclamar: una sola promo → la misma otra vez; varias → la siguiente en el escalón. */
export function getNextLadderPromotionId(
  companyLadderPromotions: PublicPromotion[],
  claimedPromotionId: string,
): string {
  const ladder = sortCompanyLadderPromotions(companyLadderPromotions)
  if (ladder.length === 0) {
    return claimedPromotionId
  }

  if (ladder.length === 1) {
    return ladder[0].id
  }

  const index = ladder.findIndex((promotion) => promotion.id === claimedPromotionId)
  if (index === -1) {
    return ladder[0].id
  }

  return ladder[(index + 1) % ladder.length].id
}

function claimedStorageKey(userKey: string): string {
  return `adelia_claimed_promos_${userKey}`
}

export function readClaimedPromotionIds(userKey: string): Set<string> {
  if (!userKey.trim()) {
    return new Set()
  }

  try {
    const raw = localStorage.getItem(claimedStorageKey(userKey))
    if (!raw) {
      return new Set()
    }

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return new Set()
    }

    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

export function persistClaimedPromotionId(userKey: string, promotionId: string): void {
  if (!userKey.trim() || !promotionId.trim()) {
    return
  }

  const next = readClaimedPromotionIds(userKey)
  next.add(promotionId)
  localStorage.setItem(claimedStorageKey(userKey), JSON.stringify([...next]))
}

export function buildCompanyLadderPromotionsMap(
  promotions: PublicPromotion[],
): Map<string, PublicPromotion[]> {
  const map = new Map<string, PublicPromotion[]>()

  for (const promotion of promotions) {
    if (promotion.type !== 'reservation_ladder') {
      continue
    }

    const existing = map.get(promotion.companyId) ?? []
    existing.push(promotion)
    map.set(promotion.companyId, existing)
  }

  return map
}

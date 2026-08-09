import type { Reservation } from '../types'
import type { PublicPromotion } from '../services/publicPromotions'
import type { ClaimedPromotionRecord } from '../types/gamification'

export interface PromotionLadderProgress {
  current: number
  required: number
  baseline: number
  nextThreshold: number
}

export interface CompanyLadderRuntime {
  ladderBaselinesByCompany: Record<string, number>
  activeLadderPromotionByCompany: Record<string, string>
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

export function buildPromotionClaimCounts(
  records: ClaimedPromotionRecord[],
): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const record of records) {
    counts[record.promotionId] = (counts[record.promotionId] ?? 0) + 1
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
        (left.requiredReservations ?? 0) - (right.requiredReservations ?? 0),
    )
}

export function resolveActiveLadderPromotionId(
  companyId: string,
  companyLadderPromotions: PublicPromotion[],
  activeLadderPromotionByCompany: Record<string, string>,
): string | null {
  const ladder = sortCompanyLadderPromotions(companyLadderPromotions)
  if (ladder.length === 0) {
    return null
  }

  const stored = activeLadderPromotionByCompany[companyId]
  if (stored && ladder.some((promotion) => promotion.id === stored)) {
    return stored
  }

  return ladder[0]?.id ?? null
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

export function getLadderProgress(
  promotion: PublicPromotion,
  confirmedCounts: Record<string, number>,
  ladderBaselinesByCompany: Record<string, number>,
): PromotionLadderProgress {
  const required = promotion.requiredReservations ?? 0
  const confirmedTotal = confirmedCounts[promotion.companyId] ?? 0
  const baseline = ladderBaselinesByCompany[promotion.companyId] ?? 0
  const rawCurrent = confirmedTotal - baseline
  const current = required > 0 ? Math.max(0, Math.min(required, rawCurrent)) : 0

  return {
    current,
    required,
    baseline,
    nextThreshold: baseline + required,
  }
}

export function getReservationProgress(
  promotion: PublicPromotion,
  confirmedCounts: Record<string, number>,
  ladderRuntime: CompanyLadderRuntime,
): PromotionLadderProgress {
  return getLadderProgress(
    promotion,
    confirmedCounts,
    ladderRuntime.ladderBaselinesByCompany,
  )
}

export function isActiveLadderPromotion(
  promotion: PublicPromotion,
  companyLadderPromotions: PublicPromotion[],
  activeLadderPromotionByCompany: Record<string, string>,
): boolean {
  const activeId = resolveActiveLadderPromotionId(
    promotion.companyId,
    companyLadderPromotions,
    activeLadderPromotionByCompany,
  )

  return promotion.id === activeId
}

export function isPromotionClaimable(
  promotion: PublicPromotion,
  confirmedCounts: Record<string, number>,
  ladderRuntime: CompanyLadderRuntime,
  companyLadderPromotions: PublicPromotion[],
): boolean {
  if (promotion.type !== 'reservation_ladder') {
    return false
  }

  if (
    !isActiveLadderPromotion(
      promotion,
      companyLadderPromotions,
      ladderRuntime.activeLadderPromotionByCompany,
    )
  ) {
    return false
  }

  const { current, required } = getLadderProgress(
    promotion,
    confirmedCounts,
    ladderRuntime.ladderBaselinesByCompany,
  )

  return required > 0 && current >= required
}

export function isPromotionAwaitingConfirmation(
  promotion: PublicPromotion,
  pendingCounts: Record<string, number>,
  companyLadderPromotions: PublicPromotion[],
  activeLadderPromotionByCompany: Record<string, string>,
): boolean {
  if (
    !isActiveLadderPromotion(
      promotion,
      companyLadderPromotions,
      activeLadderPromotionByCompany,
    )
  ) {
    return false
  }

  return (pendingCounts[promotion.companyId] ?? 0) > 0
}

export function isPromotionInProgress(
  promotion: PublicPromotion,
  confirmedCounts: Record<string, number>,
  pendingCounts: Record<string, number>,
  ladderRuntime: CompanyLadderRuntime,
  companyLadderPromotions: PublicPromotion[],
): boolean {
  if (promotion.type !== 'reservation_ladder') {
    return false
  }

  if (
    !isActiveLadderPromotion(
      promotion,
      companyLadderPromotions,
      ladderRuntime.activeLadderPromotionByCompany,
    )
  ) {
    return false
  }

  if (
    isPromotionClaimable(
      promotion,
      confirmedCounts,
      ladderRuntime,
      companyLadderPromotions,
    )
  ) {
    return false
  }

  if (
    isPromotionAwaitingConfirmation(
      promotion,
      pendingCounts,
      companyLadderPromotions,
      ladderRuntime.activeLadderPromotionByCompany,
    )
  ) {
    return true
  }

  const { current, required } = getLadderProgress(
    promotion,
    confirmedCounts,
    ladderRuntime.ladderBaselinesByCompany,
  )

  return required > 0 && current > 0 && current < required
}

export function remainingReservations(
  promotion: PublicPromotion,
  confirmedCounts: Record<string, number>,
  ladderRuntime: CompanyLadderRuntime,
): number {
  const { current, required } = getLadderProgress(
    promotion,
    confirmedCounts,
    ladderRuntime.ladderBaselinesByCompany,
  )

  return Math.max(0, required - current)
}

export function isActiveStripPromotion(
  promotion: PublicPromotion,
  confirmedCounts: Record<string, number>,
  pendingCounts: Record<string, number>,
  ladderRuntime: CompanyLadderRuntime,
  companyLadderPromotions: PublicPromotion[],
): boolean {
  if (promotion.type !== 'reservation_ladder') {
    return false
  }

  return (
    isPromotionClaimable(
      promotion,
      confirmedCounts,
      ladderRuntime,
      companyLadderPromotions,
    )
    || isPromotionInProgress(
      promotion,
      confirmedCounts,
      pendingCounts,
      ladderRuntime,
      companyLadderPromotions,
    )
  )
}

export function getClaimedPromotionIds(
  records: { promotionId: string }[],
  userKey = '',
): Set<string> {
  const ids = new Set(records.map((entry) => entry.promotionId))

  for (const id of readClaimedPromotionIds(userKey)) {
    ids.add(id)
  }

  return ids
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

export type PromotionSortGroup = 'claimable' | 'in_progress' | 'other'

export function getPromotionSortGroup(
  promotion: PublicPromotion,
  confirmedCounts: Record<string, number>,
  pendingCounts: Record<string, number>,
  ladderRuntime: CompanyLadderRuntime,
  companyLadderPromotions: PublicPromotion[],
): PromotionSortGroup {
  if (
    isPromotionClaimable(
      promotion,
      confirmedCounts,
      ladderRuntime,
      companyLadderPromotions,
    )
  ) {
    return 'claimable'
  }

  if (
    isPromotionInProgress(
      promotion,
      confirmedCounts,
      pendingCounts,
      ladderRuntime,
      companyLadderPromotions,
    )
  ) {
    return 'in_progress'
  }

  return 'other'
}

export function comparePromotionPriority(
  left: PublicPromotion,
  right: PublicPromotion,
  confirmedCounts: Record<string, number>,
  pendingCounts: Record<string, number>,
  ladderRuntime: CompanyLadderRuntime,
  leftCompanyLadder: PublicPromotion[],
  rightCompanyLadder: PublicPromotion[],
  leftDistanceKm: number | null,
  rightDistanceKm: number | null,
): number {
  const groupOrder: Record<PromotionSortGroup, number> = {
    claimable: 0,
    in_progress: 1,
    other: 2,
  }

  const leftGroup = getPromotionSortGroup(
    left,
    confirmedCounts,
    pendingCounts,
    ladderRuntime,
    leftCompanyLadder,
  )
  const rightGroup = getPromotionSortGroup(
    right,
    confirmedCounts,
    pendingCounts,
    ladderRuntime,
    rightCompanyLadder,
  )
  const groupDiff = groupOrder[leftGroup] - groupOrder[rightGroup]

  if (groupDiff !== 0) {
    return groupDiff
  }

  if (left.type === 'reservation_ladder' && right.type === 'reservation_ladder') {
    const requiredDiff = (left.requiredReservations ?? 0) - (right.requiredReservations ?? 0)
    if (requiredDiff !== 0) {
      return requiredDiff
    }
  }

  return (leftDistanceKm ?? Number.POSITIVE_INFINITY) - (rightDistanceKm ?? Number.POSITIVE_INFINITY)
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

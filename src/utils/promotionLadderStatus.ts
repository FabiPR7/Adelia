import type { PublicPromotion } from '../services/publicPromotions'
import type { ClaimedPromotionRecord } from '../types/gamification'
import {
  getLadderProgress,
  isPromotionAwaitingConfirmation,
  isPromotionClaimable,
  isPromotionInProgress,
  resolveActiveLadderPromotionId,
  sortCompanyLadderPromotions,
  type CompanyLadderRuntime,
} from './promotionReservationProgress'

export type LadderNodeStatus =
  | 'claimed'
  | 'claimable'
  | 'awaiting'
  | 'in_progress'
  | 'active'
  | 'locked'

export function getCompanyLadderCompletions(
  companyId: string,
  ladderCompletionsByCompany: Record<string, number>,
  claimedPromotions: ClaimedPromotionRecord[] = [],
  ladderSize = 0,
): number {
  const stored = ladderCompletionsByCompany[companyId] ?? 0

  if (ladderSize <= 0) {
    return stored
  }

  const companyClaimsCount = claimedPromotions.filter(
    (record) => record.companyId === companyId,
  ).length
  const inferred = Math.floor(companyClaimsCount / ladderSize)

  return Math.max(stored, inferred)
}

/** Promo activa del ciclo actual (reinicia al completar el mapa). */
export function resolveCycleActiveLadderPromotionId(
  companyId: string,
  ladderPromotions: PublicPromotion[],
  ladderRuntime: CompanyLadderRuntime,
  claimedPromotions: ClaimedPromotionRecord[],
): string | null {
  const sortedLadder = sortCompanyLadderPromotions(ladderPromotions)
  if (sortedLadder.length === 0) {
    return null
  }

  const cycleClaimedIds = getCurrentCycleClaimedIds(
    companyId,
    sortedLadder.length,
    claimedPromotions,
    ladderRuntime.ladderCompletionsByCompany,
  )

  const storedActive = resolveActiveLadderPromotionId(
    companyId,
    sortedLadder,
    ladderRuntime.activeLadderPromotionByCompany,
  )

  if (storedActive && !cycleClaimedIds.has(storedActive)) {
    return storedActive
  }

  return sortedLadder.find((promotion) => !cycleClaimedIds.has(promotion.id))?.id
    ?? sortedLadder[0]?.id
    ?? null
}

export function formatLadderCompletionsLabel(completions: number): string | null {
  if (completions <= 0) {
    return null
  }

  return completions === 1
    ? 'Completado 1 vez'
    : `Completado ${completions} veces`
}

/** Reclamaciones del ciclo actual (desde el último reinicio del mapa). */
export function getCurrentCycleClaimedIds(
  companyId: string,
  ladderSize: number,
  claimedPromotions: ClaimedPromotionRecord[],
  ladderCompletionsByCompany: Record<string, number>,
): Set<string> {
  if (ladderSize <= 0) {
    return new Set()
  }

  const completions = getCompanyLadderCompletions(
    companyId,
    ladderCompletionsByCompany,
    claimedPromotions,
    ladderSize,
  )
  const companyClaims = claimedPromotions
    .filter((record) => record.companyId === companyId)
    .sort(
      (left, right) => new Date(left.claimedAt).getTime() - new Date(right.claimedAt).getTime(),
    )

  const cycleStartIndex = completions * ladderSize
  return new Set(companyClaims.slice(cycleStartIndex).map((record) => record.promotionId))
}

export function buildClaimedPromotionIdSet(
  records: { promotionId: string }[],
): Set<string> {
  return new Set(records.map((entry) => entry.promotionId))
}

export function getLadderNodeStatus(
  promotion: PublicPromotion,
  ladderPromotions: PublicPromotion[],
  claimedPromotions: ClaimedPromotionRecord[],
  ladderRuntime: CompanyLadderRuntime,
  confirmedCounts: Record<string, number>,
  pendingCounts: Record<string, number>,
): LadderNodeStatus {
  const sortedLadder = sortCompanyLadderPromotions(ladderPromotions)
  const cycleClaimedIds = getCurrentCycleClaimedIds(
    promotion.companyId,
    sortedLadder.length,
    claimedPromotions,
    ladderRuntime.ladderCompletionsByCompany,
  )

  if (cycleClaimedIds.has(promotion.id)) {
    return 'claimed'
  }

  const activeId = resolveCycleActiveLadderPromotionId(
    promotion.companyId,
    sortedLadder,
    ladderRuntime,
    claimedPromotions,
  )
  const isActive = promotion.id === activeId
  const ladderRuntimeForCycle = activeId
    ? {
        ...ladderRuntime,
        activeLadderPromotionByCompany: {
          ...ladderRuntime.activeLadderPromotionByCompany,
          [promotion.companyId]: activeId,
        },
      }
    : ladderRuntime

  if (isActive) {
    if (
      isPromotionClaimable(
        promotion,
        confirmedCounts,
        ladderRuntimeForCycle,
        sortedLadder,
      )
    ) {
      return 'claimable'
    }

    if (
      isPromotionAwaitingConfirmation(
        promotion,
        pendingCounts,
        sortedLadder,
        ladderRuntimeForCycle.activeLadderPromotionByCompany,
      )
    ) {
      return 'awaiting'
    }

    if (
      isPromotionInProgress(
        promotion,
        confirmedCounts,
        pendingCounts,
        ladderRuntimeForCycle,
        sortedLadder,
      )
    ) {
      return 'in_progress'
    }

    return 'active'
  }

  return 'locked'
}

export function isLadderRestaurantActive(
  ladderPromotions: PublicPromotion[],
  confirmedCounts: Record<string, number>,
  pendingCounts: Record<string, number>,
  ladderRuntime: CompanyLadderRuntime,
  claimedPromotions: ClaimedPromotionRecord[],
): boolean {
  const sortedLadder = sortCompanyLadderPromotions(ladderPromotions)

  return sortedLadder.some((promotion) => {
    const status = getLadderNodeStatus(
      promotion,
      sortedLadder,
      claimedPromotions,
      ladderRuntime,
      confirmedCounts,
      pendingCounts,
    )

    return status === 'claimable'
      || status === 'awaiting'
      || status === 'in_progress'
  })
}

export function getActiveLadderPromotionSummary(
  ladderPromotions: PublicPromotion[],
  confirmedCounts: Record<string, number>,
  pendingCounts: Record<string, number>,
  ladderRuntime: CompanyLadderRuntime,
  claimedPromotions: ClaimedPromotionRecord[],
): { promotion: PublicPromotion; status: LadderNodeStatus; current: number; required: number } | null {
  const sortedLadder = sortCompanyLadderPromotions(ladderPromotions)

  for (const promotion of sortedLadder) {
    const status = getLadderNodeStatus(
      promotion,
      sortedLadder,
      claimedPromotions,
      ladderRuntime,
      confirmedCounts,
      pendingCounts,
    )

    if (status === 'locked' || status === 'claimed') {
      continue
    }

    const { current, required } = getLadderProgress(
      promotion,
      confirmedCounts,
      ladderRuntime.ladderBaselinesByCompany,
    )

    return { promotion, status, current, required }
  }

  return null
}

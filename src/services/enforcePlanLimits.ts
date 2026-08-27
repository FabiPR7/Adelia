import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { parseCompanyPlanId } from '../data/companyPlans'
import {
  clampFloorPlansEnabled,
  planAllowsDeposits,
  planMaxCount,
  planMaxPromosOfType,
  menuBoardActivationBlockReason,
} from '../data/companyPlanLimits'
import type { PromotionType } from '../types/company'
import { getCompanyMenuBoards, setCompanyMenuBoardActive } from './companyMenu'
import { getCompanyPromotions, setCompanyPromotionActive } from './promotions'
import { getCompanyById, updateCompanyFloorPlans } from './firestore'

export async function applyClientPlanFeatureLimits(companyId: string, nextPlanId: unknown): Promise<void> {
  const planId = parseCompanyPlanId(nextPlanId)
  const company = await getCompanyById(companyId)
  if (!company) {
    return
  }

  const floorPlans = clampFloorPlansEnabled(company.floorPlans, planId)
  await updateCompanyFloorPlans(companyId, floorPlans)

  if (!planAllowsDeposits(planId) && company.depositEnabled) {
    await updateDoc(doc(db, 'companies', companyId), {
      depositEnabled: false,
      updatedAt: serverTimestamp(),
    })
  }

  const promotions = await getCompanyPromotions(companyId)
  const promoTypes: PromotionType[] = ['reservation_ladder', 'time_limited', 'attendance']
  const keptPromoIds = new Set<string>()
  for (const type of promoTypes) {
    const ofType = promotions
      .filter((promotion) => promotion.type === type)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    const maxPromos = planMaxPromosOfType(planId, type)
    const kept = maxPromos == null ? ofType : ofType.slice(0, maxPromos)
    for (const promotion of kept) {
      keptPromoIds.add(promotion.id)
    }
  }

  await Promise.all(
    promotions
      .filter((promotion) => promotion.active && !keptPromoIds.has(promotion.id))
      .map((promotion) => setCompanyPromotionActive(companyId, promotion.id, false)),
  )

  const boards = await getCompanyMenuBoards(companyId)
  if (planId === 'free') {
    await Promise.all(
      boards
        .filter((board) => board.active)
        .map((board) => setCompanyMenuBoardActive(companyId, board.id, false)),
    )
    return
  }

  const compliant = boards
    .filter((board) => board.active && !menuBoardActivationBlockReason(board, boards, planId))
    .sort((left, right) => left.sortOrder - right.sortOrder)
  const maxMenus = planMaxCount(planId, 'menus')
  const keptBoardIds = new Set(
    (maxMenus == null ? compliant : compliant.slice(0, maxMenus)).map((board) => board.id),
  )

  await Promise.all(
    boards
      .filter((board) => board.active && !keptBoardIds.has(board.id))
      .map((board) => setCompanyMenuBoardActive(companyId, board.id, false)),
  )
}

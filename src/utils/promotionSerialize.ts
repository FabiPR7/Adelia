// Cómo se lee y se guarda una promoción. Lo usan el panel (para pintar) y el
// servidor (para guardar): mismas reglas en los dos lados.
import type { CompanyPromotion, PromotionInput } from '../types/company'
import {
  buildPromotionProductRefs,
  formatPromotionOfferHighlight,
  normalizePromotionOffer,
  normalizePromotionProductRefs,
} from './promotionOffer'

export function mapPromotion(id: string, companyId: string, data: Record<string, unknown>): CompanyPromotion {
  return {
    id,
    companyId,
    type: data.type as CompanyPromotion['type'],
    title: (data.title as string) ?? '',
    description: (data.description as string) ?? '',
    photoUrl: (data.photoUrl as string) ?? '',
    offer: normalizePromotionOffer(data),
    productRefs: normalizePromotionProductRefs(data),
    active: data.active === true,
    requiresReservation: data.requiresReservation === true,
    requiredReservations: typeof data.requiredReservations === 'number'
      ? data.requiredReservations
      : null,
    minimumSpendEnabled: data.minimumSpendEnabled === true,
    minimumSpendCents: typeof data.minimumSpendCents === 'number'
      ? data.minimumSpendCents
      : null,
    activeFromTime: (data.activeFromTime as string) ?? '',
    activeToTime: (data.activeToTime as string) ?? '',
    maxRedemptions: typeof data.maxRedemptions === 'number' ? data.maxRedemptions : null,
    currentRedemptions: typeof data.currentRedemptions === 'number' ? data.currentRedemptions : 0,
    arrivalWindowMinutes: typeof data.arrivalWindowMinutes === 'number'
      ? data.arrivalWindowMinutes
      : null,
    maxClaimsPerCustomer: typeof data.maxClaimsPerCustomer === 'number' && data.maxClaimsPerCustomer > 0
      ? data.maxClaimsPerCustomer
      : null,
    claimWindowEnabled: data.claimWindowEnabled === true,
    createdAt: (data.createdAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? new Date(),
  }
}

export function serializePromotion(
  companyId: string,
  input: PromotionInput,
  productRefs: ReturnType<typeof buildPromotionProductRefs>,
) {
  return {
    companyId,
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    photoUrl: input.photoUrl.trim(),
    offer: input.offer,
    productRefs,
    offerHighlight: formatPromotionOfferHighlight(input.offer),
    active: input.active,
    requiresReservation: input.requiresReservation,
    requiredReservations: input.requiredReservations,
    minimumSpendEnabled: input.minimumSpendEnabled,
    minimumSpendCents: input.minimumSpendEnabled ? input.minimumSpendCents : null,
    activeFromTime: input.activeFromTime,
    activeToTime: input.activeToTime,
    maxRedemptions: input.maxRedemptions,
    arrivalWindowMinutes: input.arrivalWindowMinutes,
    maxClaimsPerCustomer: input.maxClaimsPerCustomer,
    claimWindowEnabled: input.type === 'reservation_ladder' && input.claimWindowEnabled,
  }
}

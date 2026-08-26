import type { Company, PromotionInput, PromotionProductRef } from '../types'
import type { PublicPromotion } from '../services/publicPromotions'
import { getCompanyMainPhotoUrl } from './companyPhotos'
import { resolvePromotionDetail, resolvePromotionHighlight } from './promotionOffer'

export function buildPromotionScanPreview(
  company: Pick<
    Company,
    | 'id'
    | 'name'
    | 'slug'
    | 'logoUrl'
    | 'photos'
    | 'mainPhotoIndex'
    | 'latitude'
    | 'longitude'
    | 'reservationMode'
  >,
  form: PromotionInput,
  productRefs: PromotionProductRef[],
  promotionId: string,
): PublicPromotion {
  const companyPhotoUrl = getCompanyMainPhotoUrl(company.photos, company.mainPhotoIndex)
    || company.logoUrl
    || ''
  const productPhoto = productRefs.find((ref) => ref.photoUrl.trim())?.photoUrl ?? ''
  const photoUrl = form.photoUrl.trim() || productPhoto || companyPhotoUrl
  const promotion: PublicPromotion = {
    id: promotionId,
    companyId: company.id,
    companyName: company.name,
    companySlug: company.slug,
    companyPhotoUrl,
    companyLatitude: company.latitude,
    companyLongitude: company.longitude,
    type: form.type,
    title: form.title.trim() || 'Promoción',
    description: form.description.trim(),
    photoUrl,
    offer: form.offer,
    productRefs,
    requiredReservations: form.requiredReservations,
    minimumSpendEnabled: form.minimumSpendEnabled,
    minimumSpendCents: form.minimumSpendCents,
    activeFromTime: form.activeFromTime,
    activeToTime: form.activeToTime,
    arrivalWindowMinutes: form.arrivalWindowMinutes,
    maxRedemptions: form.maxRedemptions,
    currentRedemptions: 0,
    detail: '',
    highlight: '',
    reservationMode: company.reservationMode,
  }

  return {
    ...promotion,
    detail: resolvePromotionDetail(promotion),
    highlight: resolvePromotionHighlight(promotion, 0),
  }
}

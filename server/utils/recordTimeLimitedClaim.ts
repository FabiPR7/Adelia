import { adminDb } from '../firebase-admin.ts'
import { notifyPromotionClaimed } from '../notifications/reservationEvents.ts'

interface PromotionOfferConfig {
  kind: string
  bundleGet: number | null
  bundlePay: number | null
  discountPercent: number | null
  fixedPriceCents: number | null
  customLabel: string
}

interface ClaimedPromotionRecord {
  promotionId: string
  companyId: string
  companyName: string
  companySlug: string
  title: string
  prizeLabel: string
  claimedAt: string
  description?: string
  detail?: string
  photoUrl?: string
  companyPhotoUrl?: string
  promotionType?: 'time_limited'
  reservationId?: string
}

function normalizeOffer(data: FirebaseFirestore.DocumentData): PromotionOfferConfig | null {
  const raw = data.offer
  if (raw && typeof raw === 'object') {
    const offer = raw as Partial<PromotionOfferConfig>
    return {
      kind: typeof offer.kind === 'string' ? offer.kind : 'custom',
      bundleGet: typeof offer.bundleGet === 'number' ? offer.bundleGet : null,
      bundlePay: typeof offer.bundlePay === 'number' ? offer.bundlePay : null,
      discountPercent: typeof offer.discountPercent === 'number' ? offer.discountPercent : null,
      fixedPriceCents: typeof offer.fixedPriceCents === 'number' ? offer.fixedPriceCents : null,
      customLabel: typeof offer.customLabel === 'string' ? offer.customLabel : '',
    }
  }

  if (typeof data.offerHighlight === 'string' && data.offerHighlight.trim()) {
    return {
      kind: 'custom',
      bundleGet: null,
      bundlePay: null,
      discountPercent: null,
      fixedPriceCents: null,
      customLabel: data.offerHighlight.trim(),
    }
  }

  return null
}

function normalizeProductRefs(data: FirebaseFirestore.DocumentData): Array<{ photoUrl: string }> {
  if (!Array.isArray(data.productRefs)) {
    return []
  }

  return data.productRefs
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const ref = entry as { photoUrl?: unknown }
      return {
        photoUrl: typeof ref.photoUrl === 'string' ? ref.photoUrl : '',
      }
    })
    .filter((entry): entry is { photoUrl: string } => entry !== null)
}

function formatOfferBadge(offer: PromotionOfferConfig): string {
  switch (offer.kind) {
    case 'bundle':
      return offer.bundleGet && offer.bundlePay ? `${offer.bundleGet}×${offer.bundlePay}` : 'Oferta'
    case 'discount':
      return offer.discountPercent != null ? `${offer.discountPercent}% Descuento` : 'Descuento'
    case 'fixed_price':
      return offer.fixedPriceCents != null
        ? `${(offer.fixedPriceCents / 100).toFixed(2).replace('.', ',')} €`
        : 'Precio especial'
    case 'second_unit':
      return offer.discountPercent != null ? `2ª ${offer.discountPercent}% dto.` : '2ª unidad'
    case 'free_item':
      return 'GRATIS'
    case 'custom':
      return offer.customLabel.trim() || 'Promo'
    default:
      return 'Promo'
  }
}

function buildHighlight(
  data: FirebaseFirestore.DocumentData,
  offer: PromotionOfferConfig | null,
): string {
  if (offer && offer.kind !== 'custom') {
    return formatOfferBadge(offer)
  }

  if (offer?.kind === 'custom' && offer.customLabel.trim()) {
    return offer.customLabel.trim()
  }

  if (data.type === 'time_limited') {
    const max = data.maxRedemptions as number | null
    if (max) {
      return `${Math.max(0, max - ((data.currentRedemptions as number) ?? 0))} plazas`
    }
    return 'Limitado'
  }

  return 'Promo'
}

function buildDetail(data: FirebaseFirestore.DocumentData): string {
  if (data.type === 'time_limited') {
    const from = (data.activeFromTime as string) ?? ''
    const to = (data.activeToTime as string) ?? ''
    return `${from}-${to}`.replace(/^-|-$/g, '').trim() || 'Tiempo limitado'
  }

  return ''
}

function resolveCompanyPhotoUrl(companyData: FirebaseFirestore.DocumentData): string {
  const photos = Array.isArray(companyData.photos) ? companyData.photos : []
  const logoUrl = (companyData.logoUrl as string) ?? ''
  const mainPhotoIndex = typeof companyData.mainPhotoIndex === 'number'
    ? Math.max(0, Math.min(photos.length - 1, companyData.mainPhotoIndex))
    : 0

  return (photos[mainPhotoIndex] as string) ?? (photos[0] as string) ?? logoUrl
}

export async function recordTimeLimitedPromotionClaimForVerification(
  customerUid: string,
  reservationId: string,
  companyId: string,
  promotionId: string,
): Promise<boolean> {
  const companyRef = adminDb.collection('companies').doc(companyId)
  const [companySnap, promotionSnap, userSnap] = await Promise.all([
    companyRef.get(),
    companyRef.collection('promotions').doc(promotionId).get(),
    adminDb.collection('users').doc(customerUid).get(),
  ])

  if (!companySnap.exists || !promotionSnap.exists || !userSnap.exists) {
    return false
  }

  const promotionData = promotionSnap.data()!
  if (promotionData.type !== 'time_limited') {
    return false
  }

  const companyData = companySnap.data()!
  const userData = userSnap.data()!
  const gamification = userData.gamification && typeof userData.gamification === 'object'
    ? userData.gamification as Record<string, unknown>
    : {}

  const existingClaims = Array.isArray(gamification.claimedPromotions)
    ? [...(gamification.claimedPromotions as ClaimedPromotionRecord[])]
    : []

  if (existingClaims.some((record) => record.reservationId === reservationId)) {
    return false
  }

  const offer = normalizeOffer(promotionData)
  const productRefs = normalizeProductRefs(promotionData)
  const companyPhotoUrl = resolveCompanyPhotoUrl(companyData)
  const productPhoto = productRefs.find((ref) => ref.photoUrl.trim())?.photoUrl ?? ''
  const photoUrl = (promotionData.photoUrl as string) ?? productPhoto ?? companyPhotoUrl

  const claim: ClaimedPromotionRecord = {
    promotionId,
    companyId,
    companyName: (companyData.name as string) ?? 'Restaurante',
    companySlug: (companyData.slug as string) ?? '',
    title: (promotionData.title as string) ?? '',
    prizeLabel: buildHighlight(promotionData, offer),
    claimedAt: new Date().toISOString(),
    description: (promotionData.description as string) ?? '',
    detail: buildDetail(promotionData),
    photoUrl,
    companyPhotoUrl,
    promotionType: 'time_limited',
    reservationId,
  }

  const redemptionsCount = typeof gamification.redemptionsCount === 'number'
    ? gamification.redemptionsCount + 1
    : existingClaims.length + 1

  await adminDb.collection('users').doc(customerUid).update({
    gamification: {
      ...gamification,
      claimedPromotions: [...existingClaims, claim],
      redemptionsCount,
    },
  })

  try {
    await notifyPromotionClaimed(
      customerUid,
      promotionId,
      companyId,
      claim.title || 'tu premio',
      reservationId,
    )
  } catch (notificationError) {
    console.error('Promotion claimed notification error:', notificationError)
  }

  return true
}

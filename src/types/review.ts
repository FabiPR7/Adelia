export type ReviewMediaType = 'image' | 'video'

export interface ReviewMediaItem {
  url: string
  type: ReviewMediaType
}

export interface ReviewTaggedProduct {
  nodeId: string
  boardId: string
  name: string
}

export interface ReviewTaggedPromotion {
  promotionId: string
  name: string
}

export interface CompanyReviewOwnerReply {
  text: string
  createdAt: Date
  updatedAt?: Date
}

export interface CompanyReview {
  id: string
  companyId: string
  reservationId: string
  customerUid: string
  customerName: string
  rating: number
  comment: string
  hasPhoto: boolean
  mediaItems: ReviewMediaItem[]
  taggedProducts: ReviewTaggedProduct[]
  taggedPromotions: ReviewTaggedPromotion[]
  adelinasEarned: number
  createdAt: Date
  ownerReply?: CompanyReviewOwnerReply | null
}

export const MIN_REVIEW_REPLY_LENGTH = 3
export const MAX_REVIEW_REPLY_LENGTH = 1000

export interface CompanyReviewStats {
  reviewCount: number
  reviewRatingSum: number
  reviewAdelinas: number
}

export const MIN_REVIEW_RATING = 1
export const MAX_REVIEW_RATING = 5
export const REVIEW_RATING_STEP = 1

export const ADELINA_RATING_SLOTS = 5

export type AdelinaSlotState = 'full' | 'empty'

/**
 * Cuántas Adelinas van a color (1–5) según la nota media.
 * Sin reseñas: 1 a color. Con reseñas: parte entera de la nota (2→2, 3→3, 3,8→3…), mínimo 1.
 */
export function getFilledAdelinaSlots(averageRating: number, reviewCount: number): number {
  if (reviewCount <= 0) {
    return 1
  }

  const clampedRating = Math.min(ADELINA_RATING_SLOTS, Math.max(0, averageRating))
  const filled = Math.floor(clampedRating)

  return Math.max(1, Math.min(ADELINA_RATING_SLOTS, filled))
}

export function getAdelinaSlotStates(averageRating: number, reviewCount: number): AdelinaSlotState[] {
  const filledCount = getFilledAdelinaSlots(averageRating, reviewCount)

  return Array.from({ length: ADELINA_RATING_SLOTS }, (_, index) => (
    index < filledCount ? 'full' : 'empty'
  ))
}

export function computeAverageReviewRating(sum: number, count: number): number {
  if (count <= 0) {
    return 0
  }

  return Math.round((sum / count) * 10) / 10
}

export function reviewHasPhotoBonus(
  hasPhoto: boolean,
  mediaItems: ReviewMediaItem[] = [],
): boolean {
  return hasPhoto || mediaItems.some((item) => item.type === 'image')
}

/** Adelinas que suma cada reseña al restaurante. */
export function computeReviewAdelinas(
  rating: number,
  hasPhoto: boolean,
  mediaItems: ReviewMediaItem[] = [],
): number {
  const base = Math.max(1, Math.round(rating))
  return base + (reviewHasPhotoBonus(hasPhoto, mediaItems) ? 2 : 0)
}

export function normalizeReviewRating(value: number): number {
  const clamped = Math.min(MAX_REVIEW_RATING, Math.max(MIN_REVIEW_RATING, value))
  return Math.round(clamped)
}

export function defaultCompanyReviewStats(): CompanyReviewStats {
  return {
    reviewCount: 0,
    reviewRatingSum: 0,
    reviewAdelinas: 0,
  }
}

export function parseCompanyReviewStats(data: Record<string, unknown>): CompanyReviewStats {
  const base = defaultCompanyReviewStats()

  return {
    reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : base.reviewCount,
    reviewRatingSum: typeof data.reviewRatingSum === 'number' ? data.reviewRatingSum : base.reviewRatingSum,
    reviewAdelinas: typeof data.reviewAdelinas === 'number' ? data.reviewAdelinas : base.reviewAdelinas,
  }
}

export function canCustomerReviewReservation(
  reservation: { status: string },
  bucket: 'upcoming' | 'past',
): boolean {
  return bucket === 'past' && reservation.status === 'confirmed'
}

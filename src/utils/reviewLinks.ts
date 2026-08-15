import type { ReviewTaggedProduct, ReviewTaggedPromotion } from '../types/review'

export function buildReviewProductHref(
  slug: string,
  tag: Pick<ReviewTaggedProduct, 'boardId' | 'nodeId'>,
): string {
  const params = new URLSearchParams({ producto: tag.nodeId })
  return `/reservar/${encodeURIComponent(slug)}/carta/${encodeURIComponent(tag.boardId)}?${params.toString()}`
}

export function buildReviewPromotionHref(
  slug: string,
  tag: Pick<ReviewTaggedPromotion, 'promotionId'>,
): string {
  const params = new URLSearchParams({ promo: tag.promotionId })
  return `/reservar/${encodeURIComponent(slug)}/promociones?${params.toString()}`
}

import { computeReviewAdelinas, type ReviewMediaItem } from '../types/review'

export type FeaturedReviewLike = {
  rating: number
  comment?: string
  hasPhoto?: boolean
  mediaItems?: ReviewMediaItem[]
}

export function reviewAdelinaScore(review: FeaturedReviewLike): number {
  return computeReviewAdelinas(
    review.rating,
    review.hasPhoto === true,
    review.mediaItems ?? [],
  )
}

export function pickHighestRatedReview<T extends FeaturedReviewLike>(
  reviews: T[],
  random: () => number = Math.random,
): T | null {
  if (reviews.length === 0) {
    return null
  }

  const maxScore = Math.max(...reviews.map((review) => reviewAdelinaScore(review)))
  const topRated = reviews.filter((review) => reviewAdelinaScore(review) === maxScore)
  const withComment = topRated.filter((review) => (review.comment ?? '').trim().length > 0)
  const pool = withComment.length > 0 ? withComment : topRated
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length))

  return pool[index] ?? null
}

export function pickNextRandomIndex(
  length: number,
  current: number,
  random: () => number = Math.random,
): number {
  if (length <= 1) {
    return 0
  }

  const offset = Math.floor(random() * (length - 1))
  return offset >= current ? offset + 1 : offset
}

export function shuffleCopy<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items]

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1))
    const current = copy[index]
    const next = copy[swapWith]
    if (current === undefined || next === undefined) {
      continue
    }
    copy[index] = next
    copy[swapWith] = current
  }

  return copy
}

export function pickFeaturedReviewCandidates<T>(
  restaurants: T[],
  limit = 24,
  random: () => number = Math.random,
): T[] {
  return shuffleCopy(restaurants, random).slice(0, limit)
}

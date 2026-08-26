import { describe, expect, it } from 'vitest'
import {
  pickFeaturedReviewCandidates,
  pickHighestRatedReview,
  pickNextRandomIndex,
  reviewAdelinaScore,
} from '../featuredReviewHighlight'

describe('featuredReviewHighlight', () => {
  it('picks the review with the most Adelina points, preferring one with text', () => {
    const picked = pickHighestRatedReview(
      [
        { rating: 4, comment: 'Bueno' },
        { rating: 5, comment: '' },
        { rating: 5, comment: 'Espectacular' },
        { rating: 3, comment: 'Regular' },
      ],
      () => 0,
    )

    expect(picked).toEqual({ rating: 5, comment: 'Espectacular' })
  })

  it('prefers a 4-star review with photo over a 5-star review without one', () => {
    const picked = pickHighestRatedReview(
      [
        { rating: 5, comment: 'Sin foto', hasPhoto: false },
        { rating: 4, comment: 'Con foto', hasPhoto: true },
      ],
      () => 0,
    )

    expect(picked?.comment).toBe('Con foto')
    expect(reviewAdelinaScore({ rating: 4, hasPhoto: true })).toBe(6)
    expect(reviewAdelinaScore({ rating: 5, hasPhoto: false })).toBe(5)
  })

  it('picks any of the top-scoring reviews when several share the max Adelinas', () => {
    const pool = [
      { rating: 4, comment: 'Uno' },
      { rating: 4, comment: 'Dos' },
    ]

    expect(pickHighestRatedReview(pool, () => 0)?.comment).toBe('Uno')
    expect(pickHighestRatedReview(pool, () => 0.99)?.comment).toBe('Dos')
  })

  it('rotates to another restaurant at random and avoids repeating the current one', () => {
    expect(pickNextRandomIndex(2, 0, () => 0)).toBe(1)
    expect(pickNextRandomIndex(2, 1, () => 0)).toBe(0)
    expect(pickNextRandomIndex(1, 0, () => 0.4)).toBe(0)
  })

  it('samples from every restaurant so a missing reviewCount still gets fetched', () => {
    const withReviews = { slug: 'con-resenas', reviewCount: 2 }
    const withoutCount = { slug: 'sin-contador', reviewCount: 0 }

    expect(
      pickFeaturedReviewCandidates([withoutCount, withReviews], 8, () => 0)
        .map((item) => item.slug)
        .sort(),
    ).toEqual(['con-resenas', 'sin-contador'])
  })
})

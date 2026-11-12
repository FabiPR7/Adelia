import { describe, expect, it } from 'vitest'
import { cleanReviewExcerpt } from '../reviewCommentTags'

describe('cleanReviewExcerpt', () => {
  it('deja solo el nombre de los platos y premios mencionados', () => {
    expect(cleanReviewExcerpt('hola [[p|u7H5|PkJb|Tostadas con mantequilla 2]] como esta [[r|mVlS|CAFES 2X1]]'))
      .toBe('hola Tostadas con mantequilla 2 como esta CAFES 2X1')
  })

  it('quita una marca cortada a medias al final', () => {
    expect(cleanReviewExcerpt('muy rico [[p|abc|de')).toBe('muy rico')
  })
})

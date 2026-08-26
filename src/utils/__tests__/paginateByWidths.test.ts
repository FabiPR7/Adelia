import { describe, expect, it } from 'vitest'
import { paginateByWidths } from '../paginateByWidths'

describe('paginateByWidths', () => {
  it('keeps a single page when every item fits', () => {
    expect(paginateByWidths([20, 20, 20], 80, 8)).toEqual([[0, 1, 2]])
  })

  it('starts a new page when the next item would overflow', () => {
    expect(paginateByWidths([30, 30, 30, 30], 68, 8)).toEqual([
      [0, 1],
      [2, 3],
    ])
  })

  it('keeps an oversized first item on its own page', () => {
    expect(paginateByWidths([90, 20, 20], 50, 8)).toEqual([[0], [1, 2]])
  })
})

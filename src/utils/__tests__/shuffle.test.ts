import { describe, expect, it } from 'vitest'
import { seededShuffle } from '../shuffle'

describe('seededShuffle', () => {
  const source = Array.from({ length: 20 }, (_, i) => i)

  it('is deterministic for the same seed', () => {
    expect(seededShuffle(source, 12345)).toEqual(seededShuffle(source, 12345))
  })

  it('produces a different order for a different seed', () => {
    expect(seededShuffle(source, 1)).not.toEqual(seededShuffle(source, 2))
  })

  it('keeps every element exactly once', () => {
    const shuffled = seededShuffle(source, 999)
    expect([...shuffled].sort((a, b) => a - b)).toEqual(source)
  })

  it('does not mutate the input', () => {
    const copy = [...source]
    seededShuffle(source, 7)
    expect(source).toEqual(copy)
  })

  it('handles empty and single-item arrays', () => {
    expect(seededShuffle([], 3)).toEqual([])
    expect(seededShuffle(['only'], 3)).toEqual(['only'])
  })
})

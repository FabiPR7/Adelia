import { describe, expect, it } from 'vitest'
import {
  buildLadderMapPath,
  buildLadderMapTrailMarks,
  buildLadderMapNodePositions,
} from '../promotionLadderMapLayout'

describe('promotionLadderMapLayout', () => {
  it('builds a curved treasure-map path between prize nodes', () => {
    const positions = buildLadderMapNodePositions(3)
    const path = buildLadderMapPath(positions)

    expect(path.startsWith('M ')).toBe(true)
    expect(path).toContain(' C ')
    expect(buildLadderMapTrailMarks(positions)).toHaveLength(2)
  })

  it('returns no path or marks for a single prize', () => {
    const positions = buildLadderMapNodePositions(1)
    expect(buildLadderMapPath(positions)).toBe('')
    expect(buildLadderMapTrailMarks(positions)).toEqual([])
  })
})

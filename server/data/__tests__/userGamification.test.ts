import { describe, expect, it } from 'vitest'
import {
  compactGamificationForStatsDoc,
  compactGamificationForUserDoc,
} from '../userGamification.ts'

describe('gamification document size', () => {
  it('keeps claim history and pending spends capped', () => {
    const claims = Array.from({ length: 40 }, (_, index) => ({ id: `p${index}` }))
    const pending = Array.from({ length: 25 }, (_, index) => ({ id: `t${index}` }))
    const compacted = compactGamificationForStatsDoc({
      xp: 12,
      claimedPromotions: claims,
      pendingTokenSpend: pending,
      awardedReservationXpIds: ['keep-all'],
    })

    expect(compacted.claimedPromotions).toHaveLength(20)
    expect(compacted.pendingTokenSpend).toHaveLength(10)
    expect(compacted.awardedReservationXpIds).toEqual(['keep-all'])
  })

  it('strips bulky arrays from the user-doc copy', () => {
    const slim = compactGamificationForUserDoc({
      xp: 9,
      claimedPromotions: [{ id: 'a' }],
      cancelledReservationIds: ['r1'],
      grantedItemKeys: ['k1'],
    })

    expect(slim.xp).toBe(9)
    expect(slim.claimedPromotions).toBeUndefined()
    expect(slim.cancelledReservationIds).toBeUndefined()
    expect(slim.grantedItemKeys).toBeUndefined()
  })
})

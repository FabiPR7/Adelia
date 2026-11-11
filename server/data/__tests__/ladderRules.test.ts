import { describe, expect, it } from 'vitest'
import { checkLadderClaim } from '../ladderRules.ts'
import { ladderClaimDocId } from '../promotionClaims.ts'

const ladder = ['a3', 'b5', 'c10']

const claim = (overrides: Partial<Parameters<typeof checkLadderClaim>[0]>) => checkLadderClaim({
  promotionId: 'a3',
  ladderIds: ladder,
  activePromotionId: undefined,
  required: 3,
  confirmedCount: 3,
  baseline: 0,
  ...overrides,
})

describe('ladder claim rules', () => {
  it('lets the first step be claimed once its visits are reached, and not before', () => {
    expect(claim({ confirmedCount: 2 })).toMatchObject({ ok: false, status: 409 })
    expect(claim({ confirmedCount: 3 })).toMatchObject({ ok: true, nextPromotionId: 'b5', completesMap: false })
  })

  it('needs NEW visits after the previous claim, not the running total', () => {
    // Canjeó el escalón de 3 con 3 visitas (baseline 3). El de 5 pide 5 visitas más: 8 en total.
    expect(claim({ promotionId: 'b5', activePromotionId: 'b5', required: 5, confirmedCount: 5, baseline: 3 }))
      .toMatchObject({ ok: false })
    expect(claim({ promotionId: 'b5', activePromotionId: 'b5', required: 5, confirmedCount: 8, baseline: 3 }))
      .toMatchObject({ ok: true, nextPromotionId: 'c10' })
  })

  it('does not allow skipping a step of the map', () => {
    expect(claim({ promotionId: 'c10', required: 10, confirmedCount: 50 })).toMatchObject({
      ok: false,
      error: expect.stringContaining('siguiente'),
    })
  })

  it('restarts the map from the first step after claiming the last one', () => {
    const result = claim({ promotionId: 'c10', activePromotionId: 'c10', required: 10, confirmedCount: 30, baseline: 18 })
    expect(result).toMatchObject({ ok: true, nextPromotionId: 'a3', completesMap: true })
  })

  it('falls back to the first step if the stored active promotion no longer exists', () => {
    expect(claim({ activePromotionId: 'borrada' })).toMatchObject({ ok: true })
    expect(claim({ promotionId: 'b5', activePromotionId: 'borrada', required: 5, confirmedCount: 9 })).toMatchObject({ ok: false })
  })

  it('a single-step map needs fresh visits for every repeat', () => {
    const only = { ladderIds: ['solo'], promotionId: 'solo', activePromotionId: 'solo', required: 4 }
    expect(claim({ ...only, confirmedCount: 4, baseline: 0 })).toMatchObject({ ok: true, nextPromotionId: 'solo', completesMap: true })
    expect(claim({ ...only, confirmedCount: 6, baseline: 4 })).toMatchObject({ ok: false })
    expect(claim({ ...only, confirmedCount: 8, baseline: 4 })).toMatchObject({ ok: true })
  })

  it('gives a repeated request the same claim id and the next claim a different one', () => {
    expect(ladderClaimDocId('u', 'a3', 0)).toBe(ladderClaimDocId('u', 'a3', 0))
    expect(ladderClaimDocId('u', 'a3', 0)).not.toBe(ladderClaimDocId('u', 'a3', 3))
  })
})

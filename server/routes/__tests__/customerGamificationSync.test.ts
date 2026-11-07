import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase-admin.ts', () => ({
  adminDb: { collection: vi.fn(), collectionGroup: vi.fn(), batch: vi.fn(), runTransaction: vi.fn() },
  adminAuth: {},
  canUseAdminSdk: true,
}))

vi.mock('../../auth/verifyRequest.ts', () => ({ verifyCustomerUid: vi.fn() }))

const catalog = vi.hoisted(() => new Map<string, { name: string; icon: string; xp: number; cadence: string }>())

vi.mock('../../data/gameCatalog.ts', () => ({
  listMissionCatalogEntries: async () => catalog,
  getLevelForXpFromCatalog: async () => 1,
  getMissionCatalogEntry: async () => null,
}))

import { getMonthKey, getWeekKey } from '../../gamification/companyProgress.ts'
import { validateMonotonicGamification } from '../customerGamification.ts'

function setCatalog(entries: Array<[string, number, string]>) {
  catalog.clear()
  for (const [id, xp, cadence] of entries) {
    catalog.set(id, { name: id, icon: '', xp, cadence })
  }
}

const current = (extra: Record<string, unknown> = {}) => ({
  xp: 1000,
  weekKey: getWeekKey(),
  monthKey: getMonthKey(),
  completedMissions: [],
  weeklyCompleted: [],
  monthlyCompleted: [],
  ...extra,
})

describe('validateMonotonicGamification', () => {
  it('saves missions in the catalog with their XP', async () => {
    setCatalog([['h1', 100, 'historical']])

    const { state, adjustments } = await validateMonotonicGamification(
      current(),
      { xp: 1100, completedMissions: ['h1'] },
    )

    expect(state.xp).toBe(1100)
    expect(state.completedMissions).toEqual(['h1'])
    expect(adjustments.deferredMissions).toEqual([])
  })

  it('applies nothing while a proposed mission is outside the catalog, so XP is not paid on every load', async () => {
    setCatalog([['h1', 100, 'historical']])

    const { state, adjustments } = await validateMonotonicGamification(
      current({ awardedReservationXpIds: ['r1'] }),
      { xp: 1680, completedMissions: ['h1'], monthlyCompleted: ['invented'], awardedReservationXpIds: ['r1', 'r2'] },
    )

    expect(adjustments.unknownMissions).toEqual(['invented'])
    expect(state.xp).toBe(1000)
    expect(state.completedMissions).toEqual([])
    expect(state.monthlyCompleted).toEqual([])
    expect(state.awardedReservationXpIds).toEqual(['r1'])
  })

  it('keeps the XP of deferred missions for the call that saves them', async () => {
    setCatalog([
      ['h1', 100, 'historical'],
      ['h2', 100, 'historical'],
      ['h3', 100, 'historical'],
      ['h4', 500, 'historical'],
    ])

    const proposed = { xp: 1800, completedMissions: ['h1', 'h2', 'h3', 'h4'] }
    const first = await validateMonotonicGamification(current(), proposed)

    expect(first.adjustments.deferredMissions).toEqual(['h4'])
    expect(first.state.xp).toBe(1300)

    const second = await validateMonotonicGamification(first.state, proposed)

    expect(second.adjustments.deferredMissions).toEqual([])
    expect(second.state.xp).toBe(1800)
    expect(second.state.completedMissions).toEqual(['h1', 'h2', 'h3', 'h4'])
  })

  it('caps the XP gain to the mission ceiling', async () => {
    setCatalog([['h1', 100, 'historical']])

    const { state } = await validateMonotonicGamification(current(), { xp: 3000 }, 1200)

    expect(state.xp).toBe(1200)
  })

  it('never drops progress the browser did not send', async () => {
    setCatalog([['h1', 100, 'historical']])

    const { state } = await validateMonotonicGamification(
      current({ completedMissions: ['h1'], visitedCompanyIds: ['c1'] }),
      { xp: 1000, completedMissions: [], visitedCompanyIds: [] },
    )

    expect(state.completedMissions).toEqual(['h1'])
    expect(state.visitedCompanyIds).toEqual(['c1'])
  })

  it('ignores claims proposed by the browser', async () => {
    setCatalog([['h1', 100, 'historical']])
    const claim = { promotionId: 'p1' }

    const { state } = await validateMonotonicGamification(
      current({ claimedPromotions: [claim] }),
      { xp: 1000, claimedPromotions: [claim, { promotionId: 'invented' }] },
    )

    expect(state.claimedPromotions).toEqual([claim])
  })
})

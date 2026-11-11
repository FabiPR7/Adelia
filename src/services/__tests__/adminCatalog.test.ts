import { beforeEach, describe, expect, it, vi } from 'vitest'

const firestore = vi.hoisted(() => {
  const writes: Array<{ path: string; data: Record<string, unknown> }> = []
  return {
    writes,
    commit: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('../../config/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  serverTimestamp: () => 'TS',
  getDoc: vi.fn(),
  setDoc: vi.fn(async (ref: { path: string }, data: Record<string, unknown>) => {
    firestore.writes.push({ path: ref.path, data })
  }),
  writeBatch: () => ({
    set: (ref: { path: string }, data: Record<string, unknown>) => {
      firestore.writes.push({ path: ref.path, data })
    },
    commit: firestore.commit,
  }),
}))

import { getCompanyPlan } from '../../data/companyPlans'
import { getInventoryItem } from '../../data/inventoryItems'
import {
  currentCustomerGame,
  savePenaltyConfig,
  saveInventoryItem,
  savePlanCatalog,
  saveCustomerGame,
} from '../adminCatalog'
import { COMPANY_PLANS, COMPANY_PLAN_CAPABILITIES } from '../../data/companyPlans'
import { PROMO_LOCK_STRIKES } from '../../data/cancellationPenalties'
import { GAMIFICATION_LEVELS } from '../../data/gamificationLevels'

beforeEach(() => {
  firestore.writes.length = 0
})

describe('adminCatalog saves', () => {
  it('writes every plan with its capabilities and updates memory', async () => {
    const plans = COMPANY_PLANS.map((plan) => ({ ...plan, priceMonthly: plan.id === 'basic' ? 42 : plan.priceMonthly }))
    const capabilities = COMPANY_PLAN_CAPABILITIES.map((capability) => (
      capability.id === 'menus' ? { ...capability, values: { ...capability.values, basic: 4 } } : capability
    ))

    await savePlanCatalog(plans, capabilities)

    const basic = firestore.writes.find((entry) => entry.path === 'planCatalog/basic')
    expect(basic?.data.priceMonthly).toBe(42)
    expect((basic?.data.caps as Record<string, unknown>).menus).toBe(4)
    expect(firestore.writes.map((entry) => entry.path)).toEqual(expect.arrayContaining([
      'planCatalog/free', 'planCatalog/premium', 'planCatalog/premium_plus', 'appConfig/planCapabilities',
    ]))
    expect(JSON.stringify(basic?.data)).not.toContain('undefined')
    expect(getCompanyPlan('basic').priceMonthly).toBe(42)
  })

  it('writes new items and makes them available', async () => {
    await saveInventoryItem({
      id: 'sello_oro', kind: 'ladder_boost', name: 'Sello oro', shortName: '+9', description: '', howToUse: '', howToEarn: '', rarity: 'gold',
    })
    expect(firestore.writes[0].path).toBe('inventoryItems/sello_oro')
    expect(getInventoryItem('sello_oro')?.name).toBe('Sello oro')
  })

  it('replaces the penalty document and applies it', async () => {
    await savePenaltyConfig({ rates: [{ strike: 1, percent: 10, minXp: 5 }], lockStrikes: 3 })
    expect(firestore.writes[0]).toMatchObject({ path: 'gameConfig/penalties', data: { lockStrikes: 3 } })
    expect(PROMO_LOCK_STRIKES).toBe(3)
  })

  it('derives each level cap from the next level when saving customer levels', async () => {
    const draft = currentCustomerGame()
    draft.levels[1].minXp = 350
    await saveCustomerGame(draft)

    const level1 = firestore.writes.find((entry) => entry.path === 'levelCatalog/1')
    expect(level1?.data.maxXp).toBe(349)
    expect(GAMIFICATION_LEVELS[0].maxXp).toBe(349)
    expect(firestore.writes.some((entry) => entry.path === 'gameConfig/adelia')).toBe(true)
  })
})

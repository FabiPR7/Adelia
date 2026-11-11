import { afterEach, describe, expect, it } from 'vitest'
import {
  parseRemoteBilling,
  parseRemoteItem,
  parseRemotePenalties,
  parseRemotePlan,
  parseRemoteRewards,
  setRemoteCatalogForTests,
} from '../remoteCatalog.ts'
import { clampPromotionsToPlan, planMaxActiveMaps, planMaxMenus, planMaxPromosOfType } from '../../company/planLimits.ts'
import {
  getInventoryItem,
  missionLootDifficulty,
  rewardsForLevel,
  rewardsForMission,
} from '../../gamification/inventoryItems.ts'
import { cancellationPenaltyRates, promoLockStrikes } from '../../gamification/penaltyConfig.ts'
import { lemonVariant } from '../../lemonsqueezy/config.ts'
import { SAAS_CHECKOUT_PLANS } from '../../stripe/saasCatalog.ts'

afterEach(() => setRemoteCatalogForTests(null))

describe('remote catalog parsing', () => {
  it('rejects malformed items, plans and rates instead of trusting them', () => {
    expect(parseRemoteItem('x', { kind: 5 })).toBeNull()
    expect(parseRemotePlan('basic', { priceMonthly: 10 })).toBeNull()
    expect(parseRemotePenalties({ rates: [{ strike: 1 }, 'x'], lockStrikes: -2 })).toEqual({ rates: null, lockStrikes: null })
    expect(parseRemoteBilling({ variants: { 1: { plan: 'enterprise', period: 'monthly' } } }).variants).toBeNull()
  })

  it('keeps valid caps and drops invalid ones', () => {
    const plan = parseRemotePlan('basic', { name: 'Sala', caps: { menus: 4, pdf: true, bad: { a: 1 }, odd: 'nope' } })
    expect(plan?.caps).toEqual({ menus: 4, pdf: true })
  })
})

describe('with the code fallback (empty database)', () => {
  it('keeps the previous behaviour', () => {
    expect(planMaxMenus('basic')).toBe(3)
    expect(planMaxActiveMaps('free')).toBe(0)
    expect(planMaxPromosOfType('premium', 'attendance')).toBe(5)
    expect(planMaxPromosOfType('basic', 'attendance')).toBe(0)
    expect(promoLockStrikes()).toBe(5)
    expect(cancellationPenaltyRates()).toHaveLength(5)
    expect(missionLootDifficulty('monthly', 300)).toBe('easy')
    expect(missionLootDifficulty('monthly', 301)).toBe('medium')
    expect(missionLootDifficulty('historical', 3000)).toBe('legendary')
    expect(rewardsForLevel(2)).toEqual([{ itemId: 'mesa_1', quantity: 1 }])
    expect(getInventoryItem('mesa_3_15')?.spendBand).toBe(15)
    expect(lemonVariant('2088081')).toEqual({ plan: 'basic', period: 'monthly' })
    expect(SAAS_CHECKOUT_PLANS.basic.amountCents).toBe(3999)
  })
})

describe('with Firestore data', () => {
  it('uses plan caps, prices and variants from the database', () => {
    setRemoteCatalogForTests({
      plans: new Map([
        ['basic', { id: 'basic', name: 'Sala Plus', priceMonthly: 44.5, priceAnnual: null, caps: { menus: 7, active_maps: 'unlimited', promos_offer: 1, promos_limited: 2 } }],
      ]),
      billing: { checkoutUrl: null, storeId: null, variants: { 999: { plan: 'premium', period: 'annual' } } },
    })

    expect(planMaxMenus('basic')).toBe(7)
    expect(planMaxActiveMaps('basic')).toBeNull()
    expect(planMaxPromosOfType('basic', 'time_limited')).toBe(2)
    expect(clampPromotionsToPlan([{ t: 'reservation_ladder' }, { t: 'reservation_ladder' }], 'basic', (p) => p.t)).toHaveLength(1)
    expect(planMaxMenus('premium')).toBe(5)
    expect(SAAS_CHECKOUT_PLANS.basic.name).toBe('Sala Plus')
    expect(SAAS_CHECKOUT_PLANS.basic.amountCents).toBe(4450)
    expect(lemonVariant('999')).toEqual({ plan: 'premium', period: 'annual' })
    expect(lemonVariant('2088081')).toBeNull()
  })

  it('uses items, rewards and penalties from the database', () => {
    setRemoteCatalogForTests({
      items: new Map([['mesa_1', { id: 'mesa_1', kind: 'reservation_token', visitValue: 1, spendBand: 0 }]]),
      rewards: parseRemoteRewards({
        levelRewards: { 2: [{ itemId: 'mesa_1', quantity: 3 }] },
        lootPools: { easy: ['mesa_1'] },
        lootBands: { weekly: [{ below: 500, difficulty: 'none' }, { difficulty: 'hard' }] },
        reviewBoostXp: 99,
      }),
      penalties: parseRemotePenalties({ rates: [{ strike: 1, percent: 5, minXp: 1 }], lockStrikes: 3 }),
    })

    expect(getInventoryItem('mesa_3_15')).toBeNull()
    expect(rewardsForLevel(2)).toEqual([{ itemId: 'mesa_1', quantity: 3 }])
    expect(rewardsForLevel(3)).toEqual([])
    expect(missionLootDifficulty('weekly', 100)).toBe('none')
    expect(missionLootDifficulty('weekly', 600)).toBe('hard')
    expect(rewardsForMission('m', 'historical', 400)).toEqual([{ itemId: 'mesa_1', quantity: 1 }])
    expect(promoLockStrikes()).toBe(3)
    expect(cancellationPenaltyRates()).toEqual([{ strike: 1, percent: 5, minXp: 1 }])
  })
})

describe('company gamification from Firestore', () => {
  it('falls back to the code catalog, then follows the database', async () => {
    const catalog = await import('../../gamification/companyCatalog.ts')
    const { parseRemoteCompanyConfig, parseRemoteCompanyLevel, parseRemoteCompanyMission } = await import('../remoteCatalog.ts')

    expect(catalog.getCompanyLevelForXp(300).level).toBe(2)
    expect(catalog.companyWeeklyBonusXp()).toBe(120)
    expect(catalog.getCompanyMission('servicio_semana')?.xp).toBe(70)

    const levels = [
      parseRemoteCompanyLevel('1', { title: 'Uno', minXp: 0 }),
      parseRemoteCompanyLevel('2', { title: 'Dos', minXp: 100 }),
    ].filter((level) => level !== null)
    setRemoteCatalogForTests({
      companyLevels: levels.map((level, index, all) => ({ ...level, maxXp: all[index + 1] ? all[index + 1].minXp - 1 : null })),
      companyMissions: [parseRemoteCompanyMission('servicio_semana', { name: 'Nuevo', xp: 5, cadence: 'weekly' })!],
      companyConfig: parseRemoteCompanyConfig({ weeklyBonusXp: 999 }),
    })

    expect(catalog.getCompanyLevelForXp(300).title).toBe('Dos')
    expect(catalog.companyWeeklyBonusXp()).toBe(999)
    expect(catalog.companyConfirmedXp()).toBe(15)
    expect(catalog.getCompanyMission('servicio_semana')?.xp).toBe(5)
    expect(catalog.getCompanyMission('valle_semana')).toBeNull()
    expect(parseRemoteCompanyMission('x', { name: 'x', xp: 1, cadence: 'daily' })).toBeNull()
  })
})

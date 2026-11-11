import { describe, expect, it } from 'vitest'
import { applyPlanCatalog, COMPANY_PLANS, getCompanyPlan } from '../companyPlans'
import { planMaxCount, planMaxPromosOfType } from '../companyPlanLimits'
import {
  applyItemCatalog,
  applyRewardsConfig,
  getInventoryItem,
  missionLootDifficulty,
  REVIEW_BOOST_XP,
  rewardsForLevel,
} from '../inventoryItems'
import {
  applyPenaltyConfig,
  computeCancellationXpLoss,
  PROMO_LOCK_STRIKES,
} from '../cancellationPenalties'
import { applyBillingConfig, LEMONSQUEEZY_CHECKOUT_URL } from '../lemonSqueezyCheckout'

describe('catalog from Firestore overrides the code fallback', () => {
  it('applies plan prices, order and capabilities in place', () => {
    const plansRef = COMPANY_PLANS
    applyPlanCatalog(
      [{ id: 'basic', name: 'Sala', priceMonthly: 41.5, caps: { menus: 9, promos_limited: 2 } }],
      [{ id: 'menus', label: 'Cartas' }, { id: 'promos_limited', label: 'Promos limitadas' }, { id: 'promos_offer', label: 'Oferta' }],
    )

    expect(COMPANY_PLANS).toBe(plansRef)
    expect(getCompanyPlan('basic').priceMonthly).toBe(41.5)
    expect(getCompanyPlan('premium').priceMonthly).toBe(59.99)
    expect(planMaxCount('basic', 'menus')).toBe(9)
    expect(planMaxPromosOfType('basic', 'time_limited')).toBe(2)
    expect(planMaxCount('basic', 'promos_offer')).toBe(3)
  })

  it('replaces items and rewards', () => {
    expect(getInventoryItem('mesa_1')).not.toBeNull()
    applyItemCatalog([{
      id: 'solo_uno', kind: 'relic', name: 'Solo uno', shortName: 'Uno', description: '', howToUse: '', howToEarn: '', rarity: 'gold',
    }])
    expect(getInventoryItem('mesa_1')).toBeNull()
    expect(getInventoryItem('solo_uno')?.name).toBe('Solo uno')

    applyRewardsConfig({
      levelRewards: { 2: [{ itemId: 'solo_uno', quantity: 2 }] },
      lootBands: { weekly: [{ difficulty: 'legendary' }] },
      reviewBoostXp: 7,
    })
    expect(rewardsForLevel(2)).toEqual([{ itemId: 'solo_uno', quantity: 2 }])
    expect(rewardsForLevel(5)).toEqual([])
    expect(missionLootDifficulty('weekly', 0)).toBe('legendary')
    expect(REVIEW_BOOST_XP).toBe(7)
  })

  it('applies penalties and billing config', () => {
    applyPenaltyConfig({ rates: [{ strike: 1, percent: 50, minXp: 10 }], lockStrikes: 2 })
    expect(PROMO_LOCK_STRIKES).toBe(2)
    expect(computeCancellationXpLoss(100, 1)).toBe(50)

    applyBillingConfig({ checkoutUrl: 'https://example.test/checkout' })
    expect(LEMONSQUEEZY_CHECKOUT_URL).toBe('https://example.test/checkout')
  })

  it('ignores empty catalogs so a blank database never wipes the fallback', () => {
    const before = COMPANY_PLANS.length
    applyPlanCatalog([])
    expect(COMPANY_PLANS).toHaveLength(before)
    applyItemCatalog([])
    expect(getInventoryItem('solo_uno')).not.toBeNull()
  })
})

describe('company catalog from Firestore', () => {
  it('replaces levels, missions per cadence and XP without emptying missing cadences', async () => {
    const company = await import('../companyGamificationCatalog')
    const weeklyBefore = company.COMPANY_WEEKLY_MISSIONS.length

    company.applyCompanyCatalog({
      levels: [
        { level: 1, title: 'Uno', minXp: 0, maxXp: null, colors: ['#111111', '#222222'], styleClass: 'companyLevel1' },
        { level: 2, title: 'Dos', minXp: 50, maxXp: null, colors: ['#111111', '#222222'], styleClass: 'companyLevel2', perk: 'Premio' },
      ],
      missions: [{ id: 'm_mes', name: 'Mensual', description: '', xp: 9, cadence: 'monthly', icon: '🏅', target: 1 }],
      config: { weeklyBonusXp: 777 },
    })

    expect(company.getCompanyLevelForXp(60).title).toBe('Dos')
    expect(company.COMPANY_LEVELS[0].maxXp).toBe(49)
    expect(company.COMPANY_LEVEL_PERKS[2]).toBe('Premio')
    expect(company.COMPANY_MONTHLY_MISSIONS.map((mission) => mission.id)).toEqual(['m_mes'])
    expect(company.COMPANY_WEEKLY_MISSIONS).toHaveLength(weeklyBefore)
    expect(company.getCompanyMission('m_mes')?.xp).toBe(9)
    expect(company.COMPANY_WEEKLY_BONUS_XP).toBe(777)
    expect(company.COMPANY_REVIEW_XP).toBe(10)
  })
})

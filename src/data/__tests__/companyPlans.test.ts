import { describe, expect, it } from 'vitest'
import {
  COMPANY_PLANS,
  compareCompanyPlans,
  dateToInputValue,
  includedPlanCapabilities,
  isAllowedMonthlyBillingDate,
  isPaidCompanyPlan,
  monthlyChargeState,
  nextCompanySubscription,
  nextMonthlyChargeDate,
  parseCompanyPlanBilling,
  parseCompanyPlanId,
  parseCompanyPlanStartedAt,
  parseDateInput,
} from '../companyPlans'

describe('companyPlans', () => {
  it('defaults unknown plan ids to Mesa', () => {
    expect(parseCompanyPlanId(undefined)).toBe('free')
    expect(parseCompanyPlanId('nope')).toBe('free')
    expect(parseCompanyPlanId('premium')).toBe('premium')
  })

  it('no ofrece el plan Casa de 79 €', () => {
    expect(COMPANY_PLANS).toHaveLength(3)
    expect(COMPANY_PLANS.some((plan) => plan.id === 'premium_plus' || plan.priceMonthly === 79)).toBe(false)
    expect(parseCompanyPlanId('premium_plus')).toBe('premium_plus')
  })

  it('marks Sala and Local as paid checkout plans', () => {
    expect(COMPANY_PLANS.filter((plan) => isPaidCompanyPlan(plan)).map((plan) => plan.id)).toEqual([
      'basic',
      'premium',
    ])
    expect(COMPANY_PLANS.find((plan) => plan.id === 'basic')?.priceMonthly).toBe(39)
    expect(COMPANY_PLANS.find((plan) => plan.id === 'premium')?.priceMonthly).toBe(59)
  })

  it('lists Mesa without floor plans or photos in the menu', () => {
    const included = includedPlanCapabilities('free')
    expect(included.some((item) => item.id === 'reservations')).toBe(true)
    expect(included.some((item) => item.id === 'floor_plan')).toBe(false)
    expect(included.some((item) => item.id === 'menu_photos')).toBe(false)
  })

  it('shows extras when upgrading Mesa to Sala', () => {
    const comparison = compareCompanyPlans('free', 'basic')
    expect(comparison.direction).toBe('upgrade')
    expect(comparison.lost).toHaveLength(0)
    expect(comparison.gained.some((item) => item.id === 'floor_plan')).toBe(true)
    expect(comparison.gained.some((item) => item.id === 'menu_photos')).toBe(true)
  })

  it('shows losses when downgrading Local to Mesa', () => {
    const comparison = compareCompanyPlans('premium', 'free')
    expect(comparison.direction).toBe('downgrade')
    expect(comparison.gained).toHaveLength(0)
    expect(comparison.lost.some((item) => item.id === 'compite')).toBe(true)
    expect(comparison.lost.some((item) => item.id === 'deposits')).toBe(true)
    expect(comparison.lost.some((item) => item.id === 'floor_plan')).toBe(true)
  })

  it('treats the same plan as unchanged', () => {
    const comparison = compareCompanyPlans('basic', 'basic')
    expect(comparison.direction).toBe('same')
    expect(comparison.gained).toHaveLength(0)
    expect(comparison.lost).toHaveLength(0)
  })

  it('treats Mesa as having no billing type', () => {
    expect(parseCompanyPlanBilling('monthly', 'free')).toBeNull()
    expect(parseCompanyPlanBilling('perpetual', 'basic')).toBe('perpetual')
    expect(parseCompanyPlanBilling('nope', 'premium')).toBe('monthly')
  })

  it('parses subscription start timestamps', () => {
    expect(parseCompanyPlanStartedAt(null)).toBeNull()
    expect(parseCompanyPlanStartedAt(new Date('2026-03-12T10:00:00.000Z'))?.toISOString()).toBe(
      '2026-03-12T10:00:00.000Z',
    )
  })

  it('starts a paid plan clock when leaving Mesa', () => {
    const next = nextCompanySubscription({
      currentPlanId: 'free',
      currentStartedAt: null,
      nextPlanId: 'basic',
      nextBilling: 'perpetual',
    })

    expect(next).toEqual({
      planId: 'basic',
      planBilling: 'perpetual',
      planStartedAt: 'now',
    })
  })

  it('keeps the current billing type if the admin did not send one', () => {
    const next = nextCompanySubscription({
      currentPlanId: 'basic',
      currentBilling: 'perpetual',
      currentStartedAt: new Date('2026-01-01T00:00:00.000Z'),
      nextPlanId: 'basic',
      nextBilling: undefined,
    })

    expect(next.planBilling).toBe('perpetual')
    expect(next.planStartedAt).toBe('keep')
  })

  it('keeps the start date when only switching monthly and perpetual', () => {
    const startedAt = new Date('2026-01-01T00:00:00.000Z')
    const next = nextCompanySubscription({
      currentPlanId: 'basic',
      currentStartedAt: startedAt,
      nextPlanId: 'basic',
      nextBilling: 'monthly',
    })

    expect(next.planStartedAt).toBe('keep')
    expect(next.planBilling).toBe('monthly')
  })

  it('starts a new clock when changing from Sala to Local', () => {
    const next = nextCompanySubscription({
      currentPlanId: 'basic',
      currentBilling: 'monthly',
      currentStartedAt: new Date('2026-01-01T00:00:00.000Z'),
      nextPlanId: 'premium',
      nextBilling: 'monthly',
    })

    expect(next.planId).toBe('premium')
    expect(next.planStartedAt).toBe('now')
  })

  it('clears billing and start date when returning to Mesa', () => {
    const next = nextCompanySubscription({
      currentPlanId: 'premium',
      currentStartedAt: new Date('2026-02-01T00:00:00.000Z'),
      nextPlanId: 'free',
      nextBilling: 'monthly',
    })

    expect(next).toEqual({
      planId: 'free',
      planBilling: null,
      planStartedAt: 'clear',
    })
  })

  it('uses the date the admin picked for a monthly plan', () => {
    const startedAt = parseDateInput('2026-09-05')
    const next = nextCompanySubscription({
      currentPlanId: 'free',
      currentStartedAt: null,
      nextPlanId: 'basic',
      nextBilling: 'monthly',
      nextStartedAt: startedAt,
    })

    expect(next.planBilling).toBe('monthly')
    expect(next.planStartedAt).toBe(startedAt)
  })

  it('only allows a monthly billing date of today or later', () => {
    const today = parseDateInput('2026-08-21') as Date
    expect(isAllowedMonthlyBillingDate(parseDateInput('2026-08-21') as Date, null, today)).toBe(true)
    expect(isAllowedMonthlyBillingDate(parseDateInput('2026-09-01') as Date, null, today)).toBe(true)
    expect(isAllowedMonthlyBillingDate(parseDateInput('2026-08-20') as Date, null, today)).toBe(false)
    expect(isAllowedMonthlyBillingDate(
      parseDateInput('2026-06-10') as Date,
      parseDateInput('2026-06-10'),
      today,
    )).toBe(true)
  })

  it('parses a YYYY-MM-DD billing date as a local calendar day', () => {
    const date = parseCompanyPlanStartedAt('2026-08-21')
    expect(date).not.toBeNull()
    expect(dateToInputValue(date as Date)).toBe('2026-08-21')
  })

  it('treats a future monthly date as the first charge', () => {
    const startedAt = parseDateInput('2026-09-01') as Date
    const from = parseDateInput('2026-08-21') as Date
    expect(dateToInputValue(nextMonthlyChargeDate(startedAt, from))).toBe('2026-09-01')
    expect(monthlyChargeState({ startedAt, lastPaidAt: null, from })).toBe('future')
  })

  it('marks a monthly plan overdue after the billing day if it was not paid', () => {
    const startedAt = parseDateInput('2026-06-10') as Date
    const from = parseDateInput('2026-08-21') as Date
    expect(monthlyChargeState({ startedAt, lastPaidAt: null, from })).toBe('overdue')
    expect(monthlyChargeState({
      startedAt,
      lastPaidAt: parseDateInput('2026-08-10'),
      from,
    })).toBe('paid')
  })
})

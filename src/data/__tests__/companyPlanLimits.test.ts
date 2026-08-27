import { describe, expect, it } from 'vitest'
import {
  firstPlanWithCapability,
  lockedCapabilityForTab,
  menuBoardActivationBlockReason,
  planAllowsDeposits,
  planAllowsExcel,
  planAllowsMenuPdf,
  planAllowsPromotionType,
  planMaxCount,
  planMaxFloorPlans,
  planMaxPromosOfType,
} from '../companyPlanLimits'
import { includedPlanCapabilities } from '../companyPlans'
import type { MenuBoard } from '../../types/company'

const listTemplate = { layout: 'list' } as MenuBoard['template']
const gridTemplate = { layout: 'grid' } as MenuBoard['template']

describe('companyPlanLimits', () => {
  it('gives Mesa one list menu, eight tables and no extras', () => {
    expect(planMaxCount('free', 'menus')).toBe(1)
    expect(planMaxCount('free', 'tables')).toBe(8)
    expect(planMaxPromosOfType('free', 'reservation_ladder')).toBe(0)
    expect(planMaxCount('free', 'active_maps')).toBe(0)
    expect(planAllowsMenuPdf('free')).toBe(false)
    expect(planAllowsExcel('free')).toBe(false)
    expect(planAllowsDeposits('free')).toBe(false)
    expect(lockedCapabilityForTab('clients-promotions', 'free')).toBe('promos_offer')
    expect(lockedCapabilityForTab('reports-reservations', 'free')).toBe('reports')
    expect(lockedCapabilityForTab('compite-missions', 'free')).toBe('compite')
  })

  it('unlocks Sala menus, photos, excel, one map, offer promos, core reports and deposits', () => {
    expect(planMaxCount('basic', 'menus')).toBe(3)
    expect(planMaxCount('basic', 'tables')).toBe(15)
    expect(planMaxPromosOfType('basic', 'reservation_ladder')).toBe(3)
    expect(planMaxPromosOfType('basic', 'time_limited')).toBe(0)
    expect(planMaxCount('basic', 'active_maps')).toBe(1)
    expect(planMaxFloorPlans('basic')).toBeNull()
    expect(planAllowsMenuPdf('basic')).toBe(false)
    expect(planAllowsExcel('basic')).toBe(true)
    expect(planAllowsDeposits('basic')).toBe(true)
    expect(planAllowsPromotionType('basic', 'reservation_ladder')).toBe(true)
    expect(planAllowsPromotionType('basic', 'time_limited')).toBe(false)
    expect(planAllowsPromotionType('basic', 'attendance')).toBe(false)
    expect(lockedCapabilityForTab('clients-promotions', 'basic')).toBeNull()
    expect(lockedCapabilityForTab('reports-reservations', 'basic')).toBeNull()
    expect(lockedCapabilityForTab('reports-clients', 'basic')).toBeNull()
    expect(lockedCapabilityForTab('reports-products', 'basic')).toBe('reports_advanced')
    expect(lockedCapabilityForTab('reports-reviews', 'basic')).toBe('reports_advanced')
    expect(lockedCapabilityForTab('compite-ranking', 'basic')).toBe('compite')
    expect(firstPlanWithCapability('menu_pdf')).toBe('premium')
    expect(firstPlanWithCapability('excel')).toBe('basic')
    expect(includedPlanCapabilities('basic').some((item) => item.id === 'deposits')).toBe(true)
    expect(includedPlanCapabilities('basic').some((item) => item.id === 'excel')).toBe(true)
  })

  it('unlocks Local reports, all promo types, PDF, five menus, fifty tables and Compite', () => {
    expect(planMaxCount('premium', 'menus')).toBe(5)
    expect(planMaxCount('premium', 'tables')).toBe(50)
    expect(planMaxCount('premium', 'active_maps')).toBe(5)
    expect(planMaxFloorPlans('premium')).toBe(5)
    expect(planMaxPromosOfType('premium', 'reservation_ladder')).toBe(5)
    expect(planMaxPromosOfType('premium', 'time_limited')).toBe(5)
    expect(planMaxPromosOfType('premium', 'attendance')).toBe(5)
    expect(planAllowsMenuPdf('premium')).toBe(true)
    expect(planAllowsExcel('premium')).toBe(true)
    expect(lockedCapabilityForTab('reports-products', 'premium')).toBeNull()
    expect(lockedCapabilityForTab('reports-reviews', 'premium')).toBeNull()
    expect(lockedCapabilityForTab('compite-ranking', 'premium')).toBeNull()
    expect(includedPlanCapabilities('premium').some((item) => item.id === 'featured')).toBe(true)
    expect(includedPlanCapabilities('premium').some((item) => item.id === 'compite')).toBe(true)
  })

  it('blocks activating a fourth menu or a PDF menu on Sala', () => {
    const boards = [
      { id: 'a', active: true },
      { id: 'b', active: true },
      { id: 'c', active: true },
    ]

    expect(
      menuBoardActivationBlockReason(
        { id: 'd', active: false, template: gridTemplate, pdfUrl: '' },
        [...boards, { id: 'd', active: false }],
        'basic',
      ),
    ).toMatch(/3 cartas activas/)

    expect(
      menuBoardActivationBlockReason(
        { id: 'a', active: false, template: listTemplate, pdfUrl: 'https://cdn/x.pdf' },
        [{ id: 'a', active: false }],
        'basic',
      ),
    ).toMatch(/PDF/)
  })

  it('blocks activating a sixth menu on Local', () => {
    const boards = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, active: true }))

    expect(
      menuBoardActivationBlockReason(
        { id: 'f', active: false, template: gridTemplate, pdfUrl: '' },
        [...boards, { id: 'f', active: false }],
        'premium',
      ),
    ).toMatch(/5 cartas activas/)
  })
})

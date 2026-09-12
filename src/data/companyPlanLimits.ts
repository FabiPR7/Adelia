import {
  hasMenuPdf,
  type CompanyTab,
  type MenuBoard,
  type MenuTemplateConfig,
  type PromotionType,
} from '../types/company'
import {
  COMPANY_PLAN_CAPABILITIES,
  COMPANY_PLANS,
  getCompanyPlan,
  parseCompanyPlanId,
  type CompanyPlanId,
  type CompanyPlanCapValue,
} from './companyPlans'

const PROMO_TYPE_CAPABILITY: Record<PromotionType, string> = {
  reservation_ladder: 'promos_offer',
  time_limited: 'promos_limited',
  attendance: 'promos_attendance',
}

export function planCapabilityValue(
  planId: CompanyPlanId,
  capabilityId: string,
): CompanyPlanCapValue | undefined {
  return COMPANY_PLAN_CAPABILITIES.find((capability) => capability.id === capabilityId)?.values[planId]
}

export function planHasCapability(planId: CompanyPlanId, capabilityId: string): boolean {
  const value = planCapabilityValue(planId, capabilityId)
  return value !== undefined && value !== false
}

export function firstPlanWithCapability(capabilityId: string): CompanyPlanId {
  for (const plan of COMPANY_PLANS) {
    if (planHasCapability(plan.id, capabilityId)) {
      return plan.id
    }
  }

  return 'premium'
}

export function requiredPlanName(capabilityId: string, requiredPlanId?: CompanyPlanId): string {
  return getCompanyPlan(requiredPlanId ?? firstPlanWithCapability(capabilityId)).name
}

export type PlanCountCapability =
  | 'menus'
  | 'tables'
  | 'active_maps'
  | 'promos_offer'
  | 'promos_limited'
  | 'promos_attendance'

export function planMaxCount(planId: CompanyPlanId, capabilityId: PlanCountCapability): number | null {
  const value = planCapabilityValue(planId, capabilityId)
  if (value === 'unlimited' || value === true || value === 'list') {
    return null
  }

  if (typeof value === 'number' && value > 0) {
    return value
  }

  return 0
}

export function planMaxPromosOfType(planId: CompanyPlanId, type: PromotionType): number | null {
  return planMaxCount(planId, PROMO_TYPE_CAPABILITY[type] as PlanCountCapability)
}

export function planRequiredForPromoCount(type: PromotionType, nextCount: number): CompanyPlanId {
  return planRequiredForCount(PROMO_TYPE_CAPABILITY[type] as PlanCountCapability, nextCount)
}

export function planMaxFloorPlans(planId: CompanyPlanId): number | null {
  if (planId === 'premium' || planId === 'premium_plus') {
    return planMaxCount(planId, 'active_maps')
  }

  return null
}

export function planAllowsMoreThan(
  planId: CompanyPlanId,
  capabilityId: PlanCountCapability,
  count: number,
): boolean {
  const max = planMaxCount(planId, capabilityId)
  return max == null || count < max
}

export function planRequiredForCount(capabilityId: PlanCountCapability, nextCount: number): CompanyPlanId {
  for (const plan of COMPANY_PLANS) {
    const max = planMaxCount(plan.id, capabilityId)
    if (max == null || max >= nextCount) {
      return plan.id
    }
  }

  return 'premium'
}

export function planAllowsPromotions(planId: CompanyPlanId): boolean {
  return planHasCapability(planId, 'promos_offer')
    || planHasCapability(planId, 'promos_limited')
    || planHasCapability(planId, 'promos_attendance')
}

export function planAllowsPromotionType(planId: CompanyPlanId, type: PromotionType): boolean {
  return planHasCapability(planId, PROMO_TYPE_CAPABILITY[type])
}

export function promotionTypeCapability(type: PromotionType): string {
  return PROMO_TYPE_CAPABILITY[type]
}

export function planAllowsReports(planId: CompanyPlanId): boolean {
  return planHasCapability(planId, 'reports')
}

export function planAllowsCompite(planId: CompanyPlanId): boolean {
  return planHasCapability(planId, 'compite')
}

export function planAllowsDeposits(planId: CompanyPlanId): boolean {
  return planHasCapability(planId, 'deposits')
}

export function planAllowsFloorPlan(planId: CompanyPlanId): boolean {
  return planHasCapability(planId, 'floor_plan')
}

export function planAllowsMenuPhotos(planId: CompanyPlanId): boolean {
  return planHasCapability(planId, 'menu_photos')
}

export function planAllowsMenuPdf(planId: CompanyPlanId): boolean {
  return planHasCapability(planId, 'menu_pdf')
}

export function planAllowsExcel(planId: CompanyPlanId): boolean {
  return planHasCapability(planId, 'excel')
}

export function planAllowsMenuGrid(planId: CompanyPlanId): boolean {
  return planAllowsMenuPhotos(planId)
}

const TAB_CAPABILITY: Partial<Record<CompanyTab, string>> = {
  'clients-promotions': 'promos_offer',
  'reports-reservations': 'reports',
  'reports-clients': 'reports',
  'reports-products': 'reports_advanced',
  'reports-reviews': 'reports_advanced',
  'reports-app': 'reports_advanced',
  'compite-notifications': 'compite',
  'compite-missions': 'compite',
  'compite-ranking': 'compite',
}

const TAB_FEATURE_LABEL: Partial<Record<CompanyTab, string>> = {
  'clients-promotions': 'las promociones',
  'reports-reservations': 'los informes de reservas',
  'reports-clients': 'los informes de clientes',
  'reports-products': 'los informes de productos',
  'reports-reviews': 'los informes de reseñas',
  'reports-app': 'el informe de la App',
  'compite-notifications': 'Compite',
  'compite-missions': 'Compite',
  'compite-ranking': 'Compite',
}

export function lockedCapabilityForTab(tab: CompanyTab, planId: CompanyPlanId): string | null {
  const capabilityId = TAB_CAPABILITY[tab]
  if (!capabilityId) {
    return null
  }

  if (capabilityId === 'promos_offer' && planAllowsPromotions(planId)) {
    return null
  }

  if (planHasCapability(planId, capabilityId)) {
    return null
  }

  return capabilityId
}

export function lockedTabFeatureLabel(tab: CompanyTab): string {
  return TAB_FEATURE_LABEL[tab] ?? 'esta opción'
}

export function planUpgradeHint(input: {
  feature: string
  capabilityId?: string
  requiredPlanId?: CompanyPlanId
}): { title: string; detail: string; cta: string } {
  const planName = requiredPlanName(input.capabilityId ?? 'menus', input.requiredPlanId)

  return {
    title: `Si quieres ${input.feature}, sube de plan.`,
    detail: `Esta opción está en el plan ${planName}.`,
    cta: 'Ver planes',
  }
}

export function clampMenuTemplateForPlan(
  template: MenuTemplateConfig,
  planId: CompanyPlanId,
): MenuTemplateConfig {
  const next = { ...template }

  if (!planAllowsMenuGrid(planId)) {
    next.layout = 'list'
  }

  if (!planAllowsMenuPhotos(planId)) {
    next.showPhotos = false
  }

  return next
}

export function menuBoardActivationBlockReason(
  board: Pick<MenuBoard, 'id' | 'active' | 'template' | 'pdfUrl'>,
  boards: Array<Pick<MenuBoard, 'id' | 'active'>>,
  planId: CompanyPlanId,
): string | null {
  const maxMenus = planMaxCount(planId, 'menus')
  const otherActive = boards.filter((entry) => entry.active && entry.id !== board.id).length
  const planName = getCompanyPlan(planId).name

  if (maxMenus != null && otherActive >= maxMenus) {
    const nextPlanName = requiredPlanName('menus', planRequiredForCount('menus', otherActive + 1))
    return `En ${planName} solo puedes tener ${maxMenus === 1 ? '1 carta activa' : `${maxMenus} cartas activas`}. Pasa a ${nextPlanName} para activar más.`
  }

  if (!planAllowsMenuGrid(planId) && board.template.layout !== 'list') {
    return `En ${planName} la carta tiene que estar en lista. Cambia la disposición antes de activarla.`
  }

  if (!planAllowsMenuPdf(planId) && hasMenuPdf(board)) {
    return `En ${planName} no puedes activar una carta con PDF. Quita el PDF o pasa a ${requiredPlanName('menu_pdf')}.`
  }

  return null
}

export function clampPublicMenuBoardForPlan(board: MenuBoard, planId: CompanyPlanId): MenuBoard {
  const template = clampMenuTemplateForPlan(board.template, planId)

  if (planAllowsMenuPdf(planId)) {
    return template === board.template ? board : { ...board, template }
  }

  return {
    ...board,
    template,
    pdfUrl: '',
    pdfFileName: '',
    pdfPages: 0,
  }
}

export function clampFloorPlansEnabled<T extends { enabled: boolean }>(
  plans: T[],
  planId: CompanyPlanId,
): T[] {
  const maxActive = planMaxCount(planId, 'active_maps')
  if (maxActive === 0) {
    return plans.map((plan) => ({ ...plan, enabled: false }))
  }

  if (maxActive == null) {
    return plans
  }

  let kept = 0
  return plans.map((plan) => {
    if (!plan.enabled) {
      return plan
    }

    kept += 1
    return kept > maxActive ? { ...plan, enabled: false } : plan
  })
}

export function parsePlanId(value: unknown): CompanyPlanId {
  return parseCompanyPlanId(value)
}

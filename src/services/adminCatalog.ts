import { doc, getDoc } from 'firebase/firestore'
import { adminApi, type AdminCatalogOp } from './adminApi'
import { db } from '../config/firebase'
import {
  applyCompanyCatalog,
  COMPANY_HISTORICAL_MISSIONS,
  COMPANY_LEVEL_PERKS,
  COMPANY_LEVELS,
  COMPANY_MONTHLY_MISSIONS,
  COMPANY_WEEKLY_MISSIONS,
} from '../data/companyGamificationCatalog'
import {
  applyPlanCatalog,
  COMPANY_PLAN_CAPABILITIES,
  COMPANY_PLAN_IDS,
  COMPANY_PLANS,
  getCompanyPlan,
  type CompanyPlan,
  type CompanyPlanCapability,
  type CompanyPlanCatalogDoc,
  type CompanyPlanId,
} from '../data/companyPlans'
import { applyPenaltyConfig } from '../data/cancellationPenalties'
import { applyLevelCatalog, GAMIFICATION_LEVELS, PROFILE_REWARDS } from '../data/gamificationLevels'
import {
  applyItemCatalog,
  applyRewardsConfig,
  INVENTORY_ITEMS,
  type InventoryItemDefinition,
  type RewardsConfig,
} from '../data/inventoryItems'
import {
  applyBillingConfig,
  LEMONSQUEEZY_CHECKOUT_URL,
  LEMONSQUEEZY_STORE_ID,
  LEMONSQUEEZY_VARIANT_IDS,
} from '../data/lemonSqueezyCheckout'
import {
  applyGameConfig,
  CONFIRMED_RESERVATION_XP,
  WEEKLY_BONUS_TARGET,
  WEEKLY_MISSION_BONUS_XP,
  type GamificationLevel,
  type MissionDefinition,
} from '../types/gamification'

/**
 * Escritura del catálogo editable desde el panel de administración. Cada guardado
 * escribe en Firestore (las reglas solo dejan a administración) y aplica el
 * cambio en memoria para que el propio panel lo vea sin recargar. El servidor
 * lo recoge solo, en menos de 5 minutos.
 */

/** Firestore rechaza `undefined`; esto lo descarta y copia en profundidad. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

// ─── Planes ──────────────────────────────────────────────────────────────

export function planCapsFor(planId: CompanyPlanId, capabilities: CompanyPlanCapability[]) {
  return Object.fromEntries(capabilities.map((capability) => [capability.id, capability.values[planId]]))
}

export async function savePlanCatalog(
  plans: CompanyPlan[],
  capabilities: CompanyPlanCapability[],
): Promise<void> {
  // Por la API del admin: el servidor solo deja tocar los documentos de catálogos.
  const ops: AdminCatalogOp[] = []
  const docs: CompanyPlanCatalogDoc[] = []

  COMPANY_PLAN_IDS.forEach((planId, order) => {
    const plan = plans.find((entry) => entry.id === planId) ?? getCompanyPlan(planId)
    const data: CompanyPlanCatalogDoc = { ...clean(plan), order, caps: planCapsFor(planId, capabilities) }
    docs.push(data)
    ops.push({ type: 'set', path: `planCatalog/${planId}`, data: data as unknown as Record<string, unknown>, merge: true })
  })

  const labels = capabilities.map(({ id, label }) => ({ id, label }))
  ops.push({ type: 'set', path: 'appConfig/planCapabilities', data: { items: labels } })
  await adminApi.catalogBatch(ops)

  // El orden y el plan retirado no se tocan en memoria: solo precios, textos y capacidades.
  applyPlanCatalog(docs, labels)
}

// ─── Ítems ───────────────────────────────────────────────────────────────

export async function saveInventoryItem(item: InventoryItemDefinition): Promise<void> {
  const data = clean(item)
  await adminApi.catalogBatch([{ type: 'set', path: `inventoryItems/${item.id}`, data: data as unknown as Record<string, unknown>, merge: true }])

  const exists = INVENTORY_ITEMS.some((entry) => entry.id === item.id)
  applyItemCatalog(exists
    ? INVENTORY_ITEMS.map((entry) => (entry.id === item.id ? data : entry))
    : [...INVENTORY_ITEMS, data])
}

// ─── Recompensas y penalizaciones ────────────────────────────────────────

export async function saveRewardsConfig(config: Required<RewardsConfig>): Promise<void> {
  const data = clean(config)
  // Sin merge: quitar un nivel o un ítem de una lista tiene que borrarlo de verdad.
  await adminApi.catalogBatch([{ type: 'set', path: 'gameConfig/rewards', data: data as unknown as Record<string, unknown> }])
  applyRewardsConfig(data)
}

export async function savePenaltyConfig(config: {
  rates: Array<{ strike: number; percent: number; minXp: number }>
  lockStrikes: number
}): Promise<void> {
  const data = clean(config)
  await adminApi.catalogBatch([{ type: 'set', path: 'gameConfig/penalties', data: data as unknown as Record<string, unknown> }])
  applyPenaltyConfig(data)
}

// ─── Facturación ─────────────────────────────────────────────────────────

export interface BillingVariant {
  variantId: string
  plan: 'basic' | 'premium'
  period: 'monthly' | 'annual'
}

export interface BillingConfig {
  checkoutUrl: string
  storeId: string
  variants: BillingVariant[]
}

export async function loadBillingConfig(): Promise<BillingConfig> {
  const snap = await getDoc(doc(db, 'appConfig', 'billing'))
  const data = snap.exists() ? snap.data() : {}
  const stored: BillingVariant[] = data.variants && typeof data.variants === 'object'
    ? Object.entries(data.variants as Record<string, { plan?: string; period?: string }>).flatMap(([variantId, value]) => (
        (value?.plan === 'basic' || value?.plan === 'premium') && (value?.period === 'monthly' || value?.period === 'annual')
          ? [{ variantId, plan: value.plan, period: value.period }]
          : []
      ))
    : []

  const fallback: BillingVariant[] = Object.entries(LEMONSQUEEZY_VARIANT_IDS).flatMap(([plan, periods]) => (
    Object.entries(periods).map(([period, variantId]) => ({
      variantId,
      plan: plan as BillingVariant['plan'],
      period: period as BillingVariant['period'],
    }))
  ))

  return {
    checkoutUrl: typeof data.checkoutUrl === 'string' && data.checkoutUrl ? data.checkoutUrl : LEMONSQUEEZY_CHECKOUT_URL,
    storeId: typeof data.storeId === 'string' && data.storeId ? data.storeId : LEMONSQUEEZY_STORE_ID,
    variants: stored.length > 0 ? stored : fallback,
  }
}

export async function saveBillingConfig(config: BillingConfig): Promise<void> {
  const variants = Object.fromEntries(
    config.variants
      .filter((variant) => variant.variantId.trim())
      .map((variant) => [variant.variantId.trim(), { plan: variant.plan, period: variant.period }]),
  )
  await adminApi.catalogBatch([{
    type: 'set',
    path: 'appConfig/billing',
    data: { checkoutUrl: config.checkoutUrl.trim(), storeId: config.storeId.trim(), variants },
  }])
  applyBillingConfig({ checkoutUrl: config.checkoutUrl.trim(), storeId: config.storeId.trim() })
}

// ─── Gamificación de restaurantes ────────────────────────────────────────

export interface CompanyGameDraft {
  levels: Array<GamificationLevel & { perk: string }>
  missions: MissionDefinition[]
  config: {
    weeklySlotCount: number
    monthlySlotCount: number
    weeklyBonusTarget: number
    weeklyBonusXp: number
    confirmedXp: number
    reviewXp: number
    replyXp: number
  }
}

export function currentCompanyMissions(): MissionDefinition[] {
  return [...COMPANY_WEEKLY_MISSIONS, ...COMPANY_MONTHLY_MISSIONS, ...COMPANY_HISTORICAL_MISSIONS]
}

export function currentCompanyLevels(): CompanyGameDraft['levels'] {
  return COMPANY_LEVELS.map((level) => ({ ...level, perk: COMPANY_LEVEL_PERKS[level.level] ?? '' }))
}

export async function saveCompanyGame(draft: CompanyGameDraft): Promise<void> {
  const levels = [...draft.levels].sort((left, right) => left.minXp - right.minXp)
  const ops: AdminCatalogOp[] = []
  for (const level of levels) {
    ops.push({
      type: 'set',
      path: `companyLevelCatalog/${level.level}`,
      data: { ...(clean(level) as unknown as Record<string, unknown>), perk: level.perk.trim() || null },
      merge: true,
    })
  }
  for (const mission of draft.missions) {
    ops.push({ type: 'set', path: `companyMissionCatalog/${mission.id}`, data: clean(mission) as unknown as Record<string, unknown>, merge: true })
  }
  ops.push({ type: 'set', path: 'gameConfig/company', data: { ...draft.config }, merge: true })
  await adminApi.catalogBatch(ops)

  applyCompanyCatalog({
    levels: levels.map((level) => ({ ...level, perk: level.perk.trim() || undefined })),
    missions: draft.missions,
    config: draft.config,
  })
}

// ─── Gamificación de clientes (niveles y XP) ─────────────────────────────

export interface CustomerGameDraft {
  levels: Array<GamificationLevel & { reward: string }>
  config: { weeklyBonusXp: number; weeklyBonusTarget: number; confirmedReservationXp: number }
}

export function currentCustomerGame(): CustomerGameDraft {
  const rewards = new Map(PROFILE_REWARDS.map((entry) => [entry.level, entry.reward]))
  return {
    levels: GAMIFICATION_LEVELS.map((level) => ({ ...level, reward: rewards.get(level.level) ?? '' })),
    config: {
      weeklyBonusXp: WEEKLY_MISSION_BONUS_XP,
      weeklyBonusTarget: WEEKLY_BONUS_TARGET,
      confirmedReservationXp: CONFIRMED_RESERVATION_XP,
    },
  }
}

export async function saveCustomerGame(draft: CustomerGameDraft): Promise<void> {
  const levels = [...draft.levels]
    .sort((left, right) => left.minXp - right.minXp)
    // El tope sale del siguiente nivel, así editar un mínimo nunca deja huecos.
    .map((level, index, all) => ({ ...level, maxXp: all[index + 1] ? all[index + 1].minXp - 1 : null }))

  const ops: AdminCatalogOp[] = []
  for (const level of levels) {
    ops.push({ type: 'set', path: `levelCatalog/${level.level}`, merge: true, data: {
      id: String(level.level),
      level: level.level,
      name: level.title,
      title: level.title,
      minXp: level.minXp,
      points: level.minXp,
      maxXp: level.maxXp,
      colors: level.colors,
      styleClass: level.styleClass,
      reward: level.reward.trim() || null,
    } })
  }
  ops.push({ type: 'set', path: 'gameConfig/adelia', data: { ...draft.config }, merge: true })
  await adminApi.catalogBatch(ops)

  applyLevelCatalog(
    levels.map(({ reward: _reward, ...level }) => level),
    levels.filter((level) => level.reward.trim()).map((level) => ({ level: level.level, reward: level.reward.trim() })),
  )
  applyGameConfig(draft.config)
}

export { COMPANY_PLANS, COMPANY_PLAN_CAPABILITIES }

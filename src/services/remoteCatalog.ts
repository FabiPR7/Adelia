import { collection, doc, getDoc, getDocs, limit, query } from 'firebase/firestore'
import { db } from '../config/firebase'
import { bundleDoc, bundleQuery, fetchCatalogBundle } from './catalogBundle'
import { applyBillingConfig } from '../data/lemonSqueezyCheckout'
import { applyPenaltyConfig } from '../data/cancellationPenalties'
import { applyCompanyCatalog, type CompanyCatalogData } from '../data/companyGamificationCatalog'
import { applyPlanCatalog, type CompanyPlanCatalogDoc } from '../data/companyPlans'
import {
  applyItemCatalog,
  applyRewardsConfig,
  type InventoryEmblem,
  type InventoryGrant,
  type InventoryItemDefinition,
  type InventoryItemKind,
  type InventoryRarity,
  type LootBand,
  type MissionLootDifficulty,
  type RewardsConfig,
} from '../data/inventoryItems'

/**
 * Catálogo editable desde Firestore: planes (`planCatalog`), ítems
 * (`inventoryItems`), recompensas y penalizaciones (`gameConfig/rewards`,
 * `gameConfig/penalties`) y facturación (`appConfig/billing`). Lo escrito en el
 * código solo es el respaldo para cuando la base de datos está vacía o no
 * responde. Misiones y niveles los carga `gameCatalog.ts`.
 */

const KINDS: InventoryItemKind[] = [
  'reservation_token', 'cancel_shield', 'ladder_boost', 'xp', 'pardon',
  'unlock', 'relic', 'extra_pax', 'deposit_pass', 'review_boost',
]
const RARITIES: InventoryRarity[] = ['white', 'copper', 'silver', 'gold', 'azure', 'ash']
const DIFFICULTIES: MissionLootDifficulty[] = ['none', 'easy', 'medium', 'hard', 'legendary']

type Raw = Record<string, unknown>

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function textList(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : undefined
}

function parseItem(id: string, data: Raw): InventoryItemDefinition | null {
  const kind = KINDS.find((entry) => entry === data.kind)
  const rarity = RARITIES.find((entry) => entry === data.rarity)
  const name = text(data.name)
  if (!kind || !rarity || !name) {
    return null
  }

  const item: InventoryItemDefinition = {
    id,
    kind,
    name,
    shortName: text(data.shortName) ?? name,
    description: text(data.description) ?? '',
    howToUse: text(data.howToUse) ?? '',
    howToEarn: text(data.howToEarn) ?? '',
    rarity,
  }
  const emblem = text(data.emblem)
  if (emblem) item.emblem = emblem as InventoryEmblem
  const visitValue = finite(data.visitValue)
  if (visitValue !== undefined) item.visitValue = visitValue as InventoryItemDefinition['visitValue']
  const spendBand = finite(data.spendBand)
  if (spendBand !== undefined) item.spendBand = spendBand as InventoryItemDefinition['spendBand']
  const xpValue = finite(data.xpValue)
  if (xpValue !== undefined) item.xpValue = xpValue
  if (typeof data.coversMinSpend === 'boolean') item.coversMinSpend = data.coversMinSpend
  if (typeof data.usable === 'boolean') item.usable = data.usable
  return item
}

function parseGrants(value: unknown): InventoryGrant[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((entry) => {
    const grant = entry as Raw | null
    const itemId = text(grant?.itemId)
    const quantity = finite(grant?.quantity)
    return itemId && quantity !== undefined && quantity > 0 ? [{ itemId, quantity: Math.trunc(quantity) }] : []
  })
}

function parseRewards(data: Raw | undefined): RewardsConfig {
  const config: RewardsConfig = {}
  if (!data) {
    return config
  }

  if (data.levelRewards && typeof data.levelRewards === 'object') {
    const levelRewards: Record<number, InventoryGrant[]> = {}
    for (const [key, value] of Object.entries(data.levelRewards as Raw)) {
      const level = Number(key)
      const grants = parseGrants(value)
      if (Number.isInteger(level) && grants.length > 0) {
        levelRewards[level] = grants
      }
    }
    if (Object.keys(levelRewards).length > 0) config.levelRewards = levelRewards
  }

  if (data.lootPools && typeof data.lootPools === 'object') {
    const lootPools: NonNullable<RewardsConfig['lootPools']> = {}
    for (const difficulty of DIFFICULTIES) {
      if (difficulty === 'none') continue
      const pool = textList((data.lootPools as Raw)[difficulty])?.filter(Boolean)
      if (pool && pool.length > 0) lootPools[difficulty] = pool
    }
    if (Object.keys(lootPools).length > 0) config.lootPools = lootPools
  }

  if (data.lootBands && typeof data.lootBands === 'object') {
    const lootBands: Record<string, LootBand[]> = {}
    for (const [cadence, value] of Object.entries(data.lootBands as Raw)) {
      if (!Array.isArray(value)) continue
      const bands = value.flatMap((entry) => {
        const band = entry as Raw | null
        const difficulty = DIFFICULTIES.find((candidate) => candidate === band?.difficulty)
        const below = finite(band?.below)
        return difficulty ? [{ ...(below !== undefined ? { below } : {}), difficulty }] : []
      })
      if (bands.length > 0) lootBands[cadence] = bands
    }
    if (Object.keys(lootBands).length > 0) config.lootBands = lootBands
  }

  config.reviewBoostXp = finite(data.reviewBoostXp)
  config.reviewBoostAdelinas = finite(data.reviewBoostAdelinas)
  config.walkInCooldownHours = finite(data.walkInCooldownHours)
  return config
}

function parsePlan(id: string, data: Raw): CompanyPlanCatalogDoc | null {
  const name = text(data.name)
  if (!name) {
    return null
  }

  const caps: NonNullable<CompanyPlanCatalogDoc['caps']> = {}
  if (data.caps && typeof data.caps === 'object') {
    for (const [capId, value] of Object.entries(data.caps as Raw)) {
      if (typeof value === 'boolean' || value === 'unlimited' || value === 'list' || typeof value === 'number') {
        caps[capId] = value
      }
    }
  }

  const specs = Array.isArray(data.specs)
    ? data.specs.flatMap((entry) => {
        const spec = entry as Raw | null
        const label = text(spec?.label)
        const value = text(spec?.value)
        return label && value ? [{ label, value }] : []
      })
    : undefined

  return {
    id: id as CompanyPlanCatalogDoc['id'],
    name,
    audience: text(data.audience),
    priceMonthly: finite(data.priceMonthly),
    period: typeof data.period === 'string' ? data.period : undefined,
    priceAnnual: finite(data.priceAnnual),
    annualDiscountPercent: finite(data.annualDiscountPercent),
    vatNote: text(data.vatNote),
    badge: text(data.badge),
    trialLabel: text(data.trialLabel),
    highlighted: typeof data.highlighted === 'boolean' ? data.highlighted : undefined,
    comingSoon: typeof data.comingSoon === 'boolean' ? data.comingSoon : undefined,
    includesPrevious: text(data.includesPrevious),
    chips: textList(data.chips),
    specs,
    features: textList(data.features),
    ctaLabel: text(data.ctaLabel),
    order: finite(data.order),
    caps,
  }
}

function parseCompany(
  levelDocs: Array<{ id: string; data: () => unknown }>,
  missionDocs: Array<{ id: string; data: () => unknown }>,
  config: Raw | undefined,
): CompanyCatalogData {
  const levels = levelDocs.flatMap((item) => {
    const data = item.data() as Raw
    const level = finite(data.level) ?? Number(item.id)
    const title = text(data.title) ?? text(data.name)
    const minXp = finite(data.minXp)
    if (!Number.isFinite(level) || !title || minXp === undefined) {
      return []
    }
    const colors = textList(data.colors) ?? []
    return [{
      level,
      title,
      minXp,
      maxXp: null,
      colors: [colors[0] ?? '#F4E6D4', colors[1] ?? colors[0] ?? '#C4A574'] as [string, string],
      styleClass: text(data.styleClass) ?? `companyLevel${level}`,
      perk: text(data.perk),
    }]
  })

  const cadences = ['weekly', 'monthly', 'historical']
  const missions = missionDocs.flatMap((item) => {
    const data = item.data() as Raw
    const name = text(data.name)
    const xp = finite(data.xp)
    const cadence = cadences.find((entry) => entry === data.cadence) as 'weekly' | 'monthly' | 'historical' | undefined
    if (!name || xp === undefined || !cadence) {
      return []
    }
    const category = text(data.category) as 'loyalty' | 'reviews' | 'rewards' | 'exploration' | undefined
    return [{
      id: item.id,
      name,
      description: text(data.description) ?? '',
      xp,
      cadence,
      icon: text(data.icon) ?? '🏅',
      target: finite(data.target) ?? 1,
      ...(category ? { category } : {}),
    }]
  })

  return {
    levels,
    missions,
    config: config
      ? {
          weeklySlotCount: finite(config.weeklySlotCount),
          monthlySlotCount: finite(config.monthlySlotCount),
          weeklyBonusTarget: finite(config.weeklyBonusTarget),
          weeklyBonusXp: finite(config.weeklyBonusXp),
          confirmedXp: finite(config.confirmedXp),
          reviewXp: finite(config.reviewXp),
          replyXp: finite(config.replyXp),
        }
      : undefined,
  }
}

let catalogPromise: Promise<void> | null = null

/** Una sola lectura por carga de página; si falla se queda con el respaldo del código. */
export function loadRemoteCatalog(): Promise<void> {
  if (!catalogPromise) {
    catalogPromise = hydrateRemoteCatalog().catch(() => undefined)
  }
  return catalogPromise
}

/** Primero el JSON del servidor (1 petición en caché); si falla, Firestore. */
async function readCatalogSources() {
  const bundle = await fetchCatalogBundle()
  if (bundle) {
    return [
      bundleQuery(bundle, 'planCatalog'),
      bundleQuery(bundle, 'inventoryItems'),
      bundleDoc(bundle, 'gameConfig/rewards'),
      bundleDoc(bundle, 'gameConfig/penalties'),
      bundleDoc(bundle, 'appConfig/billing'),
      bundleDoc(bundle, 'appConfig/planCapabilities'),
      bundleQuery(bundle, 'companyLevelCatalog'),
      bundleQuery(bundle, 'companyMissionCatalog'),
      bundleDoc(bundle, 'gameConfig/company'),
    ] as const
  }
  return Promise.all([
    getDocs(query(collection(db, 'planCatalog'), limit(20))),
    getDocs(query(collection(db, 'inventoryItems'), limit(200))),
    getDoc(doc(db, 'gameConfig', 'rewards')),
    getDoc(doc(db, 'gameConfig', 'penalties')),
    getDoc(doc(db, 'appConfig', 'billing')),
    getDoc(doc(db, 'appConfig', 'planCapabilities')),
    getDocs(query(collection(db, 'companyLevelCatalog'), limit(40))),
    getDocs(query(collection(db, 'companyMissionCatalog'), limit(200))),
    getDoc(doc(db, 'gameConfig', 'company')),
  ])
}

async function hydrateRemoteCatalog(): Promise<void> {
  const [
    plansSnap, itemsSnap, rewardsSnap, penaltiesSnap, billingSnap, capabilitiesSnap,
    companyLevelsSnap, companyMissionsSnap, companyConfigSnap,
  ] = await readCatalogSources()

  const plans = plansSnap.docs
    .map((item) => parsePlan(item.id, item.data() as Raw))
    .filter((item): item is CompanyPlanCatalogDoc => item !== null)
  const labels = capabilitiesSnap.exists() && Array.isArray((capabilitiesSnap.data() as Raw).items)
    ? ((capabilitiesSnap.data() as Raw).items as unknown[]).flatMap((entry) => {
        const capability = entry as Raw | null
        const id = text(capability?.id)
        const label = text(capability?.label)
        return id && label ? [{ id, label }] : []
      })
    : []
  if (plans.length > 0 || labels.length > 0) {
    applyPlanCatalog(plans, labels)
  }

  const items = itemsSnap.docs
    .map((item) => parseItem(item.id, item.data() as Raw))
    .filter((item): item is InventoryItemDefinition => item !== null)
  applyItemCatalog(items)

  if (rewardsSnap.exists()) {
    applyRewardsConfig(parseRewards(rewardsSnap.data() as Raw))
  }

  if (penaltiesSnap.exists()) {
    const data = penaltiesSnap.data() as Raw
    const rates = Array.isArray(data.rates)
      ? data.rates.flatMap((entry) => {
          const rate = entry as Raw | null
          const strike = finite(rate?.strike)
          const percent = finite(rate?.percent)
          const minXp = finite(rate?.minXp)
          return strike !== undefined && percent !== undefined && minXp !== undefined
            ? [{ strike, percent, minXp }]
            : []
        }).sort((left, right) => left.strike - right.strike)
      : undefined
    applyPenaltyConfig({ rates, lockStrikes: finite(data.lockStrikes) })
  }

  applyCompanyCatalog(parseCompany(
    companyLevelsSnap.docs,
    companyMissionsSnap.docs,
    companyConfigSnap.exists() ? (companyConfigSnap.data() as Raw) : undefined,
  ))

  if (billingSnap.exists()) {
    const data = billingSnap.data() as Raw
    applyBillingConfig({ checkoutUrl: text(data.checkoutUrl), storeId: text(data.storeId) })
  }
}

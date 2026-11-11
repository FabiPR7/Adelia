import type { NextFunction, Request, Response } from 'express'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from './collections.ts'

/**
 * Catálogo editable desde Firestore (planes, ítems, recompensas, penalizaciones
 * y facturación). El código solo conserva un respaldo mínimo para cuando la base
 * de datos está vacía o no responde; la fuente de verdad son estos documentos.
 *
 * Las lecturas síncronas (`getRemoteCatalog`) usan la caché; `ensureRemoteCatalog`
 * la refresca como máximo una vez cada CACHE_MS y comparte la lectura entre
 * peticiones concurrentes.
 */

export type RemoteCapValue = boolean | number | 'unlimited' | 'list'
export type RemoteLootDifficulty = 'easy' | 'medium' | 'hard' | 'legendary'
export type RemoteLootBandDifficulty = RemoteLootDifficulty | 'none'

export interface RemoteGrant {
  itemId: string
  quantity: number
}

export interface RemoteItem {
  id: string
  kind: string
  visitValue?: number
  spendBand?: number
  coversMinSpend?: boolean
  xpValue?: number
  usable?: boolean
}

export interface RemoteLootBand {
  /** Límite superior exclusivo de XP; la última banda de cada cadencia no lo lleva. */
  below?: number
  difficulty: RemoteLootBandDifficulty
}

export interface RemoteRewards {
  levelRewards: Record<number, RemoteGrant[]> | null
  lootPools: Partial<Record<RemoteLootDifficulty, string[]>> | null
  lootBands: Record<string, RemoteLootBand[]> | null
  reviewBoostXp: number | null
  reviewBoostAdelinas: number | null
  walkInCooldownHours: number | null
}

export interface RemotePenaltyRate {
  strike: number
  percent: number
  minXp: number
}

export interface RemotePenalties {
  rates: RemotePenaltyRate[] | null
  lockStrikes: number | null
}

export interface RemotePlan {
  id: string
  name: string
  priceMonthly: number | null
  priceAnnual: number | null
  caps: Record<string, RemoteCapValue>
}

export interface RemoteBilling {
  checkoutUrl: string | null
  storeId: string | null
  variants: Record<string, { plan: 'basic' | 'premium'; period: 'monthly' | 'annual' }> | null
}

export interface RemoteCompanyLevel {
  level: number
  title: string
  minXp: number
  maxXp: number | null
  colors: [string, string]
  styleClass: string
}

export interface RemoteCompanyMission {
  id: string
  name: string
  xp: number
  cadence: 'weekly' | 'monthly' | 'historical'
  icon: string
  target: number
  description: string
}

export interface RemoteCompanyConfig {
  weeklySlotCount: number | null
  monthlySlotCount: number | null
  weeklyBonusTarget: number | null
  weeklyBonusXp: number | null
  confirmedXp: number | null
  reviewXp: number | null
  replyXp: number | null
}

export interface RemoteCatalog {
  items: Map<string, RemoteItem> | null
  rewards: RemoteRewards
  penalties: RemotePenalties
  plans: Map<string, RemotePlan> | null
  billing: RemoteBilling
  companyLevels: RemoteCompanyLevel[] | null
  companyMissions: RemoteCompanyMission[] | null
  companyConfig: RemoteCompanyConfig
}

const CACHE_MS = 5 * 60 * 1000
const LOOT_DIFFICULTIES: RemoteLootDifficulty[] = ['easy', 'medium', 'hard', 'legendary']

function emptyCompanyConfig(): RemoteCompanyConfig {
  return {
    weeklySlotCount: null,
    monthlySlotCount: null,
    weeklyBonusTarget: null,
    weeklyBonusXp: null,
    confirmedXp: null,
    reviewXp: null,
    replyXp: null,
  }
}

function emptyCatalog(): RemoteCatalog {
  return {
    items: null,
    rewards: { levelRewards: null, lootPools: null, lootBands: null, reviewBoostXp: null, reviewBoostAdelinas: null, walkInCooldownHours: null },
    penalties: { rates: null, lockStrikes: null },
    plans: null,
    billing: { checkoutUrl: null, storeId: null, variants: null },
    companyLevels: null,
    companyMissions: null,
    companyConfig: emptyCompanyConfig(),
  }
}

let catalog: RemoteCatalog = emptyCatalog()
let loadedAt = 0
let inflight: Promise<void> | null = null

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseGrants(value: unknown): RemoteGrant[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((entry) => {
    const grant = entry as Record<string, unknown> | null
    const itemId = text(grant?.itemId)
    const quantity = finite(grant?.quantity)
    return itemId && quantity !== null && quantity > 0 ? [{ itemId, quantity: Math.trunc(quantity) }] : []
  })
}

export function parseRemoteItem(id: string, data: Record<string, unknown>): RemoteItem | null {
  const kind = text(data.kind)
  if (!id || !kind) {
    return null
  }
  const item: RemoteItem = { id, kind }
  const visitValue = finite(data.visitValue)
  const spendBand = finite(data.spendBand)
  const xpValue = finite(data.xpValue)
  if (visitValue !== null) item.visitValue = visitValue
  if (spendBand !== null) item.spendBand = spendBand
  if (xpValue !== null) item.xpValue = xpValue
  if (typeof data.coversMinSpend === 'boolean') item.coversMinSpend = data.coversMinSpend
  if (typeof data.usable === 'boolean') item.usable = data.usable
  return item
}

export function parseRemoteRewards(data: Record<string, unknown> | undefined): RemoteRewards {
  const rewards = emptyCatalog().rewards
  if (!data) {
    return rewards
  }

  if (data.levelRewards && typeof data.levelRewards === 'object') {
    const levelRewards: Record<number, RemoteGrant[]> = {}
    for (const [key, value] of Object.entries(data.levelRewards as Record<string, unknown>)) {
      const level = Number(key)
      const grants = parseGrants(value)
      if (Number.isInteger(level) && grants.length > 0) {
        levelRewards[level] = grants
      }
    }
    rewards.levelRewards = Object.keys(levelRewards).length > 0 ? levelRewards : null
  }

  if (data.lootPools && typeof data.lootPools === 'object') {
    const lootPools: Partial<Record<RemoteLootDifficulty, string[]>> = {}
    for (const difficulty of LOOT_DIFFICULTIES) {
      const pool = (data.lootPools as Record<string, unknown>)[difficulty]
      if (Array.isArray(pool)) {
        const ids = pool.filter((id): id is string => typeof id === 'string' && id.length > 0)
        if (ids.length > 0) {
          lootPools[difficulty] = ids
        }
      }
    }
    rewards.lootPools = Object.keys(lootPools).length > 0 ? lootPools : null
  }

  if (data.lootBands && typeof data.lootBands === 'object') {
    const lootBands: Record<string, RemoteLootBand[]> = {}
    for (const [cadence, bands] of Object.entries(data.lootBands as Record<string, unknown>)) {
      if (!Array.isArray(bands)) continue
      const parsed = bands.flatMap((band) => {
        const entry = band as Record<string, unknown> | null
        const difficulty = text(entry?.difficulty)
        if (difficulty !== 'none' && !LOOT_DIFFICULTIES.includes(difficulty as RemoteLootDifficulty)) {
          return []
        }
        const below = finite(entry?.below)
        return [{ ...(below !== null ? { below } : {}), difficulty: difficulty as RemoteLootBandDifficulty }]
      })
      if (parsed.length > 0) {
        lootBands[cadence] = parsed
      }
    }
    rewards.lootBands = Object.keys(lootBands).length > 0 ? lootBands : null
  }

  rewards.reviewBoostXp = finite(data.reviewBoostXp)
  rewards.reviewBoostAdelinas = finite(data.reviewBoostAdelinas)
  const cooldown = finite(data.walkInCooldownHours)
  rewards.walkInCooldownHours = cooldown !== null && cooldown >= 0 ? cooldown : null
  return rewards
}

export function parseRemotePenalties(data: Record<string, unknown> | undefined): RemotePenalties {
  const penalties = emptyCatalog().penalties
  if (!data) {
    return penalties
  }
  if (Array.isArray(data.rates)) {
    const rates = data.rates.flatMap((rate) => {
      const entry = rate as Record<string, unknown> | null
      const strike = finite(entry?.strike)
      const percent = finite(entry?.percent)
      const minXp = finite(entry?.minXp)
      return strike !== null && percent !== null && minXp !== null
        ? [{ strike, percent, minXp }]
        : []
    }).sort((left, right) => left.strike - right.strike)
    penalties.rates = rates.length > 0 ? rates : null
  }
  const lockStrikes = finite(data.lockStrikes)
  penalties.lockStrikes = lockStrikes !== null && lockStrikes > 0 ? Math.trunc(lockStrikes) : null
  return penalties
}

export function parseRemotePlan(id: string, data: Record<string, unknown>): RemotePlan | null {
  const name = text(data.name)
  if (!id || !name) {
    return null
  }
  const caps: Record<string, RemoteCapValue> = {}
  if (data.caps && typeof data.caps === 'object') {
    for (const [capId, value] of Object.entries(data.caps as Record<string, unknown>)) {
      if (typeof value === 'boolean' || value === 'unlimited' || value === 'list') {
        caps[capId] = value
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        caps[capId] = value
      }
    }
  }
  return {
    id,
    name,
    priceMonthly: finite(data.priceMonthly),
    priceAnnual: finite(data.priceAnnual),
    caps,
  }
}

export function parseRemoteBilling(data: Record<string, unknown> | undefined): RemoteBilling {
  const billing = emptyCatalog().billing
  if (!data) {
    return billing
  }
  billing.checkoutUrl = text(data.checkoutUrl)
  billing.storeId = text(data.storeId)
  if (data.variants && typeof data.variants === 'object') {
    const variants: NonNullable<RemoteBilling['variants']> = {}
    for (const [variantId, value] of Object.entries(data.variants as Record<string, unknown>)) {
      const entry = value as Record<string, unknown> | null
      const plan = entry?.plan
      const period = entry?.period
      if ((plan === 'basic' || plan === 'premium') && (period === 'monthly' || period === 'annual')) {
        variants[variantId] = { plan, period }
      }
    }
    billing.variants = Object.keys(variants).length > 0 ? variants : null
  }
  return billing
}

export function parseRemoteCompanyLevel(id: string, data: Record<string, unknown>): RemoteCompanyLevel | null {
  const level = finite(data.level) ?? Number(id)
  const title = text(data.title) ?? text(data.name)
  const minXp = finite(data.minXp)
  if (!Number.isFinite(level) || !title || minXp === null) {
    return null
  }
  const colors = Array.isArray(data.colors) ? data.colors.filter((c): c is string => typeof c === 'string') : []
  return {
    level,
    title,
    minXp,
    maxXp: finite(data.maxXp),
    colors: [colors[0] ?? '#F4E6D4', colors[1] ?? colors[0] ?? '#C4A574'],
    styleClass: text(data.styleClass) ?? `companyLevel${level}`,
  }
}

export function parseRemoteCompanyMission(id: string, data: Record<string, unknown>): RemoteCompanyMission | null {
  const cadence = data.cadence
  const name = text(data.name)
  const xp = finite(data.xp)
  if (!id || !name || xp === null || (cadence !== 'weekly' && cadence !== 'monthly' && cadence !== 'historical')) {
    return null
  }
  return {
    id,
    name,
    xp,
    cadence,
    icon: text(data.icon) ?? '🏅',
    target: finite(data.target) ?? 1,
    description: text(data.description) ?? '',
  }
}

export function parseRemoteCompanyConfig(data: Record<string, unknown> | undefined): RemoteCompanyConfig {
  const config = emptyCompanyConfig()
  if (!data) {
    return config
  }
  config.weeklySlotCount = finite(data.weeklySlotCount)
  config.monthlySlotCount = finite(data.monthlySlotCount)
  config.weeklyBonusTarget = finite(data.weeklyBonusTarget)
  config.weeklyBonusXp = finite(data.weeklyBonusXp)
  config.confirmedXp = finite(data.confirmedXp)
  config.reviewXp = finite(data.reviewXp)
  config.replyXp = finite(data.replyXp)
  return config
}

async function loadCatalog(): Promise<RemoteCatalog> {
  const [itemsSnap, plansSnap, rewardsSnap, penaltiesSnap, billingSnap, companyLevelsSnap, companyMissionsSnap, companyConfigSnap] = await Promise.all([
    adminDb.collection(COLLECTIONS.inventoryItems).limit(200).get(),
    adminDb.collection(COLLECTIONS.planCatalog).limit(20).get(),
    adminDb.collection(COLLECTIONS.gameConfig).doc('rewards').get(),
    adminDb.collection(COLLECTIONS.gameConfig).doc('penalties').get(),
    adminDb.collection(COLLECTIONS.appConfig).doc('billing').get(),
    adminDb.collection(COLLECTIONS.companyLevelCatalog).limit(40).get(),
    adminDb.collection(COLLECTIONS.companyMissionCatalog).limit(200).get(),
    adminDb.collection(COLLECTIONS.gameConfig).doc('company').get(),
  ])

  const items = new Map<string, RemoteItem>()
  for (const doc of itemsSnap.docs) {
    const item = parseRemoteItem(doc.id, doc.data())
    if (item) items.set(item.id, item)
  }

  const plans = new Map<string, RemotePlan>()
  for (const doc of plansSnap.docs) {
    const plan = parseRemotePlan(doc.id, doc.data())
    if (plan) plans.set(plan.id, plan)
  }

  const companyLevels = companyLevelsSnap.docs
    .map((doc) => parseRemoteCompanyLevel(doc.id, doc.data()))
    .filter((level): level is RemoteCompanyLevel => level !== null)
    .sort((left, right) => left.minXp - right.minXp)
    // El tope de cada nivel sale del siguiente, así editar un `minXp` nunca deja huecos.
    .map((level, index, all) => ({ ...level, maxXp: all[index + 1] ? all[index + 1].minXp - 1 : null }))
  const companyMissions = companyMissionsSnap.docs
    .map((doc) => parseRemoteCompanyMission(doc.id, doc.data()))
    .filter((mission): mission is RemoteCompanyMission => mission !== null)
    .sort((left, right) => left.id.localeCompare(right.id, 'es'))

  return {
    companyLevels: companyLevels.length > 0 ? companyLevels : null,
    companyMissions: companyMissions.length > 0 ? companyMissions : null,
    companyConfig: parseRemoteCompanyConfig(companyConfigSnap.data()),
    items: items.size > 0 ? items : null,
    rewards: parseRemoteRewards(rewardsSnap.data()),
    penalties: parseRemotePenalties(penaltiesSnap.data()),
    plans: plans.size > 0 ? plans : null,
    billing: parseRemoteBilling(billingSnap.data()),
  }
}

/** Refresca la caché si está caducada. Nunca lanza: ante un fallo se conserva lo último leído. */
export function ensureRemoteCatalog(): Promise<void> {
  if (Date.now() - loadedAt < CACHE_MS) {
    return Promise.resolve()
  }
  if (!inflight) {
    inflight = loadCatalog()
      .then((next) => {
        catalog = next
        loadedAt = Date.now()
      })
      .catch((error) => {
        console.error('remoteCatalog: no se pudo leer el catálogo, se usa el último válido.', error)
        // Reintento pronto, sin martillear Firestore en cada petición.
        loadedAt = Date.now() - CACHE_MS + 30_000
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export function getRemoteCatalog(): RemoteCatalog {
  return catalog
}

export function remoteCatalogMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  void ensureRemoteCatalog().then(() => next())
}

/** Solo para tests. */
export function setRemoteCatalogForTests(next: Partial<RemoteCatalog> | null): void {
  catalog = { ...emptyCatalog(), ...(next ?? {}) }
  loadedAt = next ? Date.now() + CACHE_MS : 0
}

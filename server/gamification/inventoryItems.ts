export const CANCEL_SHIELD_ITEM_ID = 'escudo_mesa'
export const WEEKLY_MISSION_SLOT_COUNT = 6
export const MONTHLY_MISSION_SLOT_COUNT = 5
export const WEEKLY_BONUS_TARGET = 5
export const REVIEW_BOOST_ITEM_ID = 'nota_critico'
export const REVIEW_BOOST_XP = 40
export const REVIEW_BOOST_ADELINAS = 5
export const EXTRA_PAX_ITEM_ID = 'invitacion_extra'
export const DEPOSIT_PASS_ITEM_ID = 'salvoconducto'

export interface InventoryGrant {
  itemId: string
  quantity: number
}

export type InventoryItemKind =
  | 'reservation_token'
  | 'cancel_shield'
  | 'ladder_boost'
  | 'xp'
  | 'pardon'
  | 'unlock'
  | 'relic'
  | 'extra_pax'
  | 'deposit_pass'
  | 'review_boost'

export interface InventoryItemDefinition {
  id: string
  kind: InventoryItemKind
  visitValue?: number
  spendBand?: number
  coversMinSpend?: boolean
  xpValue?: number
  usable?: boolean
}

const TOKEN_IDS: InventoryItemDefinition[] = (
  [1, 3, 5, 10] as const
).flatMap((visits) => (
  ([0, 15, 40] as const).map((spendBand) => ({
    id: spendBand === 0 ? `mesa_${visits}` : `mesa_${visits}_${spendBand}`,
    kind: 'reservation_token' as const,
    visitValue: visits,
    spendBand,
  }))
))

const EXTRA_ITEMS: InventoryItemDefinition[] = [
  { id: 'sello_casa', kind: 'ladder_boost', visitValue: 1, coversMinSpend: true },
  { id: 'doble_sello', kind: 'ladder_boost', visitValue: 2, coversMinSpend: true },
  { id: 'triple_sello', kind: 'ladder_boost', visitValue: 3, coversMinSpend: true },
  { id: 'llave_promo', kind: 'ladder_boost', visitValue: 1, coversMinSpend: true },
  { id: 'llave_maestra', kind: 'ladder_boost', visitValue: 5, coversMinSpend: true },
  { id: 'invitacion_extra', kind: 'extra_pax' },
  { id: 'nota_critico', kind: 'review_boost' },
  { id: 'indulto', kind: 'pardon' },
  { id: 'perdon_promos', kind: 'unlock' },
  { id: 'salvoconducto', kind: 'deposit_pass' },
]

const ITEMS: InventoryItemDefinition[] = [
  ...TOKEN_IDS,
  { id: CANCEL_SHIELD_ITEM_ID, kind: 'cancel_shield' },
  ...EXTRA_ITEMS,
]

const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]))

export function getInventoryItem(id: string): InventoryItemDefinition | null {
  return ITEM_BY_ID.get(id) ?? null
}

export function isPromoSpendItem(item: InventoryItemDefinition): boolean {
  return item.kind === 'reservation_token' || item.kind === 'ladder_boost'
}

const LEVEL_REWARDS: Record<number, InventoryGrant[]> = {
  2: [
    { itemId: 'mesa_1', quantity: 3 },
    { itemId: 'sello_casa', quantity: 1 },
    { itemId: 'invitacion_extra', quantity: 1 },
  ],
  3: [
    { itemId: 'mesa_3', quantity: 1 },
    { itemId: 'mesa_1_15', quantity: 1 },
    { itemId: 'sello_casa', quantity: 1 },
    { itemId: 'nota_critico', quantity: 1 },
  ],
  4: [
    { itemId: 'mesa_3_15', quantity: 1 },
    { itemId: CANCEL_SHIELD_ITEM_ID, quantity: 1 },
    { itemId: 'invitacion_extra', quantity: 1 },
    { itemId: 'mesa_1', quantity: 2 },
  ],
  5: [
    { itemId: 'mesa_5', quantity: 1 },
    { itemId: 'mesa_3', quantity: 1 },
    { itemId: 'doble_sello', quantity: 1 },
    { itemId: 'nota_critico', quantity: 1 },
  ],
  6: [
    { itemId: 'mesa_5_15', quantity: 1 },
    { itemId: CANCEL_SHIELD_ITEM_ID, quantity: 1 },
    { itemId: 'indulto', quantity: 1 },
    { itemId: 'sello_casa', quantity: 1 },
  ],
  7: [
    { itemId: 'mesa_5_40', quantity: 1 },
    { itemId: 'mesa_5', quantity: 1 },
    { itemId: 'llave_promo', quantity: 1 },
    { itemId: 'salvoconducto', quantity: 1 },
  ],
  8: [
    { itemId: 'mesa_10', quantity: 1 },
    { itemId: 'doble_sello', quantity: 1 },
    { itemId: 'salvoconducto', quantity: 1 },
    { itemId: CANCEL_SHIELD_ITEM_ID, quantity: 1 },
  ],
  9: [
    { itemId: 'mesa_10_15', quantity: 1 },
    { itemId: 'triple_sello', quantity: 1 },
    { itemId: CANCEL_SHIELD_ITEM_ID, quantity: 1 },
    { itemId: 'invitacion_extra', quantity: 1 },
  ],
  10: [
    { itemId: 'mesa_10_40', quantity: 1 },
    { itemId: 'llave_promo', quantity: 1 },
    { itemId: 'salvoconducto', quantity: 1 },
    { itemId: 'indulto', quantity: 1 },
  ],
  11: [
    { itemId: 'mesa_10', quantity: 2 },
    { itemId: CANCEL_SHIELD_ITEM_ID, quantity: 2 },
    { itemId: 'llave_maestra', quantity: 1 },
    { itemId: 'triple_sello', quantity: 1 },
  ],
  12: [
    { itemId: 'mesa_10_40', quantity: 1 },
    { itemId: 'mesa_10_15', quantity: 1 },
    { itemId: CANCEL_SHIELD_ITEM_ID, quantity: 2 },
    { itemId: 'perdon_promos', quantity: 1 },
    { itemId: 'llave_maestra', quantity: 1 },
  ],
}

export function rewardsForLevel(level: number): InventoryGrant[] {
  return LEVEL_REWARDS[level] ?? []
}

type MissionLootDifficulty = 'easy' | 'medium' | 'hard' | 'legendary'

export function missionLootDifficulty(cadence: string, xp = 0): MissionLootDifficulty {
  if (cadence === 'weekly') {
    if (xp <= 40) return 'easy'
    if (xp <= 70) return 'medium'
    return 'hard'
  }
  if (cadence === 'monthly') {
    if (xp < 240) return 'easy'
    if (xp <= 300) return 'medium'
    return 'hard'
  }
  if (xp >= 1500) return 'legendary'
  if (xp >= 800) return 'hard'
  if (xp >= 300) return 'medium'
  return 'easy'
}

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pickFromPool(pool: string[], seed: string, count: number): InventoryGrant[] {
  if (pool.length === 0 || count < 1) {
    return []
  }
  const hash = hashSeed(seed)
  const used = new Set<number>()
  const grants: InventoryGrant[] = []
  const n = Math.min(count, pool.length)
  for (let index = 0; index < n; index += 1) {
    let slot = (hash + index * 97) % pool.length
    let guard = 0
    while (used.has(slot) && guard < pool.length) {
      slot = (slot + 1) % pool.length
      guard += 1
    }
    used.add(slot)
    grants.push({ itemId: pool[slot], quantity: 1 })
  }
  return grants
}

const LOOT_POOLS: Record<MissionLootDifficulty, string[]> = {
  easy: [
    'mesa_1',
    'sello_casa',
    'invitacion_extra',
  ],
  medium: [
    'mesa_1_15',
    'mesa_3',
    'sello_casa',
    'invitacion_extra',
    'nota_critico',
  ],
  hard: [
    'mesa_3_15',
    'mesa_5',
    'doble_sello',
    'llave_promo',
    CANCEL_SHIELD_ITEM_ID,
    'indulto',
    'salvoconducto',
  ],
  legendary: [
    'mesa_10_40',
    'mesa_10_15',
    'llave_maestra',
    'triple_sello',
    'perdon_promos',
    CANCEL_SHIELD_ITEM_ID,
    'salvoconducto',
  ],
}

export type SeasonPackKind = 'weekly_bonus' | 'weekly_clear' | 'monthly_clear'

export function seasonPackGrantKey(kind: SeasonPackKind, weekKey: string, monthKey: string): string {
  if (kind === 'monthly_clear') {
    return `monthly_clear:${monthKey}`
  }
  return `${kind}:${weekKey}`
}

export function rewardsForWeeklyBonus(weekKey = ''): InventoryGrant[] {
  return pickFromPool(LOOT_POOLS.medium, `weekly_bonus:${weekKey}`, 3)
}

export function rewardsForWeeklyClear(weekKey = ''): InventoryGrant[] {
  return pickFromPool(LOOT_POOLS.hard, `weekly_clear:${weekKey}`, 3)
}

export function rewardsForMonthlyClear(monthKey = ''): InventoryGrant[] {
  return pickFromPool(LOOT_POOLS.legendary, `monthly_clear:${monthKey}`, 3)
}

export function rewardsForSeasonPack(
  kind: SeasonPackKind,
  weekKey: string,
  monthKey: string,
): InventoryGrant[] {
  if (kind === 'weekly_bonus') {
    return rewardsForWeeklyBonus(weekKey)
  }
  if (kind === 'weekly_clear') {
    return rewardsForWeeklyClear(weekKey)
  }
  return rewardsForMonthlyClear(monthKey)
}

export function rewardsForMission(
  missionId: string,
  cadence: string,
  xp = 0,
): InventoryGrant[] {
  const difficulty = missionLootDifficulty(cadence, xp)
  const seed = `${cadence}:${missionId}:${xp}`
  const pool = LOOT_POOLS[difficulty]

  if (cadence === 'weekly') {
    return pickFromPool(pool, seed, 1)
  }
  if (cadence === 'monthly') {
    return pickFromPool(pool, seed, difficulty === 'easy' ? 1 : 2)
  }
  if (difficulty === 'legendary' || difficulty === 'hard') {
    return pickFromPool(pool, seed, 2)
  }
  return pickFromPool(pool, seed, 1)
}

export function promoMinimumCents(
  minimumSpendCents: number | null | undefined,
  minimumSpendEnabled?: boolean,
): number {
  if (minimumSpendEnabled !== true) {
    return 0
  }
  const cents = typeof minimumSpendCents === 'number' ? minimumSpendCents : 0
  return cents > 0 ? Math.trunc(cents) : 0
}

export function cardCoverCents(spendBand: number | undefined): number {
  const band = typeof spendBand === 'number' && Number.isFinite(spendBand) ? Math.trunc(spendBand) : 0
  return band > 0 ? band * 100 : 0
}

export function tokenSpendFit(spendBand: number | undefined, promoMinCents: number) {
  const coverCents = cardCoverCents(spendBand)
  const required = Math.max(0, Math.trunc(promoMinCents))
  const remainderCents = Math.max(0, required - coverCents)
  return {
    coverCents,
    remainderCents,
    coversFully: remainderCents === 0,
  }
}

export function spendCoverForItem(
  item: InventoryItemDefinition,
  promoMinCents: number,
) {
  if (item.kind === 'ladder_boost' || item.coversMinSpend) {
    const required = Math.max(0, Math.trunc(promoMinCents))
    return { coverCents: required, remainderCents: 0, coversFully: true }
  }
  return tokenSpendFit(item.spendBand, promoMinCents)
}

export function spendBandFromMinimumCents(
  minimumSpendCents: number | null | undefined,
  minimumSpendEnabled?: boolean,
): 0 | 15 | 40 {
  if (minimumSpendEnabled !== true) {
    return 0
  }
  const cents = typeof minimumSpendCents === 'number' ? minimumSpendCents : 0
  if (cents <= 0) {
    return 0
  }
  if (cents <= 1500) {
    return 15
  }
  return 40
}

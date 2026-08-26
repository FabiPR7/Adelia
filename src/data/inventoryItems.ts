import { EXTRA_INVENTORY_ITEMS } from './inventoryExtras'

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

export type InventoryRarity = 'white' | 'copper' | 'silver' | 'gold' | 'azure' | 'ash'
export type InventoryEmblem =
  | 'stamp'
  | 'cutlery'
  | 'cloche'
  | 'shield'
  | 'key'
  | 'ticket'
  | 'crumb'
  | 'napkin'
  | 'compass'
  | 'glass'
  | 'note'
  | 'lock'
  | 'spark'
  | 'junk'
  | 'pax'
  | 'clock'
  | 'deposit'
  | 'ghost'

export type ReservationVisitValue = 1 | 2 | 3 | 5 | 10
export type ReservationSpendBand = 0 | 2 | 5 | 15 | 40
export type MissionLootDifficulty = 'none' | 'easy' | 'medium' | 'hard' | 'legendary'

export interface InventoryGrant {
  itemId: string
  quantity: number
}

export interface InventoryItemDefinition {
  id: string
  kind: InventoryItemKind
  name: string
  shortName: string
  description: string
  howToUse: string
  howToEarn: string
  rarity: InventoryRarity
  emblem?: InventoryEmblem
  visitValue?: ReservationVisitValue
  spendBand?: ReservationSpendBand
  coversMinSpend?: boolean
  xpValue?: number
  usable?: boolean
}

export const WEEKLY_MISSION_SLOT_COUNT = 6
export const MONTHLY_MISSION_SLOT_COUNT = 5
export const REVIEW_BOOST_XP = 40
export const REVIEW_BOOST_ADELINAS = 5
export const REVIEW_BOOST_ITEM_ID = 'nota_critico'
export const EXTRA_PAX_ITEM_ID = 'invitacion_extra'
export const DEPOSIT_PASS_ITEM_ID = 'salvoconducto'

export const CANCEL_SHIELD_ITEM_ID = 'escudo_mesa'

function mesaCard(
  visits: ReservationVisitValue,
  spendBand: ReservationSpendBand,
): InventoryItemDefinition {
  const rarity: InventoryRarity = visits === 1
    ? 'white'
    : visits === 3
      ? 'copper'
      : visits === 5
        ? 'silver'
        : 'gold'
  const id = spendBand === 0 ? `mesa_${visits}` : `mesa_${visits}_${spendBand}`
  const metal = rarity === 'white'
    ? 'Blanca'
    : rarity === 'copper'
      ? 'de Cobre'
      : rarity === 'silver'
        ? 'de Plata'
        : 'de Oro'
  const spendLabel = spendBand === 0
    ? 'sin gasto mínimo'
    : `con gasto mínimo de ${spendBand}€`
  const family = spendBand === 0 ? 'Sello' : spendBand === 15 ? 'Cubierto' : 'Banquete'

  return {
    id,
    kind: 'reservation_token',
    name: `${family} ${metal}`,
    shortName: `${visits}× ${spendBand === 0 ? 'libre' : `${spendBand}€`}`,
    description: spendBand === 0
      ? `Suma ${visits} ${visits === 1 ? 'reserva' : 'reservas'} a una promo de fidelidad que no pide gasto mínimo.`
      : `Suma ${visits} ${visits === 1 ? 'reserva' : 'reservas'} a una promo ${spendLabel}. Solo se puede usar si el mínimo de la promo es ${spendBand}€ o menos.`,
    howToUse: spendBand === 0
      ? 'Pulsa Usar en Promos. En la ficha del restaurante pulsa Usar carta. Solo vale en promos sin gasto mínimo; no cubre un resto de ticket.'
      : 'Pulsa Usar en Promos. En la ficha del restaurante pulsa Usar carta. Sirve si el mínimo de la promo es igual o menor que el de la carta. Si pide más, usa una carta de 40€ o verifica el ticket en el restaurante.',
    howToEarn: 'Se consigue al subir de nivel, completar misiones de la semana o el mes, o desbloquear logros.',
    rarity,
    emblem: spendBand === 40 ? 'cloche' : spendBand === 15 ? 'cutlery' : 'stamp',
    visitValue: visits,
    spendBand,
  }
}

export const INVENTORY_ITEMS: InventoryItemDefinition[] = [
  mesaCard(1, 0),
  mesaCard(3, 0),
  mesaCard(5, 0),
  mesaCard(10, 0),
  mesaCard(1, 15),
  mesaCard(3, 15),
  mesaCard(5, 15),
  mesaCard(10, 15),
  mesaCard(1, 40),
  mesaCard(3, 40),
  mesaCard(5, 40),
  mesaCard(10, 40),
  {
    id: CANCEL_SHIELD_ITEM_ID,
    kind: 'cancel_shield',
    name: 'Escudo de Mesa',
    shortName: 'Sin penalización',
    description: 'Cancela una reserva sin perder XP y sin que cuente como aviso. El restaurante también queda cubierto si cancela él.',
    howToUse: 'Pulsa Cancelar una reserva, abre Cancelar y marca Usar Escudo de Mesa. Si el restaurante cancela, se gasta solo si te queda uno.',
    howToEarn: 'Aparece al subir de nivel, en logros importantes y en el pack de completar el mes.',
    rarity: 'azure',
    emblem: 'shield',
  },
  ...EXTRA_INVENTORY_ITEMS,
]

const ITEM_BY_ID = new Map(INVENTORY_ITEMS.map((item) => [item.id, item]))

export function getInventoryItem(id: string): InventoryItemDefinition | null {
  return ITEM_BY_ID.get(id) ?? null
}

export function inventoryQuantity(inventory: Record<string, number> | undefined, itemId: string): number {
  const value = inventory?.[itemId]
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0
}

export function inventoryTotalCount(inventory: Record<string, number> | undefined): number {
  if (!inventory) {
    return 0
  }

  return Object.values(inventory).reduce((sum, value) => (
    sum + (typeof value === 'number' && value > 0 ? Math.trunc(value) : 0)
  ), 0)
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

export function cardCoverCents(spendBand: ReservationSpendBand | number | undefined): number {
  const band = typeof spendBand === 'number' && Number.isFinite(spendBand) ? Math.trunc(spendBand) : 0
  return band > 0 ? band * 100 : 0
}

export function tokenSpendFit(
  spendBand: ReservationSpendBand | number | undefined,
  promoMinCents: number,
): { coverCents: number; remainderCents: number; coversFully: boolean } {
  const coverCents = cardCoverCents(spendBand)
  const required = Math.max(0, Math.trunc(promoMinCents))
  const remainderCents = Math.max(0, required - coverCents)
  return {
    coverCents,
    remainderCents,
    coversFully: remainderCents === 0,
  }
}

export function spendBandFromMinimumCents(
  minimumSpendCents: number | null | undefined,
  minimumSpendEnabled?: boolean,
): ReservationSpendBand {
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

export function spendBandLabel(band: ReservationSpendBand): string {
  if (band === 0) {
    return 'Sin gasto mínimo'
  }

  return `Gasto mínimo ${band}€`
}

export function itemEmblem(item: InventoryItemDefinition): InventoryEmblem {
  if (item.emblem) {
    return item.emblem
  }
  if (item.kind === 'cancel_shield') {
    return 'shield'
  }
  if (item.spendBand === 40) {
    return 'cloche'
  }
  if (item.spendBand === 15) {
    return 'cutlery'
  }
  return 'stamp'
}

export function isPromoSpendItem(item: InventoryItemDefinition): boolean {
  return item.kind === 'reservation_token' || item.kind === 'ladder_boost'
}

export function missionLootDifficulty(
  cadence: string,
  xp = 0,
): MissionLootDifficulty {
  if (cadence === 'weekly') {
    if (xp < 80) return 'none'
    return 'easy'
  }
  if (cadence === 'monthly') {
    if (xp < 280) return 'none'
    if (xp <= 300) return 'easy'
    return 'medium'
  }
  if (xp < 300) return 'none'
  if (xp < 800) return 'easy'
  if (xp < 1500) return 'medium'
  if (xp < 2200) return 'hard'
  return 'legendary'
}

export function lootDifficultyLabel(difficulty: MissionLootDifficulty): string {
  switch (difficulty) {
    case 'none':
      return 'Sin premio extra'
    case 'easy':
      return 'Premio sencillo'
    case 'medium':
      return 'Premio medio'
    case 'hard':
      return 'Premio útil'
    case 'legendary':
      return 'Premio top'
  }
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

const LOOT_POOLS: Record<Exclude<MissionLootDifficulty, 'none'>, string[]> = {
  easy: [
    'mesa_1',
    'invitacion_extra',
  ],
  medium: [
    'mesa_1_15',
    'mesa_3',
    'nota_critico',
  ],
  hard: [
    'mesa_3_15',
    'mesa_5',
    'doble_sello',
  ],
  legendary: [
    'mesa_10_15',
    'triple_sello',
    CANCEL_SHIELD_ITEM_ID,
  ],
}

export function rarityLabel(rarity: InventoryRarity): string {
  switch (rarity) {
    case 'white':
      return 'Blanca'
    case 'copper':
      return 'Cobre'
    case 'silver':
      return 'Plata'
    case 'gold':
      return 'Oro'
    case 'azure':
      return 'Épica'
    case 'ash':
      return 'Reliquia'
  }
}

const LEVEL_REWARDS: Record<number, InventoryGrant[]> = {
  2: [
    { itemId: 'mesa_1', quantity: 1 },
  ],
  3: [
    { itemId: 'mesa_1', quantity: 1 },
    { itemId: 'invitacion_extra', quantity: 1 },
  ],
  4: [
    { itemId: 'mesa_1_15', quantity: 1 },
    { itemId: 'nota_critico', quantity: 1 },
  ],
  5: [
    { itemId: 'mesa_3', quantity: 1 },
    { itemId: 'mesa_1_15', quantity: 1 },
  ],
  6: [
    { itemId: 'mesa_3_15', quantity: 1 },
    { itemId: CANCEL_SHIELD_ITEM_ID, quantity: 1 },
  ],
  7: [
    { itemId: 'mesa_5', quantity: 1 },
    { itemId: 'llave_promo', quantity: 1 },
  ],
  8: [
    { itemId: 'mesa_5_15', quantity: 1 },
    { itemId: 'doble_sello', quantity: 1 },
  ],
  9: [
    { itemId: 'mesa_5_40', quantity: 1 },
    { itemId: CANCEL_SHIELD_ITEM_ID, quantity: 1 },
  ],
  10: [
    { itemId: 'mesa_10_15', quantity: 1 },
    { itemId: 'triple_sello', quantity: 1 },
  ],
  11: [
    { itemId: 'mesa_10_40', quantity: 1 },
    { itemId: CANCEL_SHIELD_ITEM_ID, quantity: 1 },
  ],
  12: [
    { itemId: 'mesa_10_40', quantity: 1 },
    { itemId: 'llave_maestra', quantity: 1 },
    { itemId: 'perdon_promos', quantity: 1 },
  ],
}

export function rewardsForLevel(level: number): InventoryGrant[] {
  return LEVEL_REWARDS[level] ?? []
}

export type SeasonPackKind = 'weekly_bonus' | 'weekly_clear' | 'monthly_clear'

export function seasonPackGrantKey(kind: SeasonPackKind, weekKey: string, monthKey: string): string {
  if (kind === 'monthly_clear') {
    return `monthly_clear:${monthKey}`
  }
  return `${kind}:${weekKey}`
}

export function rewardsForWeeklyBonus(weekKey = ''): InventoryGrant[] {
  return pickFromPool(LOOT_POOLS.easy, `weekly_bonus:${weekKey}`, 1)
}

export function rewardsForWeeklyClear(weekKey = ''): InventoryGrant[] {
  return pickFromPool(LOOT_POOLS.medium, `weekly_clear:${weekKey}`, 1)
}

export function rewardsForMonthlyClear(monthKey = ''): InventoryGrant[] {
  return pickFromPool(LOOT_POOLS.hard, `monthly_clear:${monthKey}`, 1)
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

export function hasGrantedKey(grantedItemKeys: string[] | undefined, key: string): boolean {
  return Boolean(key) && (grantedItemKeys ?? []).includes(key)
}

export function resolveGrantItems(grants: InventoryGrant[]): Array<{ item: InventoryItemDefinition; quantity: number }> {
  return grants.flatMap((grant) => {
    const item = getInventoryItem(grant.itemId)
    return item && grant.quantity > 0 ? [{ item, quantity: grant.quantity }] : []
  })
}

export function rewardsForMission(
  missionId: string,
  cadence: 'weekly' | 'monthly' | 'historical' | string,
  xp = 0,
): InventoryGrant[] {
  const difficulty = missionLootDifficulty(cadence, xp)
  if (difficulty === 'none') {
    return []
  }

  const seed = `${cadence}:${missionId}:${xp}`
  return pickFromPool(LOOT_POOLS[difficulty], seed, 1)
}

export function mergeTokenCredits(
  counts: Record<string, number>,
  credits: Record<string, number> | undefined,
): Record<string, number> {
  if (!credits) {
    return counts
  }

  const next = { ...counts }
  for (const [companyId, extra] of Object.entries(credits)) {
    if (typeof extra === 'number' && extra > 0) {
      next[companyId] = (next[companyId] ?? 0) + Math.trunc(extra)
    }
  }
  return next
}

export function matchingReservationTokens(
  inventory: Record<string, number> | undefined,
  promoMinCents: number,
): Array<InventoryItemDefinition & { quantity: number; coverCents: number; remainderCents: number; coversFully: boolean }> {
  const required = Math.max(0, Math.trunc(promoMinCents))

  return INVENTORY_ITEMS
    .filter((item) => isPromoSpendItem(item))
    .map((item) => {
      const fit = item.kind === 'ladder_boost' || item.coversMinSpend
        ? { coverCents: required, remainderCents: 0, coversFully: true }
        : tokenSpendFit(item.spendBand, required)
      return {
        ...item,
        quantity: inventoryQuantity(inventory, item.id),
        ...fit,
      }
    })
    .filter((item) => {
      if (item.quantity <= 0) {
        return false
      }
      if (item.kind === 'ladder_boost' || item.coversMinSpend) {
        return true
      }
      if (required <= 0) {
        return true
      }
      return item.coversFully
    })
    .sort((left, right) => {
      if (left.coversFully !== right.coversFully) {
        return left.coversFully ? -1 : 1
      }
      return (left.visitValue ?? 0) - (right.visitValue ?? 0)
    })
}

export function pendingTokenSpendForCompany(
  pending: Array<{
    id: string
    companyId: string
    coverCents: number
    remainderCents: number
  }> | undefined,
  companyId: string,
) {
  return pending?.find((entry) => entry.companyId === companyId) ?? null
}

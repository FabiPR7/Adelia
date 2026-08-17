import { getMissionCatalogEntry, getLevelForXpFromCatalog } from '../data/gameCatalog.ts'
import {
  MONTHLY_MISSION_SLOT_COUNT,
  WEEKLY_BONUS_TARGET,
  WEEKLY_MISSION_SLOT_COUNT,
  getInventoryItem,
  promoMinimumCents,
  rewardsForLevel,
  rewardsForMission,
  rewardsForSeasonPack,
  seasonPackGrantKey,
  spendBandFromMinimumCents,
  REVIEW_BOOST_ADELINAS,
  REVIEW_BOOST_XP,
  type InventoryGrant,
  type SeasonPackKind,
} from './inventoryItems.ts'

const MAX_GRANT_KEYS = 2500
const MAX_USE_XP = 80
const MAX_PENDING_TOKEN_SPEND = 20

export interface PendingTokenSpend {
  id: string
  companyId: string
  itemId: string
  visits: number
  coverCents: number
  remainderCents: number
  requiredCents: number
  createdAt: string
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim()))]
    : []
}

export function numberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const next: Record<string, number> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'number' && Number.isFinite(entry) && entry > 0) {
      next[key] = Math.trunc(entry)
    }
  }
  return next
}

function addGrants(inventory: Record<string, number>, grants: InventoryGrant[]): void {
  for (const grant of grants) {
    if (!getInventoryItem(grant.itemId) || grant.quantity < 1) {
      continue
    }
    inventory[grant.itemId] = (inventory[grant.itemId] ?? 0) + Math.trunc(grant.quantity)
  }
}

export function inventoryQty(state: Record<string, unknown>, itemId: string): number {
  return numberValue(numberRecord(state.inventory)[itemId])
}

export function consumeInventoryItem(
  state: Record<string, unknown>,
  itemId: string,
  quantity = 1,
): Record<string, unknown> {
  const inventory = numberRecord(state.inventory)
  const current = inventory[itemId] ?? 0
  if (current < quantity) {
    throw new Error('No te quedan cartas de este tipo.')
  }

  const nextQty = current - quantity
  if (nextQty <= 0) {
    delete inventory[itemId]
  } else {
    inventory[itemId] = nextQty
  }

  return {
    ...state,
    inventory,
  }
}

export async function applyInventoryGrants(
  state: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const inventory = numberRecord(state.inventory)
  const grantedKeys = stringArray(state.grantedItemKeys)
  const granted = new Set(grantedKeys)
  const weekKey = typeof state.weekKey === 'string' ? state.weekKey : ''
  const monthKey = typeof state.monthKey === 'string' ? state.monthKey : ''

  const grant = (key: string, rewards: InventoryGrant[]) => {
    if (!key || granted.has(key) || rewards.length === 0) {
      return
    }
    granted.add(key)
    grantedKeys.push(key)
    addGrants(inventory, rewards)
  }

  const level = await getLevelForXpFromCatalog(numberValue(state.xp))
  for (let nextLevel = 2; nextLevel <= level; nextLevel += 1) {
    grant(`level:${nextLevel}`, rewardsForLevel(nextLevel))
  }

  for (const missionId of stringArray(state.completedMissions)) {
    const entry = await getMissionCatalogEntry(missionId)
    grant(
      `mission:${missionId}`,
      rewardsForMission(missionId, entry?.cadence ?? 'historical', entry?.xp ?? 0),
    )
  }

  const weeklyMissionIds = stringArray(state.weeklyCompleted).filter(
    (missionId) => missionId !== 'weekly_bonus',
  )
  for (const missionId of weeklyMissionIds) {
    const entry = await getMissionCatalogEntry(missionId)
    grant(
      `weekly:${weekKey}:${missionId}`,
      rewardsForMission(missionId, 'weekly', entry?.xp ?? 0),
    )
  }

  const monthlyMissionIds = stringArray(state.monthlyCompleted)
  for (const missionId of monthlyMissionIds) {
    const entry = await getMissionCatalogEntry(missionId)
    grant(
      `monthly:${monthKey}:${missionId}`,
      rewardsForMission(missionId, 'monthly', entry?.xp ?? 0),
    )
  }

  return {
    ...state,
    inventory,
    grantedItemKeys: compactGrantKeys(grantedKeys),
  }
}

function compactGrantKeys(keys: string[]): string[] {
  const unique = [...new Set(keys)]
  const levelKeys = unique.filter((key) => key.startsWith('level:'))
  const rest = unique.filter((key) => !key.startsWith('level:'))
  return [...levelKeys, ...rest.slice(-MAX_GRANT_KEYS)]
}

export function claimSeasonPack(
  state: Record<string, unknown>,
  kind: SeasonPackKind,
): { state: Record<string, unknown>; grants: InventoryGrant[] } {
  const weekKey = typeof state.weekKey === 'string' ? state.weekKey : ''
  const monthKey = typeof state.monthKey === 'string' ? state.monthKey : ''
  const weeklyCount = stringArray(state.weeklyCompleted).filter(
    (missionId) => missionId !== 'weekly_bonus',
  ).length
  const monthlyCount = stringArray(state.monthlyCompleted).length

  if (kind === 'weekly_bonus' && weeklyCount < WEEKLY_BONUS_TARGET) {
    throw new Error(`Completa ${WEEKLY_BONUS_TARGET} misiones de la semana para reclamar este pack.`)
  }
  if (kind === 'weekly_clear' && weeklyCount < WEEKLY_MISSION_SLOT_COUNT) {
    throw new Error(`Completa las ${WEEKLY_MISSION_SLOT_COUNT} misiones de la semana para reclamar este pack.`)
  }
  if (kind === 'monthly_clear' && monthlyCount < MONTHLY_MISSION_SLOT_COUNT) {
    throw new Error(`Completa las ${MONTHLY_MISSION_SLOT_COUNT} misiones del mes para reclamar este pack.`)
  }

  const grantKey = seasonPackGrantKey(kind, weekKey, monthKey)
  if (kind === 'monthly_clear' ? !monthKey : !weekKey) {
    throw new Error('Aún no hay un periodo activo para reclamar.')
  }

  const grantedKeys = stringArray(state.grantedItemKeys)
  if (grantedKeys.includes(grantKey)) {
    throw new Error('Ya has reclamado este pack.')
  }

  const grants = rewardsForSeasonPack(kind, weekKey, monthKey)
  const inventory = numberRecord(state.inventory)
  addGrants(inventory, grants)
  grantedKeys.push(grantKey)

  return {
    state: {
      ...state,
      inventory,
      grantedItemKeys: compactGrantKeys(grantedKeys),
    },
    grants,
  }
}

export function spendBandFromPromotionData(data: Record<string, unknown>): 0 | 15 | 40 {
  return spendBandFromMinimumCents(
    typeof data.minimumSpendCents === 'number' ? data.minimumSpendCents : null,
    data.minimumSpendEnabled === true,
  )
}

export function promoMinimumFromPromotionData(data: Record<string, unknown>): number {
  return promoMinimumCents(
    typeof data.minimumSpendCents === 'number' ? data.minimumSpendCents : null,
    data.minimumSpendEnabled === true,
  )
}

export function parsePendingTokenSpend(value: unknown): PendingTokenSpend[] {
  if (!Array.isArray(value)) {
    return []
  }

  const next: PendingTokenSpend[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue
    }
    const row = entry as Record<string, unknown>
    const remainderCents = Math.trunc(numberValue(row.remainderCents))
    const visits = Math.trunc(numberValue(row.visits))
    const companyId = typeof row.companyId === 'string' ? row.companyId.trim() : ''
    const itemId = typeof row.itemId === 'string' ? row.itemId.trim() : ''
    if (!companyId || !itemId || visits < 1 || remainderCents < 1) {
      continue
    }
    next.push({
      id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : `${companyId}-${next.length}`,
      companyId,
      itemId,
      visits,
      coverCents: Math.max(0, Math.trunc(numberValue(row.coverCents))),
      remainderCents,
      requiredCents: Math.max(remainderCents, Math.trunc(numberValue(row.requiredCents))),
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
    })
  }
  return next.slice(0, MAX_PENDING_TOKEN_SPEND)
}

export function findPendingTokenSpend(
  state: Record<string, unknown>,
  companyId: string,
): PendingTokenSpend | null {
  return parsePendingTokenSpend(state.pendingTokenSpend).find((entry) => entry.companyId === companyId) ?? null
}

export function settlePendingTokenSpend(
  state: Record<string, unknown>,
  companyId: string,
  verifiedCents: number,
  reservationMinCents: number,
): { state: Record<string, unknown>; settled: PendingTokenSpend | null; reservationEligible: boolean } {
  const pending = parsePendingTokenSpend(state.pendingTokenSpend)
  const index = pending.findIndex((entry) => entry.companyId === companyId)
  const first = index >= 0 ? pending[index] : null

  if (!first || verifiedCents < first.remainderCents) {
    return {
      state,
      settled: null,
      reservationEligible: verifiedCents >= reservationMinCents,
    }
  }

  const credits = numberRecord(state.tokenCreditsByCompany)
  credits[companyId] = (credits[companyId] ?? 0) + first.visits
  const nextPending = pending.filter((_, current) => current !== index)

  return {
    state: {
      ...state,
      tokenCreditsByCompany: credits,
      pendingTokenSpend: nextPending,
    },
    settled: first,
    reservationEligible:
      verifiedCents >= reservationMinCents
      || verifiedCents + first.coverCents >= reservationMinCents,
  }
}

const PROMO_LOCK_STRIKES = 5

export interface UseInventoryResult {
  state: Record<string, unknown>
  xpGained: number
  adelinasGained: number
  message: string
}

export function useInventoryConsumable(
  state: Record<string, unknown>,
  itemId: string,
): UseInventoryResult {
  const item = getInventoryItem(itemId)
  if (!item || item.usable === false) {
    throw new Error('Este ítem no se puede usar.')
  }

  const xp = numberValue(state.xp)
  const strikes = Math.max(0, Math.trunc(numberValue(state.cancellationStrikeCount)))

  if (item.kind === 'pardon' && strikes < 1) {
    throw new Error('No tienes avisos de cancelación.')
  }

  if (item.kind === 'unlock' && strikes < PROMO_LOCK_STRIKES && state.promoLocked !== true) {
    throw new Error('No tienes las promociones bloqueadas.')
  }

  if (
    item.kind !== 'xp'
    && item.kind !== 'relic'
    && item.kind !== 'pardon'
    && item.kind !== 'unlock'
  ) {
    throw new Error('Este ítem se usa en otro sitio: Promos, al reservar o al publicar una reseña.')
  }

  const consumed = consumeInventoryItem(state, itemId, 1)

  if (item.kind === 'xp' || item.kind === 'relic') {
    const xpGained = Math.max(0, Math.min(MAX_USE_XP, Math.trunc(item.xpValue ?? 0)))
    return {
      state: {
        ...consumed,
        xp: xp + xpGained,
      },
      xpGained,
      adelinasGained: 0,
      message: xpGained > 0
        ? `Has abierto ${itemId.replaceAll('_', ' ')} y sumas ${xpGained} XP.`
        : 'No ha pasado nada. Era papel mojado.',
    }
  }

  if (item.kind === 'pardon') {
    const nextStrikes = Math.max(0, strikes - 1)
    const promoLocked = nextStrikes >= PROMO_LOCK_STRIKES
    return {
      state: {
        ...consumed,
        cancellationStrikeCount: nextStrikes,
        promoLocked,
      },
      xpGained: 0,
      adelinasGained: 0,
      message: promoLocked
        ? `Has quitado un aviso. Te quedan ${nextStrikes}. Sigue bloqueado hasta bajar de ${PROMO_LOCK_STRIKES}.`
        : nextStrikes === 0
          ? 'Has quitado el último aviso de cancelación.'
          : `Has quitado un aviso. Te quedan ${nextStrikes}.`,
    }
  }

  if (item.kind === 'unlock') {
    const nextStrikes = Math.min(strikes, PROMO_LOCK_STRIKES - 1)
    return {
      state: {
        ...consumed,
        cancellationStrikeCount: nextStrikes,
        promoLocked: false,
      },
      xpGained: 0,
      adelinasGained: 0,
      message: 'Has recuperado las reservas con oferta y el canje de promociones.',
    }
  }

  throw new Error('Este ítem se usa en otro sitio: Promos, al reservar o al publicar una reseña.')
}

export function applyReviewBoostIfOwned(state: Record<string, unknown>, itemId: string): {
  state: Record<string, unknown>
  xpGained: number
  adelinasGained: number
} {
  const item = getInventoryItem(itemId)
  if (!item || item.kind !== 'review_boost' || inventoryQty(state, itemId) < 1) {
    return { state, xpGained: 0, adelinasGained: 0 }
  }

  const consumed = consumeInventoryItem(state, itemId, 1)
  return {
    state: consumed,
    xpGained: REVIEW_BOOST_XP,
    adelinasGained: REVIEW_BOOST_ADELINAS,
  }
}


import type { InventoryGrant } from '../data/inventoryItems'

const STORAGE_PREFIX = 'adelia-item-receive-receipts'

export interface ItemReceivePlay {
  id: string
  itemId: string
  grantKey: string
}

export interface ItemReceiveReceipts {
  bootstrapped: boolean
  celebratedGrantKeys: string[]
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`
}

function uniqueKeys(keys: string[]): string[] {
  return [...new Set(keys.filter((key) => typeof key === 'string' && key.length > 0))]
}

export function emptyItemReceiveReceipts(): ItemReceiveReceipts {
  return {
    bootstrapped: false,
    celebratedGrantKeys: [],
  }
}

export function readItemReceiveReceipts(userId: string): ItemReceiveReceipts {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) {
      return emptyItemReceiveReceipts()
    }
    const parsed = JSON.parse(raw) as Partial<ItemReceiveReceipts>
    return {
      bootstrapped: parsed.bootstrapped === true,
      celebratedGrantKeys: uniqueKeys(parsed.celebratedGrantKeys ?? []),
    }
  } catch {
    return emptyItemReceiveReceipts()
  }
}

export function writeItemReceiveReceipts(userId: string, receipts: ItemReceiveReceipts): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify({
      bootstrapped: receipts.bootstrapped === true,
      celebratedGrantKeys: uniqueKeys(receipts.celebratedGrantKeys).slice(-4000),
    }))
  } catch {
    // Ignore quota / private mode.
  }
}

export function markItemGrantKeysCelebrated(userId: string, keys: string[]): ItemReceiveReceipts {
  const current = readItemReceiveReceipts(userId)
  const next: ItemReceiveReceipts = {
    bootstrapped: true,
    celebratedGrantKeys: uniqueKeys([...current.celebratedGrantKeys, ...keys]),
  }
  writeItemReceiveReceipts(userId, next)
  return next
}

export function bootstrapItemReceiveReceipts(
  userId: string,
  grantedItemKeys: string[],
): ItemReceiveReceipts {
  const next: ItemReceiveReceipts = {
    bootstrapped: true,
    celebratedGrantKeys: uniqueKeys(grantedItemKeys),
  }
  writeItemReceiveReceipts(userId, next)
  return next
}

/** Expande grants a una animación por carta (quantity 2 → 2 plays). */
export function expandGrantsToPlays(
  grants: InventoryGrant[],
  grantKey: string,
): ItemReceivePlay[] {
  const plays: ItemReceivePlay[] = []
  let index = 0
  for (const grant of grants) {
    const quantity = Math.max(0, Math.trunc(grant.quantity))
    for (let i = 0; i < quantity; i += 1) {
      plays.push({
        id: `${grantKey}:${grant.itemId}:${index}`,
        itemId: grant.itemId,
        grantKey,
      })
      index += 1
    }
  }
  return plays
}

export function expandKeyedGrantsToPlays(
  entries: Array<{ grantKey: string; grants: InventoryGrant[] }>,
): ItemReceivePlay[] {
  return entries.flatMap((entry) => expandGrantsToPlays(entry.grants, entry.grantKey))
}

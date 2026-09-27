import { useCallback, useEffect, useRef, useState } from 'react'
import type { InventoryGrant } from '../data/inventoryItems'
import { getInventoryItem } from '../data/inventoryItems'
import {
  bootstrapItemReceiveReceipts,
  expandGrantsToPlays,
  markItemGrantKeysCelebrated,
  readItemReceiveReceipts,
  type ItemReceivePlay,
} from '../utils/itemReceiveCelebration'

interface UseItemReceiveCelebrationOptions {
  userId?: string
  enabled: boolean
  ready: boolean
  /** Pausa la cola (p. ej. mientras hay level-up). */
  paused?: boolean
  grantedItemKeys: string[]
}

function validGrants(grants: InventoryGrant[]): InventoryGrant[] {
  return grants.filter((grant) => (
    Boolean(getInventoryItem(grant.itemId))
    && Number.isFinite(grant.quantity)
    && grant.quantity > 0
  ))
}

export function useItemReceiveCelebration({
  userId,
  enabled,
  ready,
  paused = false,
  grantedItemKeys,
}: UseItemReceiveCelebrationOptions) {
  const [queue, setQueue] = useState<ItemReceivePlay[]>([])
  const [activePlay, setActivePlay] = useState<ItemReceivePlay | null>(null)
  const primedUserRef = useRef<string | null>(null)
  const seenKeysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) {
      primedUserRef.current = null
      seenKeysRef.current = new Set()
      setQueue([])
      setActivePlay(null)
      return
    }

    if (!enabled || !ready) {
      return
    }

    if (primedUserRef.current === userId) {
      return
    }

    primedUserRef.current = userId
    const receipts = readItemReceiveReceipts(userId)
    const baseline = receipts.bootstrapped
      ? receipts.celebratedGrantKeys
      : bootstrapItemReceiveReceipts(userId, grantedItemKeys).celebratedGrantKeys
    seenKeysRef.current = new Set(baseline)
    setQueue([])
    setActivePlay(null)
  }, [enabled, grantedItemKeys, ready, userId])

  useEffect(() => {
    if (paused || activePlay || queue.length === 0) {
      return
    }
    const [next, ...rest] = queue
    setActivePlay(next)
    setQueue(rest)
  }, [activePlay, paused, queue])

  const enqueueGrants = useCallback((
    grants: InventoryGrant[],
    grantKey: string,
  ) => {
    if (!userId || !grantKey) {
      return
    }

    const clean = validGrants(grants)
    if (clean.length === 0) {
      markItemGrantKeysCelebrated(userId, [grantKey])
      seenKeysRef.current.add(grantKey)
      return
    }

    if (seenKeysRef.current.has(grantKey)) {
      return
    }

    seenKeysRef.current.add(grantKey)
    markItemGrantKeysCelebrated(userId, [grantKey])
    setQueue((current) => [...current, ...expandGrantsToPlays(clean, grantKey)])
  }, [userId])

  const enqueueGrantBatch = useCallback((
    entries: Array<{ grantKey: string; grants: InventoryGrant[] }>,
  ) => {
    for (const entry of entries) {
      enqueueGrants(entry.grants, entry.grantKey)
    }
  }, [enqueueGrants])

  const dismissActive = useCallback(() => {
    setActivePlay(null)
  }, [])

  return {
    activePlay,
    dismissActive,
    enqueueGrants,
    enqueueGrantBatch,
    hasItemReceiveCelebration: Boolean(activePlay),
  }
}

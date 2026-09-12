import { Router, type Request, type Response } from 'express'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'

const router = Router()

const RAW_EVENT_TTL_MS = 120 * 24 * 60 * 60 * 1000
const MAX_EVENTS_PER_BATCH = 25
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/

function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function monthKey(dayKey: string): string {
  return dayKey.slice(0, 7)
}

/**
 * Cada tipo de evento indica qué contadores sube en el doc mensual del
 * restaurante (`companies/{id}/metrics/{yyyy-mm}`). `__DAY__` se sustituye por
 * la fecha ISO del evento para la serie diaria del informe.
 */
const EVENT_INCREMENTS: Record<string, (entityId: string) => string[]> = {
  restaurant_view: () => ['views.profile', 'daily.__DAY__.views'],
  menu_zone_view: () => ['views.menuZone'],
  menu_board_view: (id) => ['views.menuBoardOpens', ...(id ? [`menuBoards.${id}`] : [])],
  promo_zone_view: () => ['views.promoZone', 'daily.__DAY__.promoViews'],
  promo_view: (id) => ['promo.views', ...(id ? [`promos.${id}.views`] : [])],
  promo_claim: (id) => ['promo.claims', 'daily.__DAY__.claims', ...(id ? [`promos.${id}.claims`] : [])],
  promo_reserve_click: (id) => ['promo.reserveClicks', ...(id ? [`promos.${id}.reserveClicks`] : [])],
  search_impression: () => ['search.impressions'],
  search_click: () => ['search.clicks'],
  favorite_add: () => ['favorites.add'],
  favorite_remove: () => ['favorites.remove'],
  reservation_from_promo: (id) => ['reservations.fromPromo', ...(id ? [`promos.${id}.reservations`] : [])],
  reservation_from_profile: () => ['reservations.fromProfile'],
}

const ALLOWED_TYPES = new Set(Object.keys(EVENT_INCREMENTS))

interface ParsedEvent {
  type: string
  companyId: string
  entityId: string
  entityKind: string
  source: string
  day: string
}

function parseEvent(raw: unknown): ParsedEvent | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const value = raw as Record<string, unknown>
  const type = String(value.type ?? '')
  const companyId = String(value.companyId ?? '')
  if (!ALLOWED_TYPES.has(type) || !ID_RE.test(companyId)) {
    return null
  }
  const entityIdRaw = typeof value.entityId === 'string' ? value.entityId : ''
  return {
    type,
    companyId,
    entityId: ID_RE.test(entityIdRaw) ? entityIdRaw : '',
    entityKind: typeof value.entityKind === 'string' ? value.entityKind.slice(0, 32) : '',
    source: typeof value.source === 'string' ? value.source.slice(0, 32) : '',
    day: utcDayKey(),
  }
}

type CounterTree = { [key: string]: number | CounterTree }

/** Suma `amount` al contador en la ruta con puntos `path` (números planos). */
function addCounter(tree: CounterTree, path: string, amount: number): void {
  const parts = path.split('.')
  let node = tree
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]
    const next = node[key]
    if (typeof next !== 'object') {
      node[key] = {}
    }
    node = node[key] as CounterTree
  }
  const leaf = parts[parts.length - 1]
  node[leaf] = (typeof node[leaf] === 'number' ? (node[leaf] as number) : 0) + amount
}

/** Convierte el árbol de números planos en un patch con `FieldValue.increment`. */
function toIncrementPatch(tree: CounterTree): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(tree)) {
    out[key] = typeof value === 'number' ? FieldValue.increment(value) : toIncrementPatch(value)
  }
  return out
}

async function softUid(req: Request): Promise<string | null> {
  try {
    const user = await verifyCustomerUid(req)
    return user.uid
  } catch {
    return null
  }
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>
    const rawList = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS_PER_BATCH) : []
    const anonIdRaw = typeof body.anonId === 'string' ? body.anonId : ''
    const anonId = /^[A-Za-z0-9_-]{8,64}$/.test(anonIdRaw) ? anonIdRaw : ''

    const events = rawList.map(parseEvent).filter((event): event is ParsedEvent => event !== null)
    if (events.length === 0) {
      res.json({ received: true, stored: 0 })
      return
    }

    const uid = await softUid(req)
    const now = FieldValue.serverTimestamp()
    const expireAt = Timestamp.fromMillis(Date.now() + RAW_EVENT_TTL_MS)

    const companyCounters = new Map<string, CounterTree>() // key: `${companyId}/${month}`
    const batch = adminDb.batch()

    for (const event of events) {
      const month = monthKey(event.day)

      batch.set(adminDb.collection('appEvents').doc(), {
        type: event.type,
        companyId: event.companyId,
        entityId: event.entityId || null,
        entityKind: event.entityKind || null,
        source: event.source || null,
        uid,
        anonId: anonId || null,
        day: event.day,
        month,
        ts: now,
        expireAt,
      })

      const patchKey = `${event.companyId}/${month}`
      let counters = companyCounters.get(patchKey)
      if (!counters) {
        counters = {}
        companyCounters.set(patchKey, counters)
      }
      for (const target of EVENT_INCREMENTS[event.type](event.entityId)) {
        addCounter(counters, target.replace('__DAY__', event.day), 1)
      }
    }

    for (const [key, counters] of companyCounters) {
      const [companyId, month] = key.split('/')
      batch.set(
        adminDb.collection('companies').doc(companyId).collection('metrics').doc(month),
        { companyId, month, updatedAt: now, ...toIncrementPatch(counters) },
        { merge: true },
      )
    }

    await batch.commit()
    res.json({ received: true, stored: events.length })
  } catch (error) {
    console.error('App events ingest error:', error)
    res.status(500).json({ error: 'No se pudieron registrar los eventos.' })
  }
})

export default router

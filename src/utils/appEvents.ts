import { getIdToken } from '../services/auth'
import { readCookieConsent } from './cookieConsent'

/**
 * Analítica de uso de la app (first-party). Encola eventos de navegación del
 * cliente y los manda en lote a `/api/public/events`. Solo funciona si el
 * visitante ha aceptado la analítica en el aviso de cookies. Nunca rompe la
 * app: todo error se traga en silencio.
 */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const ENDPOINT = `${API_BASE}/api/public/events`
const FLUSH_INTERVAL_MS = 12_000
const MAX_QUEUE = 15
const MAX_PER_FLUSH = 25
const DEDUPE_MS = 30_000
const ANON_KEY = 'adelia_anon_id'

export type AppEventType =
  | 'restaurant_view'
  | 'menu_zone_view'
  | 'menu_board_view'
  | 'promo_zone_view'
  | 'promo_view'
  | 'promo_claim'
  | 'promo_reserve_click'
  | 'search_impression'
  | 'search_click'
  | 'favorite_add'
  | 'favorite_remove'
  | 'reservation_from_promo'
  | 'reservation_from_profile'

interface TrackOptions {
  companyId: string
  entityId?: string
  entityKind?: string
  source?: string
}

interface QueuedEvent extends TrackOptions {
  type: AppEventType
  ts: number
}

let queue: QueuedEvent[] = []
let timer: ReturnType<typeof setInterval> | null = null
let disabled = false
let unloadHooked = false
const lastSeen = new Map<string, number>()

function anonId(): string {
  try {
    let id = window.localStorage.getItem(ANON_KEY)
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      const raw = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `a${Date.now()}${Math.random().toString(36).slice(2)}`
      id = raw.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
      window.localStorage.setItem(ANON_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

/** Se llama desde el AuthProvider: apaga el tracking en sesiones de empresa/admin. */
export function setAppEventsDisabled(value: boolean): void {
  disabled = value
  if (value) {
    queue = []
  }
}

export function trackAppEvent(type: AppEventType, options: TrackOptions): void {
  if (disabled || typeof window === 'undefined' || !options.companyId) {
    return
  }
  if (readCookieConsent()?.analytics !== true) {
    queue = []
    return
  }
  const key = `${type}:${options.companyId}:${options.entityId ?? ''}`
  const now = Date.now()
  if (now - (lastSeen.get(key) ?? 0) < DEDUPE_MS) {
    return
  }
  lastSeen.set(key, now)

  queue.push({
    type,
    ts: now,
    companyId: options.companyId,
    entityId: options.entityId,
    entityKind: options.entityKind,
    source: options.source,
  })

  if (queue.length >= MAX_QUEUE) {
    void flush()
    return
  }
  ensureTimer()
  ensureUnloadHook()
}

function ensureTimer(): void {
  if (timer) {
    return
  }
  timer = setInterval(() => {
    void flush()
  }, FLUSH_INTERVAL_MS)
}

function ensureUnloadHook(): void {
  if (unloadHooked) {
    return
  }
  unloadHooked = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flush(true)
    }
  })
  window.addEventListener('pagehide', () => {
    void flush(true)
  })
}

async function flush(useBeacon = false): Promise<void> {
  if (queue.length === 0) {
    return
  }
  const events = queue.splice(0, MAX_PER_FLUSH)
  const payload = JSON.stringify({ anonId: anonId(), events })

  try {
    if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }))
      return
    }
    const token = await getIdToken().catch(() => null)
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: payload,
      keepalive: true,
    })
  } catch {
    // La analítica nunca rompe la app.
  }
}

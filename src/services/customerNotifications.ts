import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../config/firebase'
import { getIdToken } from './auth'
import type { CustomerNotification } from '../types/notifications'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

function timestampToIso(value: unknown): string | null {
  if (!value) {
    return null
  }
  if (typeof value === 'string' && value.trim()) {
    return value
  }
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      const converted = (value as { toDate: () => Date }).toDate()
      if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
        return converted.toISOString()
      }
    } catch {
      return null
    }
  }
  return null
}

function mapNotification(id: string, data: Record<string, unknown>): CustomerNotification {
  const createdAt = timestampToIso(data.createdAt) ?? new Date().toISOString()
  const readAt = timestampToIso(data.readAt)

  return {
    id,
    type: data.type as CustomerNotification['type'],
    title: String(data.title ?? ''),
    body: String(data.body ?? ''),
    icon: String(data.icon ?? '🔔'),
    read: data.read === true,
    readAt,
    createdAt,
    actionUrl: typeof data.actionUrl === 'string' ? data.actionUrl : null,
    actionLabel: typeof data.actionUrl === 'string' ? String(data.actionLabel ?? '') : null,
    data: (data.data as CustomerNotification['data']) ?? {},
    dedupeKey: String(data.dedupeKey ?? id),
  }
}

const notificationListeners = new Map<string, {
  count: number
  unsub: () => void
  rows: CustomerNotification[]
  listeners: Set<(rows: CustomerNotification[]) => void>
}>()

export function subscribeCustomerNotifications(
  userId: string,
  onChange: (notifications: CustomerNotification[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const existing = notificationListeners.get(userId)
  if (existing) {
    existing.count += 1
    existing.listeners.add(onChange)
    onChange(existing.rows)
    return () => {
      existing.listeners.delete(onChange)
      existing.count -= 1
      if (existing.count <= 0) {
        existing.unsub()
        notificationListeners.delete(userId)
      }
    }
  }

  const listeners = new Set<(rows: CustomerNotification[]) => void>([onChange])
  const notificationsQuery = query(
    collection(db, 'users', userId, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(50),
  )

  const entry = {
    count: 1,
    rows: [] as CustomerNotification[],
    listeners,
    unsub: onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const current = notificationListeners.get(userId)
        if (!current) {
          return
        }
        current.rows = snapshot.docs.map((docSnap) => mapNotification(docSnap.id, docSnap.data() as Record<string, unknown>))
        for (const listener of current.listeners) {
          listener(current.rows)
        }
      },
      (error) => {
        onError?.(error)
      },
    ),
  }

  notificationListeners.set(userId, entry)

  return () => {
    const current = notificationListeners.get(userId)
    if (!current) {
      return
    }
    current.listeners.delete(onChange)
    current.count -= 1
    if (current.count <= 0) {
      current.unsub()
      notificationListeners.delete(userId)
    }
  }
}

export async function fetchCustomerNotifications(): Promise<{
  notifications: CustomerNotification[]
  unreadCount: number
}> {
  const token = await getIdToken()
  if (!token) {
    throw new Error('Debes iniciar sesión.')
  }

  const response = await fetch(`${API_BASE}/api/customer/notifications?limit=50`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('No se pudieron cargar las notificaciones.')
  }

  return response.json() as Promise<{ notifications: CustomerNotification[]; unreadCount: number }>
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const token = await getIdToken()
  if (!token) {
    return
  }

  await fetch(`${API_BASE}/api/customer/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function markAllNotificationsRead(): Promise<void> {
  const token = await getIdToken()
  if (!token) {
    return
  }

  await fetch(`${API_BASE}/api/customer/notifications/read-all`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function syncGamificationNotifications(
  beforeGamification: Record<string, unknown>,
): Promise<void> {
  const token = await getIdToken()
  if (!token) {
    return
  }

  await fetch(`${API_BASE}/api/customer/notifications/gamification-sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ beforeGamification }),
  }).catch(() => undefined)
}

export async function sendFriendRequest(targetUid: string): Promise<void> {
  const token = await getIdToken()
  if (!token) {
    throw new Error('Debes iniciar sesión.')
  }

  const response = await fetch(`${API_BASE}/api/customer/friends/requests/${encodeURIComponent(targetUid)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? 'No se pudo enviar la solicitud.')
  }
}

export async function acceptFriendRequest(fromUid: string): Promise<void> {
  const token = await getIdToken()
  if (!token) {
    throw new Error('Debes iniciar sesión.')
  }

  const response = await fetch(`${API_BASE}/api/customer/friends/requests/${encodeURIComponent(fromUid)}/accept`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? 'No se pudo aceptar la solicitud.')
  }
}

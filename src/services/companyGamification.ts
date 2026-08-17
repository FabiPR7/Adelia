import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../config/firebase'
import { getIdToken } from './auth'
import type { CompanyNotification } from '../types/companyNotifications'
import type { CompanyGamificationState, CompanyRankingEntry } from '../types/companyGamification'
import type { GamificationLevel } from '../types/gamification'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function companyApi<T>(path: string, method: 'GET' | 'POST' = 'GET'): Promise<T> {
  const token = await getIdToken()
  if (!token) {
    throw new Error('Debes iniciar sesión como restaurante.')
  }
  const response = await fetch(`${API_BASE}/api/company${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const data = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo completar la acción.')
  }
  return data
}

function mapNotification(id: string, data: Record<string, unknown>): CompanyNotification {
  const createdAt = data.createdAt && typeof data.createdAt === 'object' && 'toDate' in data.createdAt
    ? (data.createdAt as { toDate: () => Date }).toDate().toISOString()
    : typeof data.createdAt === 'string'
      ? data.createdAt
      : new Date().toISOString()
  const readAt = data.readAt && typeof data.readAt === 'object' && 'toDate' in data.readAt
    ? (data.readAt as { toDate: () => Date }).toDate().toISOString()
    : typeof data.readAt === 'string'
      ? data.readAt
      : null

  return {
    id,
    type: data.type as CompanyNotification['type'],
    title: String(data.title ?? ''),
    body: String(data.body ?? ''),
    icon: String(data.icon ?? '🔔'),
    read: data.read === true,
    readAt,
    createdAt,
    actionTab: typeof data.actionTab === 'string' ? data.actionTab : 'compite-missions',
    actionLabel: typeof data.actionLabel === 'string' ? data.actionLabel : null,
    data: (data.data as Record<string, unknown>) ?? {},
    dedupeKey: String(data.dedupeKey ?? id),
  }
}

export function subscribeCompanyNotifications(
  companyId: string,
  onChange: (notifications: CompanyNotification[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const notificationsQuery = query(
    collection(db, 'companies', companyId, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(50),
  )

  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      onChange(snapshot.docs.map((docSnap) => mapNotification(docSnap.id, docSnap.data() as Record<string, unknown>)))
    },
    (error) => {
      onError?.(error)
    },
  )
}

export async function fetchCompanyNotifications(): Promise<{
  notifications: CompanyNotification[]
  unreadCount: number
}> {
  return companyApi('/notifications')
}

export async function markCompanyNotificationRead(notificationId: string): Promise<void> {
  await companyApi(`/notifications/${encodeURIComponent(notificationId)}/read`, 'POST')
}

export async function markAllCompanyNotificationsRead(): Promise<void> {
  await companyApi('/notifications/read-all', 'POST')
}

export async function syncCompanyGamification(): Promise<{
  state: CompanyGamificationState
  level: GamificationLevel
  xpToNext: number | null
}> {
  return companyApi('/gamification/sync', 'POST')
}

export function pingCompanyGamification(): void {
  void syncCompanyGamification().catch(() => undefined)
}

export async function fetchCompanyRanking(): Promise<{
  local: CompanyRankingEntry[]
  world: CompanyRankingEntry[]
  localRank: number
  worldRank: number
  municipality: string
  country: string
  needsIndex?: boolean
}> {
  return companyApi('/gamification/ranking')
}

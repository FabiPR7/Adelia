import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../config/firebase'
import { getIdToken } from './auth'
import type { CompanyNotification } from '../types/companyNotifications'
import type { CompanyGamificationState, CompanyRankingEntry } from '../types/companyGamification'
import type { GamificationLevel } from '../types/gamification'
import {
  getDemoGamificationSync,
  getDemoNotifications,
  getDemoRanking,
  isCompanyDemoSession,
  isDemoCompanyId,
} from '../data/companyPanelDemo'

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
  if (isDemoCompanyId(companyId) || isCompanyDemoSession()) {
    onChange(getDemoNotifications())
    return () => undefined
  }

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
  if (isCompanyDemoSession()) {
    const notifications = getDemoNotifications()
    return {
      notifications,
      unreadCount: notifications.filter((item) => !item.read).length,
    }
  }
  return companyApi('/notifications')
}

export async function markCompanyNotificationRead(notificationId: string): Promise<void> {
  if (isCompanyDemoSession()) {
    return
  }
  await companyApi(`/notifications/${encodeURIComponent(notificationId)}/read`, 'POST')
}

export async function markAllCompanyNotificationsRead(): Promise<void> {
  if (isCompanyDemoSession()) {
    return
  }
  await companyApi('/notifications/read-all', 'POST')
}

export async function syncCompanyGamification(): Promise<{
  state: CompanyGamificationState
  level: GamificationLevel
  xpToNext: number | null
}> {
  if (isCompanyDemoSession()) {
    return getDemoGamificationSync()
  }
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
  if (isCompanyDemoSession()) {
    return getDemoRanking()
  }
  return companyApi('/gamification/ranking')
}

/* ── Liga Adelia (clasificaciones del mes) ───────────────────────────── */

export type LeagueId = 'reservations' | 'promotions' | 'rating' | 'rising'

export interface LeagueRow {
  companyId: string
  name: string
  slug: string
  municipality: string
  photoUrl: string
  level: number
  levelTitle: string
  rank: number
  score: number
  display: string
  isMe: boolean
}

export interface LeagueBoardView {
  id: LeagueId
  name: string
  rule: string
  unit: string
  total: number
  top: LeagueRow[]
  me: { rank: number; display: string; score: number } | null
  ahead: { name: string; rank: number; gap: number } | null
}

export interface CompanyLeagueView {
  month: string
  currentMonth: string
  city: { name: string; boards: LeagueBoardView[] | null } | null
  spain: { boards: LeagueBoardView[] | null }
  level: { level: number; title: string; xp: number; prestige: { id: 'bronze' | 'silver' | 'gold' | 'diamond'; label: string } }
  trophies: Array<{ month: string; league: LeagueId; rank: number; scope: 'city' | 'spain' }>
}

function demoLeague(): CompanyLeagueView {
  const row = (rank: number, name: string, display: string, level: number, isMe = false): LeagueRow => ({
    companyId: name, name, slug: '', municipality: 'Madrid', photoUrl: '', level, levelTitle: '', rank, score: Number(display) || 0, display, isMe,
  })
  const board = (id: LeagueId, name: string, unit: string, rule: string, rows: LeagueRow[], meRank: number): LeagueBoardView => ({
    id, name, unit, rule, total: rows.length, top: rows,
    me: { rank: meRank, display: rows[meRank - 1]?.display ?? '', score: 0 },
    ahead: meRank > 1 ? { name: rows[meRank - 2].name, rank: meRank - 1, gap: 6 } : null,
  })
  const boards = [
    board('reservations', 'Más reservas', 'asistencias', 'Reservas marcadas como «asistió» este mes', [row(1, 'Sushi Ginza', '100', 7), row(2, 'Tu restaurante', '94', 6, true), row(3, 'Megami Ramen', '88', 5)], 2),
    board('promotions', 'Más promos', 'premios', 'Premios canjeados con PIN este mes', [row(1, 'Open Café', '31', 5), row(2, 'Logic', '25', 3), row(3, 'Tu restaurante', '18', 6, true)], 3),
    board('rating', 'Mejor valorado', 'puntos', 'Media de las reseñas del mes por cuántas hay (mínimo 5)', [row(1, 'La Cumbre', '4,8 ★ · 21', 9), row(2, 'Tu restaurante', '4,6 ★ · 12', 6, true)], 2),
    board('rising', 'Revelación', 'asistencias', 'Lo que más crece frente al mes anterior, o el mejor local nuevo', [row(1, 'Wok Premium', '+240 %', 2)], 0),
  ]
  boards[3].me = null
  return {
    month: '2026-11', currentMonth: '2026-11',
    city: { name: 'Madrid', boards }, spain: { boards },
    level: { level: 6, title: 'Estrella de la Villa', xp: 3926, prestige: { id: 'silver', label: 'Plata' } },
    trophies: [{ month: '2026-10', league: 'reservations', rank: 1, scope: 'city' }],
  }
}

export async function fetchCompanyLeague(month?: string): Promise<CompanyLeagueView> {
  if (isCompanyDemoSession()) {
    return demoLeague()
  }
  return companyApi(`/league${month ? `?month=${encodeURIComponent(month)}` : ''}`)
}

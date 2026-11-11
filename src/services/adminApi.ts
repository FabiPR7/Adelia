import { getIdToken } from './auth'

/** Llamadas al servidor del panel de administración (`/api/admin/*`). */
const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function request<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
  const token = await getIdToken()
  if (!token) {
    throw new Error('Tu sesión ha caducado. Vuelve a entrar.')
  }
  const response = await fetch(`${API_BASE}/api/admin${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (response.status === 204) {
    return undefined as T
  }
  const data = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo completar la acción.')
  }
  return data
}

export interface AdminDayStats {
  day: string
  reservations: number
  pax: number
  confirmed: number
  completed: number
  cancelled: number
  fromCustomers: number
  withPromotion: number
  newCustomers: number
  newCompanies: number
  byHour: number[]
  weekday: number
  topCompanies: Record<string, number>
}

export interface AdminPlanStats {
  planId: string
  name: string
  total: number
  monthly: number
  annual: number
  perpetual: number
  mrr: number
}

export interface AdminStats {
  generatedAt: string
  totals: {
    customers: number
    blockedCustomers: number
    phoneVerified: number
    companies: number
    activeCompanies: number
    deactivatedCompanies: number
    featuredCompanies: number
    paidCompanies: number
    subscriptionsPending: number
    reservations: number
    confirmed: number
    completed: number
    cancelled: number
    upcoming: number
    promotionClaims: number
    reviews: number
  }
  revenue: { mrr: number; perpetual: number; conversion: number }
  plans: AdminPlanStats[]
  series: AdminDayStats[]
  topCompanies: Array<{ id: string; name: string; municipality: string; planId: string; reservations: number }>
}

export interface AdminCustomerDetail {
  uid: string
  displayName: string
  email: string
  loginName: string
  phone: string
  phoneVerified: boolean
  blocked: boolean
  municipality: string
  createdAt: string | null
  onboardingCompleted: boolean
  xp: number
  level: number | null
  adelinas: number
  cancellationStrikes: number
  inventory: Array<{ itemId: string; quantity: number }>
  reservations: Array<{ id: string; companyId: string; status: string; pax: number; startTime: string | null; createdAt: string | null }>
}

export interface AdminCompanySummary {
  id: string
  reservations: { total: number; confirmed: number; completed: number; cancelled: number; upcoming: number }
  promotionClaims: number
  reviews: { count: number; average: number | null }
  billing: {
    planId: string
    planBilling: string | null
    planStartedAt: string | null
    planLastPaidAt: string | null
    pendingPlanId: string | null
    lemonSubscriptionId: string | null
    lemonPortalUrl: string | null
    lemonPending: boolean
  }
  slug: string
  deactivated: boolean
  recent: Array<{ id: string; clientName: string; pax: number; status: string; startTime: string | null }>
}

export interface AdminAuditEntry {
  id: string
  action: string
  target: string
  detail: Record<string, unknown>
  createdAt: string | null
}

export type BroadcastTarget = 'customer' | 'company' | 'allCustomers' | 'allCompanies'

export const adminApi = {
  stats: (days: number) => request<AdminStats>(`/stats?days=${days}`),
  customer: (uid: string) => request<AdminCustomerDetail>(`/customers/${encodeURIComponent(uid)}`),
  adjustCustomer: (uid: string, body: {
    xpDelta?: number
    adelinasDelta?: number
    items?: Array<{ itemId: string; quantity: number }>
    reason: string
  }) => request<{ ok: true; xp: number; adelinas: number }>(`/customers/${encodeURIComponent(uid)}/adjust`, 'POST', body),
  blockCustomer: (uid: string, blocked: boolean, reason = '') =>
    request<{ ok: true; blocked: boolean }>(`/customers/${encodeURIComponent(uid)}/block`, 'POST', { blocked, reason }),
  companySummary: (id: string) => request<AdminCompanySummary>(`/companies/${encodeURIComponent(id)}/summary`),
  setCompanyActive: (id: string, active: boolean, reason = '') =>
    request<{ ok: true; deactivated: boolean }>(`/companies/${encodeURIComponent(id)}/status`, 'POST', { deactivated: !active, reason }),
  notify: (body: { target: BroadcastTarget; id?: string; title: string; body: string; actionUrl?: string }) =>
    request<{ ok: true; sent: number; capped: boolean }>('/notify', 'POST', body),
  audit: (limit = 80) => request<{ entries: AdminAuditEntry[] }>(`/audit?limit=${limit}`),
  logChange: (action: string, target: string, detail: Record<string, unknown> = {}) =>
    request<void>('/audit', 'POST', { action, target, detail }).catch(() => undefined),
}

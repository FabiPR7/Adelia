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

export interface AdminAnalyticsBucket {
  key: string
  reservations: number
  cancelled: number
  noShows: number
  pax: number
  newCustomers: number
  newCompanies: number
  revenueCents: number
  claims: number
}

export interface AdminInvoiceRow {
  id: string
  paidAt: string | null
  companyId: string
  companyName: string
  customerEmail: string
  planId: string
  kind: string
  status: string
  currency: string
  totalCents: number
  taxCents: number
  refundedCents: number
  netCents: number
  invoiceUrl: string
  testMode: boolean
}

export interface AdminAnalytics {
  generatedAt: string
  range: { from: string; to: string; days: number; granularity: 'day' | 'month' }
  previous: { from: string; to: string }
  includeTest: boolean
  truncated: boolean
  kpis: {
    revenueNetCents: number
    revenueGrossCents: number
    taxCents: number
    refundsCents: number
    invoices: number
    failedPayments: number
    avgTicketCents: number
    newCustomers: number
    newCompanies: number
    reservations: number
    pax: number
    attended: number
    pending: number
    cancelledByClient: number
    cancelledByRestaurant: number
    noShows: number
    withPromotion: number
    withAccount: number
    claims: number
    reviews: number
    avgRating: number | null
    prev: { revenueNetCents: number; newCustomers: number; reservations: number }
  }
  series: AdminAnalyticsBucket[]
  byHour: number[]
  byWeekday: number[]
  revenueByMonth: Array<{ month: string; invoices: number; grossCents: number; taxCents: number; refundsCents: number; netCents: number }>
  revenueByPlan: Array<{ planId: string; invoices: number; netCents: number }>
  invoices: AdminInvoiceRow[]
  topCompanies: Array<{
    id: string; name: string; municipality: string; planId: string
    reservations: number; pax: number; cancelled: number; noShows: number; attended: number
    claims: number; reviews: number; avgRating: number | null; revenueCents: number
  }>
  reservationsByCity: Array<{ city: string; reservations: number; pax: number }>
  newCustomersByCountry: Array<{ name: string; count: number }>
  newCustomersByCity: Array<{ name: string; count: number }>
}

export interface AdminGeography {
  generatedAt: string
  totalCustomers: number
  totalCompanies: number
  customersByCountry: Array<{ country: string; customers: number; cities: Array<{ city: string; customers: number }> }>
  companiesByCity: Array<{ city: string; companies: number; paid: number; active: number; country: string }>
}

export const adminApi = {
  stats: (days: number) => request<AdminStats>(`/stats?days=${days}`),
  analytics: (from: string, to: string, includeTest = false) =>
    request<AdminAnalytics>(`/analytics?from=${from}&to=${to}${includeTest ? '&test=1' : ''}`),
  geography: () => request<AdminGeography>('/geography'),
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

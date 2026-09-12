import { getIdToken } from './auth'
import type { CompanyPlanId } from '../data/companyPlans'
import {
  getDemoBillingStatus,
  isCompanyDemoSession,
  rejectIfDemoCompanyWrite,
} from '../data/companyPanelDemo'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface CompanyBillingStatus {
  configured: boolean
  planId: CompanyPlanId
  pendingPlanId: CompanyPlanId | null
  pendingPlanAt: string | null
  currentPeriodEnd: string | null
  hasSubscription: boolean
  planBilling: 'monthly' | 'perpetual' | null
  paymentState?: 'past_due' | 'unpaid' | null
  paymentFailedAt?: string | null
  /** Portal de Lemon Squeezy (cambiar plan, tarjeta, cancelar). */
  portalUrl?: string | null
}

export interface CompanyPlanChangeResult {
  action: 'unchanged' | 'checkout' | 'upgraded' | 'scheduled' | 'canceled_at_period_end'
  url?: string
  testMode?: boolean
  chargeNowCents?: number
  periodEnd?: string
  planId: CompanyPlanId
  pendingPlanId: CompanyPlanId | null
}

async function companyBillingFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getIdToken()
  if (!token) {
    throw new Error('Debes iniciar sesión como restaurante.')
  }

  const response = await fetch(`${API_BASE}/api/company${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) {
    throw new Error(payload.error ?? 'No se pudo completar la operación.')
  }
  return payload
}

export async function fetchCompanyBillingStatus(): Promise<CompanyBillingStatus> {
  if (isCompanyDemoSession()) {
    return getDemoBillingStatus()
  }
  return companyBillingFetch<CompanyBillingStatus>('/billing/status')
}

export async function changeCompanyPlan(planId: CompanyPlanId): Promise<CompanyPlanChangeResult> {
  rejectIfDemoCompanyWrite()
  return companyBillingFetch<CompanyPlanChangeResult>('/billing/change', {
    method: 'POST',
    body: JSON.stringify({ planId }),
  })
}

export async function cancelPendingCompanyPlanChange(): Promise<{ planId: CompanyPlanId; pendingPlanId: null }> {
  rejectIfDemoCompanyWrite()
  return companyBillingFetch('/billing/cancel-pending', { method: 'POST' })
}

export async function deleteCompanyAccount(confirmName: string): Promise<void> {
  rejectIfDemoCompanyWrite()
  await companyBillingFetch('/account/delete', {
    method: 'POST',
    body: JSON.stringify({ confirmName }),
  })
}

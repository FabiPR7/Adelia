import { getIdToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface CompanyStripeStatus {
  configured: boolean
  stripeAccountId: string | null
  stripeChargesEnabled: boolean
  stripePayoutsEnabled: boolean
  stripeDetailsSubmitted: boolean
  readyForDeposits: boolean
}

async function companyStripeFetch<T>(
  companyId: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getIdToken()

  if (!token) {
    throw new Error('Debes iniciar sesión como restaurante.')
  }

  const response = await fetch(`${API_BASE}/api/company/${encodeURIComponent(companyId)}/stripe/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string }

  if (!response.ok) {
    throw new Error(payload.error ?? 'No se pudo completar la operación con Stripe.')
  }

  return payload
}

export async function fetchCompanyStripeStatus(companyId: string): Promise<CompanyStripeStatus> {
  return companyStripeFetch<CompanyStripeStatus>(companyId, 'status')
}

export async function startCompanyStripeConnect(companyId: string): Promise<{ url: string } & CompanyStripeStatus> {
  return companyStripeFetch(companyId, 'connect', { method: 'POST' })
}

export async function openCompanyStripeDashboard(companyId: string): Promise<{ url: string }> {
  return companyStripeFetch(companyId, 'dashboard', { method: 'POST' })
}

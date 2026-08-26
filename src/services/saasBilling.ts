const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface SaasBillingStatus {
  configured: boolean
  testMode: boolean
}

export interface SaasCheckoutSession {
  planId: string
  planName: string
  email: string
  phone: string
  restaurantName: string
  city: string
  paid: boolean
  testMode: boolean
  amountLabel: string
  companyId: string
}

export interface CompanySignupResult {
  companyId: string
  slug: string
  loginName: string
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) {
    throw new Error(payload.error ?? 'No se pudo completar el pago.')
  }
  return payload
}

export async function fetchSaasBillingStatus(): Promise<SaasBillingStatus> {
  const response = await fetch(`${API_BASE}/api/public/billing/status`)
  return readJson<SaasBillingStatus>(response)
}

export async function startSaasPlanCheckout(planId: string): Promise<{ url: string; testMode: boolean }> {
  const response = await fetch(`${API_BASE}/api/public/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId }),
  })
  return readJson(response)
}

export async function fetchSaasCheckoutSession(sessionId: string): Promise<SaasCheckoutSession> {
  const response = await fetch(
    `${API_BASE}/api/public/billing/session?session_id=${encodeURIComponent(sessionId)}`,
  )
  return readJson<SaasCheckoutSession>(response)
}

export async function completePaidCompanySignup(input: {
  sessionId: string
  email: string
  phone: string
  password: string
  name: string
  location: string
  website: string
  municipality: string
  postalCode: string
  country: string
  latitude: number | null
  longitude: number | null
  logoUrl: string
  photos: string[]
  characteristics: string[]
  venueTypes: string[]
  amenities: string[]
}): Promise<CompanySignupResult> {
  const response = await fetch(`${API_BASE}/api/public/billing/complete-signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return readJson<CompanySignupResult>(response)
}

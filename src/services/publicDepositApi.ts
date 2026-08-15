const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface PublicDepositIntentResponse {
  required: boolean
  amountCents: number
  depositMinPax?: number | null
  depositPerGuestCents?: number | null
  stripeAccountId?: string
  clientSecret?: string
  paymentIntentId?: string
}

export async function createPublicDepositIntent(
  slug: string,
  pax: number,
): Promise<PublicDepositIntentResponse> {
  const response = await fetch(
    `${API_BASE}/api/public/booking/${encodeURIComponent(slug)}/deposit-intent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pax }),
    },
  )

  const payload = (await response.json().catch(() => ({}))) as PublicDepositIntentResponse & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(payload.error ?? 'No se pudo preparar la fianza.')
  }

  return payload
}

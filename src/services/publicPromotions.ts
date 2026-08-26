import type { PromotionOfferConfig, PromotionProductRef } from '../types/company'
import { getIdToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface PublicPromotion {
  id: string
  companyId: string
  companyName: string
  companySlug: string
  companyPhotoUrl: string
  companyLatitude: number | null
  companyLongitude: number | null
  type: string
  title: string
  description: string
  photoUrl: string
  offer?: PromotionOfferConfig | null
  productRefs?: PromotionProductRef[]
  requiredReservations: number | null
  minimumSpendEnabled?: boolean
  minimumSpendCents?: number | null
  activeFromTime: string
  activeToTime: string
  arrivalWindowMinutes?: number | null
  maxRedemptions: number | null
  currentRedemptions: number
  detail: string
  highlight: string
  reservationMode?: import('../data/companyReservationMode').CompanyReservationMode
}

export async function fetchPublicPromotions(): Promise<PublicPromotion[]> {
  const response = await fetch(`${API_BASE}/api/public/promotions`)

  if (!response.ok) {
    throw new Error('No se pudieron cargar las promociones.')
  }

  const payload = (await response.json()) as { promotions?: PublicPromotion[] }
  return payload.promotions ?? []
}

export async function validatePromotionPin(companyId: string, pin: string): Promise<boolean> {
  const token = await getIdToken()

  if (!token) {
    throw new Error('Inicia sesión para reclamar promociones.')
  }

  const response = await fetch(`${API_BASE}/api/public/promotions/validate-pin`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyId, pin }),
  })

  if (!response.ok) {
    let message = 'No se pudo validar el código PIN.'
    try {
      const payload = (await response.json()) as { error?: string }
      if (payload.error) {
        message = payload.error
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }

  const payload = (await response.json()) as { valid?: boolean }
  return payload.valid === true
}

export async function fetchPublicPromotionsBySlug(slug: string): Promise<PublicPromotion[]> {
  const response = await fetch(`${API_BASE}/api/public/promotions/${encodeURIComponent(slug)}`)

  if (!response.ok) {
    throw new Error('No se pudieron cargar las promociones.')
  }

  const payload = (await response.json()) as { promotions?: PublicPromotion[] }
  return payload.promotions ?? []
}

export async function fetchPublicPromotionBySlug(
  slug: string,
  promotionId: string,
): Promise<PublicPromotion | null> {
  const promotions = await fetchPublicPromotionsBySlug(slug)
  return promotions.find((promotion) => promotion.id === promotionId) ?? null
}

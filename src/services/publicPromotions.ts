import type { PromotionOfferConfig, PromotionProductRef } from '../types/company'

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
}

export async function fetchPublicPromotions(): Promise<PublicPromotion[]> {
  const response = await fetch(`${API_BASE}/api/public/promotions`)

  if (!response.ok) {
    throw new Error('No se pudieron cargar las promociones.')
  }

  const payload = (await response.json()) as { promotions?: PublicPromotion[] }
  return payload.promotions ?? []
}

export async function fetchPublicPromotionsBySlug(slug: string): Promise<PublicPromotion[]> {
  const response = await fetch(`${API_BASE}/api/public/promotions/${encodeURIComponent(slug)}`)

  if (!response.ok) {
    throw new Error('No se pudieron cargar las promociones.')
  }

  const payload = (await response.json()) as { promotions?: PublicPromotion[] }
  return payload.promotions ?? []
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface PublicPromotion {
  id: string
  companyId: string
  companyName: string
  companySlug: string
  companyPhotoUrl: string
  type: string
  title: string
  description: string
  photoUrl: string
  requiredReservations: number | null
  activeFromTime: string
  activeToTime: string
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

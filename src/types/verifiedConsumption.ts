import type { ReservationMinSpendLineItem } from './index'

/** Consumo verificado por promo con gasto mínimo (copia en companies/{id}/verifiedConsumptions). */
export interface VerifiedConsumptionRecord {
  id: string
  companyId: string
  reservationId: string
  clientName: string
  clientEmail: string
  pax: number
  reservationStartTime: Date
  promotionId: string | null
  minimumSpendCents: number
  mode: 'total' | 'products'
  totalCents: number
  lineItems: ReservationMinSpendLineItem[]
  verifiedAt: Date
  meetsMinimumSpend: boolean
}

export type VerifiedConsumptionSource = 'reservation' | 'walk_in'
export type VerifiedConsumptionCaptureMode = 'total' | 'products' | 'skip'

export interface CustomerVerifiedConsumption {
  id: string
  companyId: string
  companyName: string
  companySlug: string
  photoUrl: string
  verifiedAt: string
  visitAt: string
  totalCents: number
  mode: VerifiedConsumptionCaptureMode
  source: VerifiedConsumptionSource
  promotionId: string | null
  promotionTitle: string | null
  minimumSpendCents: number
  lineItems: Array<{ name: string; quantity: number; lineTotalCents: number }>
  meetsMinimumSpend: boolean
}

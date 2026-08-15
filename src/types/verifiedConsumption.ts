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

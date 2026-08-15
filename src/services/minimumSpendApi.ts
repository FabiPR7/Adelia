import { getIdToken } from './auth'
import type { PromotionVisitStatus, ReservationMinSpendVerification } from '../types'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface VerifyMinimumSpendPayload {
  pin: string
  mode: 'total' | 'products'
  declaredTotalCents?: number
  productSelections?: Array<{ nodeId: string; quantity: number }>
}

export interface VerifyMinimumSpendResult {
  meetsMinimumSpend: boolean
  promotionVisitStatus: PromotionVisitStatus
  totalCents: number
  minimumSpendCents: number
  minSpendVerification: ReservationMinSpendVerification
}

export async function verifyReservationMinimumSpend(
  reservationId: string,
  payload: VerifyMinimumSpendPayload,
): Promise<VerifyMinimumSpendResult> {
  const token = await getIdToken()

  if (!token) {
    throw new Error('Debes iniciar sesión como cliente.')
  }

  const response = await fetch(
    `${API_BASE}/api/public/reservations/${encodeURIComponent(reservationId)}/verify-minimum-spend`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    },
  )

  const data = (await response.json().catch(() => ({}))) as VerifyMinimumSpendResult & {
    error?: string
    minSpendVerification?: ReservationMinSpendVerification & { verifiedAt?: string }
  }

  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo verificar el gasto mínimo.')
  }

  const verification = data.minSpendVerification
  const verifiedAtValue = verification.verifiedAt as Date | string

  return {
    meetsMinimumSpend: data.meetsMinimumSpend,
    promotionVisitStatus: data.promotionVisitStatus,
    totalCents: data.totalCents,
    minimumSpendCents: data.minimumSpendCents,
    minSpendVerification: {
      ...verification,
      verifiedAt: verifiedAtValue instanceof Date
        ? verifiedAtValue
        : new Date(verifiedAtValue),
    },
  }
}

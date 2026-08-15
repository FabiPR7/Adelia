import type { Reservation } from '../types'
import { formatMenuPrice } from './menuTree'
import { reservationHasMinimumSpendRequirement } from './reservationPromotionEligibility'

export function canCustomerVerifyMinimumSpend(reservation: Reservation): boolean {
  return (
    reservation.status === 'confirmed'
    && reservationHasMinimumSpendRequirement(reservation)
    && !reservation.minSpendVerification
    && reservation.promotionVisitStatus !== 'eligible'
    && reservation.promotionVisitStatus !== 'not_eligible'
  )
}

export function formatCentsAsEuros(cents: number): string {
  const euros = cents / 100
  return Number.isInteger(euros)
    ? `${euros} €`
    : `${euros.toFixed(2).replace('.', ',')} €`
}

export function parseEuroInputToCents(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) {
    return null
  }

  const euros = Number(normalized)
  if (!Number.isFinite(euros) || euros < 0) {
    return null
  }

  return Math.round(euros * 100)
}

export function formatMinimumSpendTarget(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || cents <= 0) {
    return '0 €'
  }

  return formatCentsAsEuros(cents)
}

export function formatVerificationTotalLabel(totalCents: number, currency = 'EUR'): string {
  return formatMenuPrice(totalCents, currency)
}

export type ProductCartQuantities = Record<string, number>

export function sumProductCartCents(
  quantities: ProductCartQuantities,
  products: Array<{ id: string; priceCents: number | null }>,
): number {
  let total = 0

  for (const [nodeId, quantity] of Object.entries(quantities)) {
    if (quantity <= 0) {
      continue
    }

    const product = products.find((item) => item.id === nodeId)
    if (!product || product.priceCents == null || product.priceCents < 0) {
      continue
    }

    total += product.priceCents * quantity
  }

  return total
}

export function buildProductCartLineItems(
  quantities: ProductCartQuantities,
  products: Array<{ id: string; name: string; priceCents: number | null }>,
): Array<{ nodeId: string; quantity: number }> {
  return Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([nodeId, quantity]) => ({ nodeId, quantity }))
    .filter((entry) => products.some((product) => product.id === entry.nodeId))
}

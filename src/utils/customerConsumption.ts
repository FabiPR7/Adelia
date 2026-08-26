import { formatCentsAsEuros } from './minimumSpendVerification'
import type { CustomerVerifiedConsumption } from '../types/verifiedConsumption'

export function consumptionAmountLabel(totalCents: number, mode: string): string {
  if (mode === 'skip' || totalCents <= 0) {
    return 'Consumo verificado'
  }

  return formatCentsAsEuros(totalCents)
}

export function consumptionSourceLabel(source: CustomerVerifiedConsumption['source']): string {
  return source === 'reservation' ? 'Con reserva' : 'Sin reserva'
}

export function consumptionProductSummary(
  lineItems: Array<{ name: string; quantity: number }>,
): string {
  if (lineItems.length === 0) {
    return ''
  }

  return lineItems
    .map((item) => (item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name))
    .join(' · ')
}

export function sortConsumptionsByDateDesc<T extends { verifiedAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => Date.parse(right.verifiedAt) - Date.parse(left.verifiedAt))
}

export function filterConsumptionsForCustomer<T extends { customerUid: string }>(
  items: T[],
  uid: string,
): T[] {
  return items.filter((item) => item.customerUid === uid)
}

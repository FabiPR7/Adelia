import type { Reservation, ReservationMinSpendLineItem } from '../types'
import { dateToTimeInput } from './helpers'
import { formatCentsAsEuros } from './minimumSpendVerification'

export interface ProductSalesAggregate {
  nodeId: string
  name: string
  quantity: number
  totalCents: number
}

export interface HourProductSales {
  hour: string
  totalCents: number
  unitsSold: number
  reservationCount: number
}

export interface VerifiedSalesSummary {
  verificationCount: number
  totalCents: number
  unitsSold: number
  topProducts: ProductSalesAggregate[]
  byHour: HourProductSales[]
}

function aggregateLineItems(
  lineItems: ReservationMinSpendLineItem[],
  productMap: Map<string, ProductSalesAggregate>,
) {
  for (const item of lineItems) {
    const existing = productMap.get(item.nodeId)
    if (existing) {
      existing.quantity += item.quantity
      existing.totalCents += item.lineTotalCents
      continue
    }

    productMap.set(item.nodeId, {
      nodeId: item.nodeId,
      name: item.name,
      quantity: item.quantity,
      totalCents: item.lineTotalCents,
    })
  }
}

export function buildVerifiedSalesSummary(reservations: Reservation[]): VerifiedSalesSummary {
  const productMap = new Map<string, ProductSalesAggregate>()
  const hourMap = new Map<string, HourProductSales>()
  let verificationCount = 0
  let totalCents = 0
  let unitsSold = 0

  for (const reservation of reservations) {
    const verification = reservation.minSpendVerification
    if (!verification) {
      continue
    }

    verificationCount += 1
    totalCents += verification.totalCents

    const hour = dateToTimeInput(reservation.startTime)
    const hourEntry = hourMap.get(hour) ?? {
      hour,
      totalCents: 0,
      unitsSold: 0,
      reservationCount: 0,
    }

    hourEntry.totalCents += verification.totalCents
    hourEntry.reservationCount += 1
    hourMap.set(hour, hourEntry)

    if (verification.lineItems.length > 0) {
      aggregateLineItems(verification.lineItems, productMap)

      for (const item of verification.lineItems) {
        unitsSold += item.quantity
        hourEntry.unitsSold += item.quantity
      }
    }
  }

  const topProducts = [...productMap.values()]
    .sort((left, right) => right.quantity - left.quantity || right.totalCents - left.totalCents)

  const byHour = [...hourMap.values()].sort((left, right) => left.hour.localeCompare(right.hour))

  return {
    verificationCount,
    totalCents,
    unitsSold,
    topProducts,
    byHour,
  }
}

export function formatVerifiedConsumptionLabel(reservation: Reservation): string | null {
  const verification = reservation.minSpendVerification
  if (!verification) {
    return null
  }

  const totalLabel = formatCentsAsEuros(verification.totalCents)

  if (verification.lineItems.length > 0) {
    const units = verification.lineItems.reduce((sum, item) => sum + item.quantity, 0)
    return `${units} producto${units === 1 ? '' : 's'} · ${totalLabel}`
  }

  return `${totalLabel} (total)`
}

export function reservationNeedsConsumptionVerification(reservation: Reservation): boolean {
  return (
    reservation.status === 'confirmed'
    && typeof reservation.minimumSpendCents === 'number'
    && reservation.minimumSpendCents > 0
    && !reservation.minSpendVerification
  )
}

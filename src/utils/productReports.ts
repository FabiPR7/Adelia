import type { Reservation, ReservationMinSpendLineItem } from '../types'
import type { VerifiedConsumptionRecord } from '../types/verifiedConsumption'
import {
  formatReportPeriodLabel,
  getReportDateRange,
  type DateRange,
  type ReportPeriodConfig,
} from './reservationReports'
import { dateToTimeInput } from './helpers'

export interface ProductReportKpis {
  verificationCount: number
  totalCents: number
  unitsSold: number
  productLineCount: number
  withProductDetail: number
  withTotalOnly: number
}

export interface ProductSalesAggregate {
  nodeId: string
  name: string
  quantity: number
  totalCents: number
}

export interface ProductTrendChartData {
  labels: string[]
  revenueCents: number[]
  unitsSold: number[]
}

export interface ProductHourChartData {
  labels: string[]
  values: number[]
  max: number
}

function mapLineItems(raw: unknown): ReservationMinSpendLineItem[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const line = item as Record<string, unknown>
      const nodeId = typeof line.nodeId === 'string' ? line.nodeId : ''
      const name = typeof line.name === 'string' ? line.name : ''
      const quantity = typeof line.quantity === 'number' ? line.quantity : 0
      const unitPriceCents = typeof line.unitPriceCents === 'number' ? line.unitPriceCents : 0
      const lineTotalCents = typeof line.lineTotalCents === 'number' ? line.lineTotalCents : 0

      if (!nodeId || quantity < 1) {
        return null
      }

      return { nodeId, name, quantity, unitPriceCents, lineTotalCents }
    })
    .filter((item): item is ReservationMinSpendLineItem => item !== null)
}

export function verifiedConsumptionFromReservation(reservation: Reservation): VerifiedConsumptionRecord | null {
  const verification = reservation.minSpendVerification
  if (!verification) {
    return null
  }

  return {
    id: reservation.id,
    companyId: reservation.companyId,
    reservationId: reservation.id,
    clientName: reservation.clientName,
    clientEmail: reservation.clientEmail,
    pax: reservation.pax,
    reservationStartTime: reservation.startTime,
    promotionId: reservation.promotionId ?? null,
    minimumSpendCents: reservation.minimumSpendCents ?? 0,
    mode: verification.mode,
    totalCents: verification.totalCents,
    lineItems: verification.lineItems,
    verifiedAt: verification.verifiedAt,
    meetsMinimumSpend: verification.meetsMinimumSpend,
  }
}

export function mapVerifiedConsumptionDoc(
  id: string,
  data: Record<string, unknown>,
): VerifiedConsumptionRecord | null {
  const mode = data.mode === 'products' ? 'products' : data.mode === 'total' ? 'total' : null
  const totalCents = typeof data.totalCents === 'number' ? data.totalCents : null
  if (!mode || totalCents == null) {
    return null
  }

  const verifiedAt = (data.verifiedAt as { toDate?: () => Date })?.toDate?.()
    ?? (typeof data.verifiedAt === 'string' ? new Date(data.verifiedAt) : null)
  const reservationStartTime = (data.reservationStartTime as { toDate?: () => Date })?.toDate?.()
    ?? (typeof data.reservationStartTime === 'string' ? new Date(data.reservationStartTime) : null)

  if (!verifiedAt || !reservationStartTime) {
    return null
  }

  return {
    id,
    companyId: typeof data.companyId === 'string' ? data.companyId : '',
    reservationId: typeof data.reservationId === 'string' ? data.reservationId : id,
    clientName: typeof data.clientName === 'string' ? data.clientName : '',
    clientEmail: typeof data.clientEmail === 'string' ? data.clientEmail : '',
    pax: typeof data.pax === 'number' ? data.pax : 0,
    reservationStartTime,
    promotionId: typeof data.promotionId === 'string' ? data.promotionId : null,
    minimumSpendCents: typeof data.minimumSpendCents === 'number' ? data.minimumSpendCents : 0,
    mode,
    totalCents,
    lineItems: mapLineItems(data.lineItems),
    verifiedAt,
    meetsMinimumSpend: data.meetsMinimumSpend === true,
  }
}

export function mergeVerifiedConsumptions(
  fromSubcollection: VerifiedConsumptionRecord[],
  reservations: Reservation[],
): VerifiedConsumptionRecord[] {
  const byId = new Map<string, VerifiedConsumptionRecord>()

  for (const record of fromSubcollection) {
    byId.set(record.reservationId, record)
  }

  for (const reservation of reservations) {
    const mapped = verifiedConsumptionFromReservation(reservation)
    if (mapped && !byId.has(mapped.reservationId)) {
      byId.set(mapped.reservationId, mapped)
    }
  }

  return [...byId.values()].sort(
    (left, right) => right.verifiedAt.getTime() - left.verifiedAt.getTime(),
  )
}

export function filterVerifiedInRange(
  records: VerifiedConsumptionRecord[],
  range: DateRange,
): VerifiedConsumptionRecord[] {
  return records.filter(
    (record) =>
      record.reservationStartTime >= range.start
      && record.reservationStartTime <= range.end,
  )
}

function aggregateProducts(records: VerifiedConsumptionRecord[]): ProductSalesAggregate[] {
  const productMap = new Map<string, ProductSalesAggregate>()

  for (const record of records) {
    for (const item of record.lineItems) {
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

  return [...productMap.values()].sort(
    (left, right) => right.quantity - left.quantity || right.totalCents - left.totalCents,
  )
}

export function computeProductKpis(records: VerifiedConsumptionRecord[]): ProductReportKpis {
  let unitsSold = 0
  let productLineCount = 0
  let withProductDetail = 0
  let withTotalOnly = 0
  let totalCents = 0

  for (const record of records) {
    totalCents += record.totalCents
    if (record.mode === 'products' && record.lineItems.length > 0) {
      withProductDetail += 1
      for (const item of record.lineItems) {
        unitsSold += item.quantity
        productLineCount += 1
      }
    } else {
      withTotalOnly += 1
    }
  }

  return {
    verificationCount: records.length,
    totalCents,
    unitsSold,
    productLineCount,
    withProductDetail,
    withTotalOnly,
  }
}

export function computeTopProducts(
  records: VerifiedConsumptionRecord[],
  limit = 8,
): ProductSalesAggregate[] {
  return aggregateProducts(records).slice(0, limit)
}

export function computeProductTrendChartData(
  records: VerifiedConsumptionRecord[],
  config: ReportPeriodConfig,
): ProductTrendChartData {
  const range = getReportDateRange(config)
  const filtered = filterVerifiedInRange(records, range)
  const { granularity } = config

  if (granularity === 'annual') {
    const buckets = Array.from({ length: 12 }, (_, index) => ({
      label: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][index],
      revenueCents: 0,
      unitsSold: 0,
    }))

    for (const record of filtered) {
      const monthIndex = record.reservationStartTime.getMonth()
      buckets[monthIndex].revenueCents += record.totalCents
      buckets[monthIndex].unitsSold += record.lineItems.reduce((sum, item) => sum + item.quantity, 0)
    }

    return {
      labels: buckets.map((bucket) => bucket.label),
      revenueCents: buckets.map((bucket) => bucket.revenueCents),
      unitsSold: buckets.map((bucket) => bucket.unitsSold),
    }
  }

  if (granularity === 'quarterly') {
    const startMonth = (config.quarter - 1) * 3
    const buckets = Array.from({ length: 3 }, (_, index) => ({
      label: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][startMonth + index],
      revenueCents: 0,
      unitsSold: 0,
    }))

    for (const record of filtered) {
      const monthInQuarter = record.reservationStartTime.getMonth() - startMonth
      if (monthInQuarter < 0 || monthInQuarter > 2) {
        continue
      }

      buckets[monthInQuarter].revenueCents += record.totalCents
      buckets[monthInQuarter].unitsSold += record.lineItems.reduce((sum, item) => sum + item.quantity, 0)
    }

    return {
      labels: buckets.map((bucket) => bucket.label),
      revenueCents: buckets.map((bucket) => bucket.revenueCents),
      unitsSold: buckets.map((bucket) => bucket.unitsSold),
    }
  }

  const daysInMonth = new Date(config.year, config.month, 0).getDate()
  const buckets = Array.from({ length: daysInMonth }, (_, index) => ({
    label: String(index + 1),
    revenueCents: 0,
    unitsSold: 0,
  }))

  for (const record of filtered) {
    const dayIndex = record.reservationStartTime.getDate() - 1
    if (dayIndex < 0 || dayIndex >= buckets.length) {
      continue
    }

    buckets[dayIndex].revenueCents += record.totalCents
    buckets[dayIndex].unitsSold += record.lineItems.reduce((sum, item) => sum + item.quantity, 0)
  }

  return {
    labels: buckets.map((bucket) => bucket.label),
    revenueCents: buckets.map((bucket) => bucket.revenueCents),
    unitsSold: buckets.map((bucket) => bucket.unitsSold),
  }
}

export function computeProductHourChartData(records: VerifiedConsumptionRecord[]): ProductHourChartData {
  const hourMap = new Map<string, number>()

  for (const record of records) {
    const hour = dateToTimeInput(record.reservationStartTime)
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + record.lineItems.reduce((sum, item) => sum + item.quantity, 0))
  }

  const sorted = [...hourMap.entries()].sort((left, right) => left[0].localeCompare(right[0]))
  const values = sorted.map(([, value]) => value)
  const max = Math.max(1, ...values)

  return {
    labels: sorted.map(([hour]) => hour),
    values,
    max,
  }
}

export function getAvailableYearsFromVerified(records: VerifiedConsumptionRecord[]): number[] {
  const years = new Set<number>()
  const currentYear = new Date().getFullYear()
  years.add(currentYear)

  for (const record of records) {
    years.add(record.reservationStartTime.getFullYear())
  }

  return [...years].sort((left, right) => right - left)
}

export function reservationsToVerifiedFallback(reservations: Reservation[]): VerifiedConsumptionRecord[] {
  return reservations
    .map((reservation) => verifiedConsumptionFromReservation(reservation))
    .filter((record): record is VerifiedConsumptionRecord => record !== null)
}

export function computeModeDistribution(records: VerifiedConsumptionRecord[]): {
  withProducts: number
  totalOnly: number
} {
  let withProducts = 0
  let totalOnly = 0

  for (const record of records) {
    if (record.mode === 'products' && record.lineItems.length > 0) {
      withProducts += 1
    } else {
      totalOnly += 1
    }
  }

  return { withProducts, totalOnly }
}

export { formatReportPeriodLabel, getReportDateRange }

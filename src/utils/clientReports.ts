import type { Reservation } from '../types'
import { isValidClientEmail, normalizeClientEmail } from '../utils/clientIdentity'
import {
  filterReservationsInRange,
  formatReportPeriodLabel,
  getAvailableYears,
  getReportDateRange,
  type DateRange,
  type ReportGranularity,
  type ReportPeriodConfig,
} from './reservationReports'

export type { ReportGranularity, ReportPeriodConfig }
export { filterReservationsInRange, formatReportPeriodLabel, getAvailableYears, getReportDateRange }

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export interface ClientKpis {
  total: number
  newClients: number
  recurring: number
}

export interface ClientTrendData {
  labels: string[]
  newClients: number[]
  returning: number[]
}

export interface ClientSplitData {
  newClients: number
  recurring: number
}

export interface BarChartData {
  labels: string[]
  values: number[]
  max: number
}

export interface RetentionChartData {
  labels: string[]
  acquired: number[]
  returnedNextMonth: number[]
}

export interface ClientDirectoryRow {
  key: string
  name: string
  email: string
  phone: string
  reservations: number
  totalPax: number
  firstVisit: Date
  lastVisit: Date
}

const FREQUENCY_BUCKETS = [
  { min: 1, max: 1, label: '1 visita' },
  { min: 2, max: 2, label: '2 visitas' },
  { min: 3, max: 5, label: '3-5' },
  { min: 6, max: Infinity, label: '6+' },
] as const

const RECENCY_BUCKETS = [
  { maxDays: 30, label: '<30 días' },
  { maxDays: 60, label: '30-60 días' },
  { maxDays: 90, label: '60-90 días' },
  { maxDays: Infinity, label: '90+ días' },
] as const

function getClientKey(reservation: Reservation): string {
  const email = normalizeClientEmail(reservation.clientEmail)
  if (email && isValidClientEmail(email)) {
    return email
  }

  const phone = reservation.clientPhone.trim().toLowerCase()
  const name = reservation.clientName.trim().toLowerCase()
  return `local:${phone || name || reservation.id}`
}

function buildFirstVisitMap(reservations: Reservation[]): Map<string, Date> {
  const firstVisit = new Map<string, Date>()

  for (const reservation of reservations) {
    const key = getClientKey(reservation)
    const current = firstVisit.get(key)
    const time = reservation.startTime.getTime()

    if (!current || time < current.getTime()) {
      firstVisit.set(key, reservation.startTime)
    }
  }

  return firstVisit
}

function getUniqueClientKeys(reservations: Reservation[]): Set<string> {
  const keys = new Set<string>()

  for (const reservation of reservations) {
    keys.add(getClientKey(reservation))
  }

  return keys
}

function isDateInRange(date: Date, range: DateRange): boolean {
  const time = date.getTime()
  return time >= range.start.getTime() && time <= range.end.getTime()
}

function isNewClientInBucket(
  clientKey: string,
  bucketRange: DateRange,
  firstVisitMap: Map<string, Date>,
): boolean {
  const firstVisit = firstVisitMap.get(clientKey)
  if (!firstVisit) {
    return false
  }

  return isDateInRange(firstVisit, bucketRange)
}

function isRecurrentClientInBucket(
  clientKey: string,
  bucketRange: DateRange,
  firstVisitMap: Map<string, Date>,
  config: ReportPeriodConfig,
): boolean {
  const firstVisit = firstVisitMap.get(clientKey)
  if (!firstVisit) {
    return false
  }

  if (config.granularity === 'monthly') {
    const monthStart = new Date(config.year, config.month - 1, 1, 0, 0, 0, 0)
    return firstVisit.getTime() < monthStart.getTime()
  }

  return firstVisit.getTime() < bucketRange.start.getTime()
}

function createTrendBuckets(config: ReportPeriodConfig) {
  const range = getReportDateRange(config)

  if (config.granularity === 'monthly') {
    const daysInMonth = range.end.getDate()
    return {
      labels: Array.from({ length: daysInMonth }, (_, index) => String(index + 1)),
      length: daysInMonth,
      bucketStart: (index: number) => new Date(config.year, config.month - 1, index + 1, 0, 0, 0, 0),
      bucketEnd: (index: number) => new Date(config.year, config.month - 1, index + 1, 23, 59, 59, 999),
    }
  }

  if (config.granularity === 'quarterly') {
    const startMonth = (config.quarter - 1) * 3
    return {
      labels: [
        MONTH_NAMES[startMonth],
        MONTH_NAMES[startMonth + 1],
        MONTH_NAMES[startMonth + 2],
      ],
      length: 3,
      bucketStart: (index: number) => new Date(config.year, startMonth + index, 1, 0, 0, 0, 0),
      bucketEnd: (index: number) => new Date(config.year, startMonth + index + 1, 0, 23, 59, 59, 999),
    }
  }

  return {
    labels: MONTH_NAMES,
    length: 12,
    bucketStart: (index: number) => new Date(config.year, index, 1, 0, 0, 0, 0),
    bucketEnd: (index: number) => new Date(config.year, index + 1, 0, 23, 59, 59, 999),
  }
}

function classifyPeriodClients(
  periodReservations: Reservation[],
  allReservations: Reservation[],
  periodConfig: ReportPeriodConfig,
): ClientKpis {
  const periodRange = getReportDateRange(periodConfig)
  const periodClientKeys = getUniqueClientKeys(periodReservations)
  const firstVisitMap = buildFirstVisitMap(allReservations)

  let newClients = 0
  let recurring = 0

  for (const clientKey of periodClientKeys) {
    const firstVisit = firstVisitMap.get(clientKey)
    if (!firstVisit) {
      continue
    }

    if (isDateInRange(firstVisit, periodRange)) {
      newClients += 1
    } else if (firstVisit.getTime() < periodRange.start.getTime()) {
      recurring += 1
    }
  }

  return {
    total: periodClientKeys.size,
    newClients,
    recurring,
  }
}

export function computeClientKpis(
  periodReservations: Reservation[],
  allReservations: Reservation[],
  periodConfig: ReportPeriodConfig,
): ClientKpis {
  return classifyPeriodClients(periodReservations, allReservations, periodConfig)
}

export function computeClientTrendData(
  periodReservations: Reservation[],
  allReservations: Reservation[],
  config: ReportPeriodConfig,
): ClientTrendData {
  const buckets = createTrendBuckets(config)
  const firstVisitMap = buildFirstVisitMap(allReservations)
  const newClients = Array(buckets.length).fill(0)
  const returning = Array(buckets.length).fill(0)

  for (let index = 0; index < buckets.length; index += 1) {
    const bucketRange: DateRange = {
      start: buckets.bucketStart(index),
      end: buckets.bucketEnd(index),
    }
    const seenNew = new Set<string>()
    const seenReturning = new Set<string>()

    for (const reservation of periodReservations) {
      if (!isDateInRange(reservation.startTime, bucketRange)) {
        continue
      }

      const clientKey = getClientKey(reservation)

      if (isNewClientInBucket(clientKey, bucketRange, firstVisitMap)) {
        seenNew.add(clientKey)
      } else if (isRecurrentClientInBucket(clientKey, bucketRange, firstVisitMap, config)) {
        seenReturning.add(clientKey)
      }
    }

    newClients[index] = seenNew.size
    returning[index] = seenReturning.size
  }

  return { labels: buckets.labels, newClients, returning }
}

export function computeClientSplitData(
  periodReservations: Reservation[],
  allReservations: Reservation[],
  periodConfig: ReportPeriodConfig,
): ClientSplitData {
  const { newClients, recurring } = classifyPeriodClients(
    periodReservations,
    allReservations,
    periodConfig,
  )

  return { newClients, recurring }
}

function buildClientDirectoryMap(reservations: Reservation[]): Map<string, ClientDirectoryRow> {
  const clients = new Map<string, ClientDirectoryRow>()

  for (const reservation of reservations) {
    const key = getClientKey(reservation)
    const email = normalizeClientEmail(reservation.clientEmail)
    const existing = clients.get(key)

    if (!existing) {
      clients.set(key, {
        key,
        name: reservation.clientName.trim() || 'Cliente',
        email: isValidClientEmail(email) ? email : '',
        phone: reservation.clientPhone.trim(),
        reservations: 1,
        totalPax: reservation.pax,
        firstVisit: reservation.startTime,
        lastVisit: reservation.startTime,
      })
      continue
    }

    existing.reservations += 1
    existing.totalPax += reservation.pax
    if (reservation.startTime.getTime() < existing.firstVisit.getTime()) {
      existing.firstVisit = reservation.startTime
    }
    if (reservation.startTime.getTime() > existing.lastVisit.getTime()) {
      existing.lastVisit = reservation.startTime
      existing.name = reservation.clientName.trim() || existing.name
      existing.phone = reservation.clientPhone.trim() || existing.phone
    }
  }

  return clients
}

function countNewClientsInRange(
  allReservations: Reservation[],
  range: DateRange,
): Set<string> {
  const firstVisitMap = buildFirstVisitMap(allReservations)
  const keys = new Set<string>()

  for (const [clientKey, firstVisit] of firstVisitMap) {
    if (isDateInRange(firstVisit, range)) {
      keys.add(clientKey)
    }
  }

  return keys
}

function countReturnedClients(
  acquiredKeys: Set<string>,
  allReservations: Reservation[],
  returnRange: DateRange,
): number {
  if (acquiredKeys.size === 0) {
    return 0
  }

  const returned = new Set<string>()

  for (const reservation of allReservations) {
    const clientKey = getClientKey(reservation)
    if (acquiredKeys.has(clientKey) && isDateInRange(reservation.startTime, returnRange)) {
      returned.add(clientKey)
    }
  }

  return returned.size
}

export function computeVisitFrequencyData(periodReservations: Reservation[]): BarChartData {
  const visitCounts = new Map<string, number>()

  for (const reservation of periodReservations) {
    const key = getClientKey(reservation)
    visitCounts.set(key, (visitCounts.get(key) ?? 0) + 1)
  }

  const values = FREQUENCY_BUCKETS.map(() => 0)

  for (const count of visitCounts.values()) {
    const bucketIndex = FREQUENCY_BUCKETS.findIndex(
      (bucket) => count >= bucket.min && count <= bucket.max,
    )
    if (bucketIndex !== -1) {
      values[bucketIndex] += 1
    }
  }

  return {
    labels: FREQUENCY_BUCKETS.map((bucket) => bucket.label),
    values,
    max: Math.max(1, ...values),
  }
}

export function computeRetentionData(
  allReservations: Reservation[],
  config: ReportPeriodConfig,
): RetentionChartData {
  const periodRange = getReportDateRange(config)
  const labels: string[] = []
  const acquired: number[] = []
  const returnedNextMonth: number[] = []

  if (config.granularity === 'monthly') {
    const prevMonth = config.month === 1 ? 12 : config.month - 1
    const prevYear = config.month === 1 ? config.year - 1 : config.year
    const acquiredRange: DateRange = {
      start: new Date(prevYear, prevMonth - 1, 1, 0, 0, 0, 0),
      end: new Date(prevYear, prevMonth, 0, 23, 59, 59, 999),
    }
    const acquiredKeys = countNewClientsInRange(allReservations, acquiredRange)

    labels.push(`${MONTH_NAMES[prevMonth - 1]} → ${MONTH_NAMES[config.month - 1]}`)
    acquired.push(acquiredKeys.size)
    returnedNextMonth.push(countReturnedClients(acquiredKeys, allReservations, periodRange))

    return { labels, acquired, returnedNextMonth }
  }

  const monthCount = config.granularity === 'quarterly' ? 3 : 12
  const startMonth = config.granularity === 'quarterly' ? (config.quarter - 1) * 3 : 0

  for (let offset = 0; offset < monthCount - 1; offset += 1) {
    const monthIndex = startMonth + offset
    const acquiredRange: DateRange = {
      start: new Date(config.year, monthIndex, 1, 0, 0, 0, 0),
      end: new Date(config.year, monthIndex + 1, 0, 23, 59, 59, 999),
    }
    const returnRange: DateRange = {
      start: new Date(config.year, monthIndex + 1, 1, 0, 0, 0, 0),
      end: new Date(config.year, monthIndex + 2, 0, 23, 59, 59, 999),
    }
    const acquiredKeys = countNewClientsInRange(allReservations, acquiredRange)

    labels.push(`${MONTH_NAMES[monthIndex]} → ${MONTH_NAMES[monthIndex + 1]}`)
    acquired.push(acquiredKeys.size)
    returnedNextMonth.push(countReturnedClients(acquiredKeys, allReservations, returnRange))
  }

  return { labels, acquired, returnedNextMonth }
}

export function computeRecencyData(
  allReservations: Reservation[],
  referenceDate = new Date(),
): BarChartData {
  const clients = buildClientDirectoryMap(allReservations)
  const firstVisitMap = buildFirstVisitMap(allReservations)
  const values = RECENCY_BUCKETS.map(() => 0)
  const referenceMs = referenceDate.getTime()

  for (const client of clients.values()) {
    const firstVisit = firstVisitMap.get(client.key)
    if (!firstVisit) {
      continue
    }

    const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1, 0, 0, 0, 0)
    if (firstVisit.getTime() >= monthStart.getTime()) {
      continue
    }

    const daysSinceLastVisit = Math.floor(
      (referenceMs - client.lastVisit.getTime()) / (24 * 60 * 60 * 1000),
    )

    const bucketIndex = RECENCY_BUCKETS.findIndex((bucket) => daysSinceLastVisit < bucket.maxDays)
    if (bucketIndex !== -1) {
      values[bucketIndex] += 1
    }
  }

  return {
    labels: RECENCY_BUCKETS.map((bucket) => bucket.label),
    values,
    max: Math.max(1, ...values),
  }
}

export function computeClientsDirectory(allReservations: Reservation[]): ClientDirectoryRow[] {
  return [...buildClientDirectoryMap(allReservations).values()].sort(
    (left, right) => right.lastVisit.getTime() - left.lastVisit.getTime(),
  )
}

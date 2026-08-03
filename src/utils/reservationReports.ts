import type { Reservation } from '../types'

export type ReportGranularity = 'monthly' | 'quarterly' | 'annual'

export interface ReportPeriodConfig {
  granularity: ReportGranularity
  year: number
  month: number
  quarter: number
}

export interface DateRange {
  start: Date
  end: Date
}

export interface ReservationKpis {
  total: number
  cancelled: number
  confirmed: number
  completed: number
}

export interface TrendChartData {
  labels: string[]
  total: number[]
  cancelled: number[]
  confirmed: number[]
  completed: number[]
}

export interface StatusDistributionData {
  confirmed: number
  cancelled: number
  completed: number
}

export interface WeekdayChartData {
  labels: string[]
  values: number[]
  max: number
}

export interface HourSlotChartData {
  labels: string[]
  values: number[]
  max: number
}

const HOUR_SLOTS = [
  { start: 12, end: 14, label: '12-14h' },
  { start: 14, end: 16, label: '14-16h' },
  { start: 16, end: 18, label: '16-18h' },
  { start: 18, end: 20, label: '18-20h' },
  { start: 20, end: 22, label: '20-22h' },
  { start: 22, end: 24, label: '22-00h' },
] as const

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function isCancelled(reservation: Reservation): boolean {
  return reservation.status === 'cancelled'
}

function isConfirmed(reservation: Reservation): boolean {
  return reservation.status === 'confirmed'
}

function dayOfWeekIndex(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 6 : day - 1
}

export function getReportDateRange(config: ReportPeriodConfig): DateRange {
  const { granularity, year, month, quarter } = config

  if (granularity === 'monthly') {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
    const end = new Date(year, month, 0, 23, 59, 59, 999)
    return { start, end }
  }

  if (granularity === 'quarterly') {
    const startMonth = (quarter - 1) * 3
    const start = new Date(year, startMonth, 1, 0, 0, 0, 0)
    const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999)
    return { start, end }
  }

  const start = new Date(year, 0, 1, 0, 0, 0, 0)
  const end = new Date(year, 11, 31, 23, 59, 59, 999)
  return { start, end }
}

export function filterReservationsInRange(
  reservations: Reservation[],
  range: DateRange,
): Reservation[] {
  const startMs = range.start.getTime()
  const endMs = range.end.getTime()

  return reservations.filter((reservation) => {
    const time = reservation.startTime.getTime()
    return time >= startMs && time <= endMs
  })
}

function isCompleted(reservation: Reservation): boolean {
  return reservation.status === 'completed'
}

export function computeReservationKpis(reservations: Reservation[]): ReservationKpis {
  let cancelled = 0
  let confirmed = 0
  let completed = 0

  for (const reservation of reservations) {
    if (isCancelled(reservation)) {
      cancelled += 1
    } else if (isConfirmed(reservation)) {
      confirmed += 1
    } else if (isCompleted(reservation)) {
      completed += 1
    }
  }

  return {
    total: reservations.length,
    cancelled,
    confirmed,
    completed,
  }
}

export function computeTrendChartData(
  reservations: Reservation[],
  config: ReportPeriodConfig,
): TrendChartData {
  const range = getReportDateRange(config)

  if (config.granularity === 'monthly') {
    const daysInMonth = range.end.getDate()
    const labels = Array.from({ length: daysInMonth }, (_, index) => String(index + 1))
    const total = Array(daysInMonth).fill(0)
    const cancelled = Array(daysInMonth).fill(0)
    const confirmed = Array(daysInMonth).fill(0)
    const completed = Array(daysInMonth).fill(0)

    for (const reservation of reservations) {
      const dayIndex = reservation.startTime.getDate() - 1
      total[dayIndex] += 1
      if (isCancelled(reservation)) {
        cancelled[dayIndex] += 1
      } else if (isConfirmed(reservation)) {
        confirmed[dayIndex] += 1
      } else if (isCompleted(reservation)) {
        completed[dayIndex] += 1
      }
    }

    return { labels, total, cancelled, confirmed, completed }
  }

  if (config.granularity === 'quarterly') {
    const startMs = range.start.getTime()
    const msWeek = 7 * 24 * 60 * 60 * 1000
    const numWeeks = Math.max(1, Math.ceil((range.end.getTime() - startMs + 1) / msWeek))
    const labels = Array.from({ length: numWeeks }, (_, index) => `S${index + 1}`)
    const total = Array(numWeeks).fill(0)
    const cancelled = Array(numWeeks).fill(0)
    const confirmed = Array(numWeeks).fill(0)
    const completed = Array(numWeeks).fill(0)

    for (const reservation of reservations) {
      const weekIndex = Math.min(
        numWeeks - 1,
        Math.floor((reservation.startTime.getTime() - startMs) / msWeek),
      )
      total[weekIndex] += 1
      if (isCancelled(reservation)) {
        cancelled[weekIndex] += 1
      } else if (isConfirmed(reservation)) {
        confirmed[weekIndex] += 1
      } else if (isCompleted(reservation)) {
        completed[weekIndex] += 1
      }
    }

    return { labels, total, cancelled, confirmed, completed }
  }

  const total = Array(12).fill(0)
  const cancelled = Array(12).fill(0)
  const confirmed = Array(12).fill(0)
  const completed = Array(12).fill(0)

  for (const reservation of reservations) {
    const monthIndex = reservation.startTime.getMonth()
    total[monthIndex] += 1
    if (isCancelled(reservation)) {
      cancelled[monthIndex] += 1
    } else if (isConfirmed(reservation)) {
      confirmed[monthIndex] += 1
    } else if (isCompleted(reservation)) {
      completed[monthIndex] += 1
    }
  }

  return { labels: MONTH_NAMES, total, cancelled, confirmed, completed }
}

export function computeStatusDistribution(reservations: Reservation[]): StatusDistributionData {
  let confirmed = 0
  let cancelled = 0
  let completed = 0

  for (const reservation of reservations) {
    if (isCancelled(reservation)) {
      cancelled += 1
    } else if (isConfirmed(reservation)) {
      confirmed += 1
    } else if (isCompleted(reservation)) {
      completed += 1
    }
  }

  return { confirmed, cancelled, completed }
}

export function computeWeekdayChartData(reservations: Reservation[]): WeekdayChartData {
  const values = Array(7).fill(0)

  for (const reservation of reservations) {
    values[dayOfWeekIndex(reservation.startTime)] += 1
  }

  return {
    labels: DAY_LABELS,
    values,
    max: Math.max(1, ...values),
  }
}

export function computeHourSlotChartData(reservations: Reservation[]): HourSlotChartData {
  const values = HOUR_SLOTS.map(() => 0)

  for (const reservation of reservations) {
    const hour = reservation.startTime.getHours()
    const slotIndex = HOUR_SLOTS.findIndex(
      (slot) => hour >= slot.start && hour < slot.end,
    )

    if (slotIndex !== -1) {
      values[slotIndex] += 1
    }
  }

  return {
    labels: HOUR_SLOTS.map((slot) => slot.label),
    values,
    max: Math.max(1, ...values),
  }
}

export function sortReservationsByCreatedAt(reservations: Reservation[]): Reservation[] {
  return [...reservations].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  )
}

export function getAvailableYears(reservations: Reservation[]): number[] {
  const years = new Set<number>([new Date().getFullYear()])

  for (const reservation of reservations) {
    years.add(reservation.startTime.getFullYear())
    years.add(reservation.createdAt.getFullYear())
  }

  return [...years].sort((left, right) => right - left)
}

export function formatReportPeriodLabel(config: ReportPeriodConfig): string {
  if (config.granularity === 'monthly') {
    const date = new Date(config.year, config.month - 1, 1)
    return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(date)
  }

  if (config.granularity === 'quarterly') {
    return `T${config.quarter} ${config.year}`
  }

  return String(config.year)
}

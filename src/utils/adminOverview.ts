import {
  COMPANY_PLANS,
  type CompanyPlanBilling,
  type CompanyPlanId,
} from '../data/companyPlans'
import type { ReservationStatus, TimeRange, DateRangeFilter } from '../services/adminAnalytics.types'

export interface AdminUserRow {
  role: string
  createdAt: Date
  country: string
}

export interface AdminCompanyRow {
  id: string
  name: string
  createdAt: Date
  country: string
  planId: CompanyPlanId
  planBilling: CompanyPlanBilling | null
}

export interface AdminReservationRow {
  id: string
  companyId: string
  clientName: string
  pax: number
  status: ReservationStatus
  startTime: Date
  createdAt: Date
}

export interface SeriesPoint {
  labels: string[]
  values: number[]
}

export interface NamedCount {
  label: string
  count: number
}

export interface DonutSlice {
  key: string
  label: string
  value: number
  color: string
}

export interface AdminOverviewStats {
  totalUsers: number
  totalCustomers: number
  totalCompanyAccounts: number
  totalCompanies: number
  paidCompanies: number
  monthlyPlans: number
  perpetualPlans: number
  newUsersToday: number
  newUsersThisWeek: number
  newUsersThisMonth: number
  newCompaniesToday: number
  newCompaniesThisWeek: number
  newCompaniesThisMonth: number
  userGrowthRate: number
  companyGrowthRate: number
  reservationGrowthRate: number
  previousMonthUsers: number
  previousMonthCompanies: number
  previousMonthReservations: number
  totalReservations: number
  reservationsToday: number
  reservationsThisWeek: number
  reservationsThisMonth: number
  confirmedReservations: number
  completedReservations: number
  cancelledReservations: number
  cancellationRate: number
  totalGuests: number
  avgPartySize: number
  upcomingReservations: number
}

export interface AdminOverview {
  stats: AdminOverviewStats
  userGrowth: SeriesPoint
  companyGrowth: SeriesPoint
  reservationGrowth: SeriesPoint
  userSpark: number[]
  companySpark: number[]
  reservationSpark: number[]
  reservationsByStatus: DonutSlice[]
  plansDistribution: DonutSlice[]
  billingDistribution: DonutSlice[]
  reservationsByWeekday: NamedCount[]
  topCompanies: NamedCount[]
  usersByCountry: NamedCount[]
  companiesByCountry: NamedCount[]
  countries: string[]
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const PLAN_COLORS: Record<CompanyPlanId, string> = {
  free: '#8a7a6e',
  basic: '#2e7d6b',
  premium: '#c49a3a',
  premium_plus: '#e25a3c',
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function inRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date < end
}

function growthRate(current: number, previous: number): number {
  if (previous > 0) {
    return Math.round(((current - previous) / previous) * 1000) / 10
  }
  return current > 0 ? 100 : 0
}

export function getExclusiveDateRange(
  range: TimeRange,
  now: Date,
  custom?: DateRangeFilter,
): { start: Date; end: Date } {
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)

  switch (range) {
    case 'today':
      return { start: today, end: tomorrow }
    case 'week':
      return { start: addDays(today, -6), end: tomorrow }
    case 'month':
      return { start: addDays(today, -29), end: tomorrow }
    case 'quarter':
      return { start: addDays(today, -89), end: tomorrow }
    case 'semester': {
      const start = new Date(today)
      start.setMonth(start.getMonth() - 6)
      return { start, end: tomorrow }
    }
    case 'year': {
      const start = new Date(today)
      start.setFullYear(start.getFullYear() - 1)
      return { start, end: tomorrow }
    }
    case 'custom': {
      if (!custom) {
        return { start: today, end: tomorrow }
      }
      const start = startOfDay(custom.startDate)
      const end = addDays(startOfDay(custom.endDate), 1)
      return start < end ? { start, end } : { start: end, end: addDays(start, 1) }
    }
    default:
      return { start: today, end: tomorrow }
  }
}

/** Ventana mínima para gráficos, sparks y comparación del mes anterior sin bajar todo el histórico. */
export function getAnalyticsReservationWindow(
  range: TimeRange,
  now: Date,
  custom?: DateRangeFilter,
): { start: Date; end: Date } {
  const period = getExclusiveDateRange(range, now, custom)
  const today = startOfDay(now)
  const sparkStart = addDays(today, -6)
  const twoMonthsAgo = addDays(today, -59)
  const start = new Date(Math.min(period.start.getTime(), sparkStart.getTime(), twoMonthsAgo.getTime()))
  return { start, end: period.end }
}

function bucketKey(date: Date, mode: 'hour' | 'day' | 'month'): string {
  if (mode === 'hour') {
    return `${String(date.getHours()).padStart(2, '0')}h`
  }
  if (mode === 'month') {
    return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
  }
  return `${date.getDate()}/${date.getMonth() + 1}`
}

function seriesMode(range: TimeRange, start: Date, end: Date): 'hour' | 'day' | 'month' {
  if (range === 'today') {
    return 'hour'
  }
  const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  if (range === 'semester' || range === 'year' || days > 62) {
    return 'month'
  }
  return 'day'
}

export function buildFilledSeries(
  dates: Date[],
  start: Date,
  end: Date,
  range: TimeRange,
): SeriesPoint {
  const mode = seriesMode(range, start, end)
  const labels: string[] = []
  const index = new Map<string, number>()

  if (mode === 'hour') {
    for (let hour = 0; hour < 24; hour += 1) {
      const label = `${String(hour).padStart(2, '0')}h`
      index.set(label, labels.length)
      labels.push(label)
    }
  } else if (mode === 'month') {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const last = new Date(end.getFullYear(), end.getMonth(), 1)
    while (cursor <= last) {
      const label = bucketKey(cursor, 'month')
      index.set(label, labels.length)
      labels.push(label)
      cursor.setMonth(cursor.getMonth() + 1)
    }
  } else {
    const cursor = startOfDay(start)
    while (cursor < end) {
      const label = bucketKey(cursor, 'day')
      index.set(label, labels.length)
      labels.push(label)
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  const values = labels.map(() => 0)
  for (const date of dates) {
    if (!inRange(date, start, end)) {
      continue
    }
    const key = bucketKey(date, mode)
    const at = index.get(key)
    if (at != null) {
      values[at] += 1
    }
  }

  return { labels, values }
}

function lastDaysSpark(dates: Date[], now: Date, days = 7): number[] {
  const today = startOfDay(now)
  const start = addDays(today, -(days - 1))
  const end = addDays(today, 1)
  return buildFilledSeries(dates, start, end, 'week').values
}

function countByCountry(rows: Array<{ country: string }>, countryFilter?: string): NamedCount[] {
  const grouped: Record<string, number> = {}
  for (const row of rows) {
    const country = row.country.trim() || 'Desconocido'
    if (countryFilter && country !== countryFilter) {
      continue
    }
    grouped[country] = (grouped[country] || 0) + 1
  }
  return Object.entries(grouped)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

export function buildAdminOverview(input: {
  users: AdminUserRow[]
  companies: AdminCompanyRow[]
  reservations: AdminReservationRow[]
  timeRange: TimeRange
  customRange?: DateRangeFilter
  countryFilter?: string
  now?: Date
  totals?: Partial<{
    totalUsers: number
    totalCustomers: number
    totalCompanyAccounts: number
    totalCompanies: number
    totalReservations: number
    confirmedReservations: number
    completedReservations: number
    cancelledReservations: number
    upcomingReservations: number
  }>
}): AdminOverview {
  const now = input.now ?? new Date()
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  const weekAgo = addDays(today, -6)
  const monthAgo = addDays(today, -29)
  const twoMonthsAgo = addDays(today, -59)
  const period = getExclusiveDateRange(input.timeRange, now, input.customRange)
  const country = input.countryFilter || undefined

  const users = country
    ? input.users.filter((user) => (user.country.trim() || 'Desconocido') === country)
    : input.users
  const companies = country
    ? input.companies.filter((company) => (company.country.trim() || 'Desconocido') === country)
    : input.companies
  const companyIds = new Set(companies.map((company) => company.id))
  const reservations = country
    ? input.reservations.filter((reservation) => companyIds.has(reservation.companyId))
    : input.reservations

  const customers = users.filter((user) => user.role === 'customer')
  const companyAccounts = users.filter((user) => user.role === 'company')
  const companyById = new Map(companies.map((company) => [company.id, company]))

  const newUsersToday = users.filter((user) => inRange(user.createdAt, today, tomorrow)).length
  const newUsersThisWeek = users.filter((user) => inRange(user.createdAt, weekAgo, tomorrow)).length
  const newUsersThisMonth = users.filter((user) => inRange(user.createdAt, monthAgo, tomorrow)).length
  const previousMonthUsers = users.filter((user) => inRange(user.createdAt, twoMonthsAgo, monthAgo)).length

  const newCompaniesToday = companies.filter((company) => inRange(company.createdAt, today, tomorrow)).length
  const newCompaniesThisWeek = companies.filter((company) => inRange(company.createdAt, weekAgo, tomorrow)).length
  const newCompaniesThisMonth = companies.filter((company) => inRange(company.createdAt, monthAgo, tomorrow)).length
  const previousMonthCompanies = companies.filter((company) => inRange(company.createdAt, twoMonthsAgo, monthAgo)).length

  const reservationsToday = reservations.filter((item) => inRange(item.createdAt, today, tomorrow)).length
  const reservationsThisWeek = reservations.filter((item) => inRange(item.createdAt, weekAgo, tomorrow)).length
  const reservationsThisMonth = reservations.filter((item) => inRange(item.createdAt, monthAgo, tomorrow)).length
  const previousMonthReservations = reservations.filter((item) => inRange(item.createdAt, twoMonthsAgo, monthAgo)).length

  const periodReservations = reservations.filter((item) => inRange(item.createdAt, period.start, period.end))
  const confirmed = input.totals?.confirmedReservations ?? reservations.filter((item) => item.status === 'confirmed').length
  const completed = input.totals?.completedReservations ?? reservations.filter((item) => item.status === 'completed').length
  const cancelled = input.totals?.cancelledReservations ?? reservations.filter((item) => item.status === 'cancelled').length
  const guests = reservations.reduce((sum, item) => sum + Math.max(0, item.pax), 0)
  const paidCompanies = companies.filter((company) => company.planId !== 'free').length
  const totalReservations = input.totals?.totalReservations ?? reservations.length

  const periodStatus = {
    confirmed: periodReservations.filter((item) => item.status === 'confirmed').length,
    completed: periodReservations.filter((item) => item.status === 'completed').length,
    cancelled: periodReservations.filter((item) => item.status === 'cancelled').length,
  }

  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0]
  for (const item of periodReservations) {
    const day = item.startTime.getDay()
    const index = day === 0 ? 6 : day - 1
    weekdayCounts[index] += 1
  }

  const reservationsByCompany: Record<string, number> = {}
  for (const item of periodReservations) {
    reservationsByCompany[item.companyId] = (reservationsByCompany[item.companyId] || 0) + 1
  }

  const planCounts: Record<CompanyPlanId, number> = {
    free: 0,
    basic: 0,
    premium: 0,
    premium_plus: 0,
  }
  let monthlyPlans = 0
  let perpetualPlans = 0
  for (const company of companies) {
    planCounts[company.planId] += 1
    if (company.planId === 'free') {
      continue
    }
    if (company.planBilling === 'perpetual') {
      perpetualPlans += 1
    } else {
      monthlyPlans += 1
    }
  }

  const countries = Array.from(
    new Set(
      [...input.users.map((user) => user.country.trim()), ...input.companies.map((company) => company.country.trim())]
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, 'es'))

  return {
    stats: {
      totalUsers: input.totals?.totalUsers ?? users.length,
      totalCustomers: input.totals?.totalCustomers ?? customers.length,
      totalCompanyAccounts: input.totals?.totalCompanyAccounts ?? companyAccounts.length,
      totalCompanies: input.totals?.totalCompanies ?? companies.length,
      paidCompanies,
      monthlyPlans,
      perpetualPlans,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      newCompaniesToday,
      newCompaniesThisWeek,
      newCompaniesThisMonth,
      userGrowthRate: growthRate(newUsersThisMonth, previousMonthUsers),
      companyGrowthRate: growthRate(newCompaniesThisMonth, previousMonthCompanies),
      reservationGrowthRate: growthRate(reservationsThisMonth, previousMonthReservations),
      previousMonthUsers,
      previousMonthCompanies,
      previousMonthReservations,
      totalReservations,
      reservationsToday,
      reservationsThisWeek,
      reservationsThisMonth,
      confirmedReservations: confirmed,
      completedReservations: completed,
      cancelledReservations: cancelled,
      cancellationRate: totalReservations
        ? Math.round((cancelled / totalReservations) * 1000) / 10
        : 0,
      totalGuests: guests,
      avgPartySize: reservations.length
        ? Math.round((guests / reservations.length) * 10) / 10
        : 0,
      upcomingReservations: input.totals?.upcomingReservations ?? reservations.filter(
        (item) => item.status === 'confirmed' && item.startTime >= now,
      ).length,
    },
    userGrowth: buildFilledSeries(
      customers.map((user) => user.createdAt),
      period.start,
      period.end,
      input.timeRange,
    ),
    companyGrowth: buildFilledSeries(
      companies.map((company) => company.createdAt),
      period.start,
      period.end,
      input.timeRange,
    ),
    reservationGrowth: buildFilledSeries(
      reservations.map((item) => item.createdAt),
      period.start,
      period.end,
      input.timeRange,
    ),
    userSpark: lastDaysSpark(customers.map((user) => user.createdAt), now),
    companySpark: lastDaysSpark(companies.map((company) => company.createdAt), now),
    reservationSpark: lastDaysSpark(reservations.map((item) => item.createdAt), now),
    reservationsByStatus: [
      { key: 'confirmed', label: 'Confirmadas', value: periodStatus.confirmed, color: '#2e7d6b' },
      { key: 'completed', label: 'Completadas', value: periodStatus.completed, color: '#c49a3a' },
      { key: 'cancelled', label: 'Canceladas', value: periodStatus.cancelled, color: '#e25a3c' },
    ],
    plansDistribution: COMPANY_PLANS.map((plan) => ({
      key: plan.id,
      label: plan.name,
      value: plan.id === 'premium'
        ? planCounts.premium + planCounts.premium_plus
        : planCounts[plan.id],
      color: PLAN_COLORS[plan.id],
    })),
    billingDistribution: [
      { key: 'monthly', label: 'Mensual', value: monthlyPlans, color: '#2e7d6b' },
      { key: 'perpetual', label: 'Perpetua', value: perpetualPlans, color: '#c49a3a' },
      { key: 'free', label: 'Mesa', value: planCounts.free, color: '#8a7a6e' },
    ],
    reservationsByWeekday: WEEKDAYS.map((label, index) => ({
      label,
      count: weekdayCounts[index],
    })),
    topCompanies: Object.entries(reservationsByCompany)
      .map(([id, count]) => ({
        label: companyById.get(id)?.name || 'Restaurante',
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    usersByCountry: countByCountry(customers, country),
    companiesByCountry: countByCountry(companies, country),
    countries,
  }
}

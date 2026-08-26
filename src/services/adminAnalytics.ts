import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
  type Query,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { parseCompanyPlanBilling, parseCompanyPlanId } from '../data/companyPlans'
import {
  buildAdminOverview,
  getAnalyticsReservationWindow,
  type AdminCompanyRow,
  type AdminOverview,
  type AdminReservationRow,
  type AdminUserRow,
} from '../utils/adminOverview'
import type { DateRangeFilter, ReservationStatus, TimeRange } from './adminAnalytics.types'

export type { AdminOverview, AdminOverviewStats as AdminStats } from '../utils/adminOverview'
export type { DateRangeFilter, TimeRange }
export type UserGrowthData = { labels: string[]; values: number[] }
export type CompanyGrowthData = { labels: string[]; values: number[] }
export type GeographicData = { country: string; count: number }

function toDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.()
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return date
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }
  return new Date(0)
}

function parseStatus(value: unknown): ReservationStatus {
  return value === 'cancelled' || value === 'completed' ? value : 'confirmed'
}

function mapUser(data: Record<string, unknown>): AdminUserRow {
  return {
    role: typeof data.role === 'string' ? data.role : 'customer',
    createdAt: toDate(data.createdAt),
    country: typeof data.homeCountry === 'string' ? data.homeCountry : '',
  }
}

function mapCompany(id: string, data: Record<string, unknown>): AdminCompanyRow {
  const planId = parseCompanyPlanId(data.planId)
  return {
    id,
    name: typeof data.name === 'string' ? data.name : 'Restaurante',
    createdAt: toDate(data.createdAt),
    country: typeof data.country === 'string' ? data.country : '',
    planId,
    planBilling: parseCompanyPlanBilling(data.planBilling, planId),
  }
}

function mapReservation(id: string, data: Record<string, unknown>): AdminReservationRow {
  return {
    id,
    companyId: typeof data.companyId === 'string' ? data.companyId : '',
    clientName: typeof data.clientName === 'string' ? data.clientName : '',
    pax: typeof data.pax === 'number' && data.pax > 0 ? Math.trunc(data.pax) : 0,
    status: parseStatus(data.status),
    startTime: toDate(data.startTime),
    createdAt: toDate(data.createdAt),
  }
}

async function countDocuments(target: Query): Promise<number | null> {
  try {
    const snap = await getCountFromServer(target)
    return snap.data().count
  } catch {
    return null
  }
}

export async function getAdminOverview(options: {
  timeRange: TimeRange
  customRange?: DateRangeFilter
  countryFilter?: string
}): Promise<AdminOverview> {
  const now = new Date()
  const window = getAnalyticsReservationWindow(options.timeRange, now, options.customRange)
  const countryFilter = options.countryFilter?.trim()

  const [usersSnap, companiesSnap, reservationsSnap] = await Promise.all([
    getDocs(query(
      collection(db, 'users'),
      where('createdAt', '>=', Timestamp.fromDate(window.start)),
      where('createdAt', '<', Timestamp.fromDate(window.end)),
      orderBy('createdAt', 'asc'),
      limit(200),
    )).catch(() => getDocs(query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc'),
      limit(200),
    ))),
    getDocs(query(collection(db, 'companies'), limit(200))),
    getDocs(query(
      collection(db, 'reservations'),
      where('createdAt', '>=', Timestamp.fromDate(window.start)),
      where('createdAt', '<', Timestamp.fromDate(window.end)),
      orderBy('createdAt', 'asc'),
      limit(800),
    )).catch(() => getDocs(query(
      collection(db, 'reservations'),
      where('createdAt', '>=', Timestamp.fromDate(window.start)),
      limit(800),
    ))),
  ])

  const users = usersSnap.docs.map((docSnap) => mapUser(docSnap.data()))
  const companies = companiesSnap.docs.map((docSnap) => mapCompany(docSnap.id, docSnap.data()))
  const reservations = reservationsSnap.docs.map((docSnap) => mapReservation(docSnap.id, docSnap.data()))

  let totals: Parameters<typeof buildAdminOverview>[0]['totals']
  if (!countryFilter) {
    const reservationCol = collection(db, 'reservations')
    const [
      totalUsers,
      totalCustomers,
      totalCompanyAccounts,
      totalCompanies,
      totalReservations,
      confirmedReservations,
      completedReservations,
      cancelledReservations,
      upcomingReservations,
    ] = await Promise.all([
      countDocuments(query(collection(db, 'users'))),
      countDocuments(query(collection(db, 'users'), where('role', '==', 'customer'))),
      countDocuments(query(collection(db, 'users'), where('role', '==', 'company'))),
      countDocuments(query(collection(db, 'companies'))),
      countDocuments(query(reservationCol)),
      countDocuments(query(reservationCol, where('status', '==', 'confirmed'))),
      countDocuments(query(reservationCol, where('status', '==', 'completed'))),
      countDocuments(query(reservationCol, where('status', '==', 'cancelled'))),
      countDocuments(query(
        reservationCol,
        where('status', '==', 'confirmed'),
        where('startTime', '>=', Timestamp.fromDate(now)),
      )),
    ])
    totals = {
      totalUsers: totalUsers ?? users.length,
      totalCustomers: totalCustomers ?? users.filter((user) => user.role === 'customer').length,
      totalCompanyAccounts: totalCompanyAccounts ?? users.filter((user) => user.role === 'company').length,
      totalCompanies: totalCompanies ?? companies.length,
      totalReservations: totalReservations ?? reservations.length,
      confirmedReservations: confirmedReservations ?? reservations.filter((item) => item.status === 'confirmed').length,
      completedReservations: completedReservations ?? reservations.filter((item) => item.status === 'completed').length,
      cancelledReservations: cancelledReservations ?? reservations.filter((item) => item.status === 'cancelled').length,
      upcomingReservations: upcomingReservations ?? reservations.filter((item) => item.status === 'confirmed' && item.startTime >= now).length,
    }
  }

  return buildAdminOverview({
    users,
    companies,
    reservations,
    timeRange: options.timeRange,
    customRange: options.customRange,
    countryFilter,
    now,
    totals,
  })
}

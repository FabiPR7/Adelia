import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { madridDateTime, madridYmd } from '../utils/madridDateTime.ts'
import { BILLING_LEDGER } from '../lemonsqueezy/ledger.ts'

/**
 * Informes del panel de administración entre dos fechas (días de Madrid).
 * Lee los documentos del periodo con solo los campos necesarios. Con más de
 * MAX_DOCS en una colección se avisa con `truncated` en vez de leer sin fin.
 */
const MAX_DOCS = 20000
const MAX_DAYS = 731
const YMD = /^\d{4}-\d{2}-\d{2}$/

export interface AnalyticsRange {
  from: string
  to: string
  start: Date
  end: Date
  days: number
  granularity: 'day' | 'month'
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days, 12))
  return date.toISOString().slice(0, 10)
}

export function parseAnalyticsRange(fromRaw: unknown, toRaw: unknown): AnalyticsRange | null {
  const from = String(fromRaw ?? '')
  const to = String(toRaw ?? '')
  if (!YMD.test(from) || !YMD.test(to) || from > to) {
    return null
  }
  const start = madridDateTime(from, '00:00')
  const end = madridDateTime(addDays(to, 1), '00:00')
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  if (!Number.isFinite(days) || days < 1 || days > MAX_DAYS) {
    return null
  }
  return { from, to, start, end, days, granularity: days <= 92 ? 'day' : 'month' }
}

function bucketKeys(range: AnalyticsRange): string[] {
  const keys: string[] = []
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
    const key = range.granularity === 'day' ? day : day.slice(0, 7)
    if (keys[keys.length - 1] !== key) keys.push(key)
  }
  return keys
}

function asDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Nombre de sitio normalizado para agrupar («  madrid » y «Madrid» son el mismo). */
function placeName(value: unknown, fallback: string): string {
  const name = str(value).replace(/\s+/g, ' ')
  if (!name) return fallback
  return name.charAt(0).toLocaleUpperCase('es') + name.slice(1)
}

async function loadRange(
  collection: string,
  field: string,
  start: Date,
  end: Date,
  fields: string[] | null,
  iso = false,
) {
  let query = adminDb.collection(collection)
    .where(field, '>=', iso ? start.toISOString() : Timestamp.fromDate(start))
    .where(field, '<', iso ? end.toISOString() : Timestamp.fromDate(end))
  if (fields) query = query.select(...fields)
  const snap = await query.limit(MAX_DOCS).get()
  return { docs: snap.docs, truncated: snap.size >= MAX_DOCS }
}

function countBy<T>(items: T[], keyOf: (item: T) => string): Array<{ name: string; count: number }> {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyOf(item)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
}

function isRevenueRow(data: FirebaseFirestore.DocumentData, includeTest: boolean): boolean {
  return (data.status === 'paid' || data.status === 'refunded') && (includeTest || data.testMode !== true)
}

export async function computeAdminAnalytics(range: AnalyticsRange, includeTest: boolean) {
  const prevStart = new Date(range.start.getTime() - range.days * 86_400_000)
  const prevFrom = madridYmd(prevStart)
  const prevTo = addDays(range.from, -1)

  const [users, companiesSnap, reservations, claims, reviews, ledger, prevUsers, prevLedger, prevReservations] = await Promise.all([
    loadRange('users', 'createdAt', range.start, range.end, ['role', 'createdAt', 'homeCountry', 'homeCity', 'homeMunicipality']),
    adminDb.collection('companies')
      .select('name', 'municipality', 'country', 'planId', 'createdAt', 'deactivated')
      .limit(MAX_DOCS)
      .get(),
    loadRange('reservations', 'startTime', range.start, range.end, ['status', 'noShow', 'cancelledBy', 'pax', 'companyId', 'promotionId', 'customerUid', 'startTime']),
    loadRange('promotionClaims', 'claimedAt', range.start, range.end, ['companyId', 'claimedAt'], true),
    loadRange('reviewIndex', 'createdAt', range.start, range.end, ['companyId', 'rating', 'createdAt']),
    loadRange(BILLING_LEDGER, 'paidAt', range.start, range.end, null),
    loadRange('users', 'createdAt', prevStart, range.start, ['role']),
    loadRange(BILLING_LEDGER, 'paidAt', prevStart, range.start, ['status', 'testMode', 'netCents']),
    adminDb.collection('reservations')
      .where('startTime', '>=', Timestamp.fromDate(prevStart))
      .where('startTime', '<', Timestamp.fromDate(range.start))
      .count().get().then((snap) => snap.data().count).catch(() => 0),
  ])

  const companies = new Map(companiesSnap.docs.map((doc) => [doc.id, doc.data()]))
  const keys = bucketKeys(range)
  const index = new Map(keys.map((key, i) => [key, i]))
  const series = keys.map((key) => ({
    key,
    reservations: 0,
    cancelled: 0,
    noShows: 0,
    pax: 0,
    newCustomers: 0,
    newCompanies: 0,
    revenueCents: 0,
    claims: 0,
  }))
  const bucketOf = (date: Date | null) => {
    if (!date) return null
    const day = madridYmd(date)
    const i = index.get(range.granularity === 'day' ? day : day.slice(0, 7))
    return i === undefined ? null : series[i]
  }

  // Altas
  const newCustomerDocs = users.docs.filter((doc) => doc.data().role === 'customer')
  for (const doc of newCustomerDocs) {
    const bucket = bucketOf(asDate(doc.data().createdAt))
    if (bucket) bucket.newCustomers += 1
  }
  let newCompanies = 0
  for (const [, data] of companies) {
    const created = asDate(data.createdAt)
    if (created && created >= range.start && created < range.end) {
      newCompanies += 1
      const bucket = bucketOf(created)
      if (bucket) bucket.newCompanies += 1
    }
  }

  // Reservas
  type CompanyRow = { reservations: number; pax: number; cancelled: number; noShows: number; attended: number; claims: number; reviews: number; ratingSum: number; revenueCents: number }
  const perCompany = new Map<string, CompanyRow>()
  const rowFor = (companyId: string) => {
    let row = perCompany.get(companyId)
    if (!row) {
      row = { reservations: 0, pax: 0, cancelled: 0, noShows: 0, attended: 0, claims: 0, reviews: 0, ratingSum: 0, revenueCents: 0 }
      perCompany.set(companyId, row)
    }
    return row
  }
  const status = { attended: 0, pending: 0, cancelledByClient: 0, cancelledByRestaurant: 0, noShows: 0 }
  let pax = 0
  let withPromotion = 0
  let withAccount = 0
  const byHour = Array(24).fill(0)
  const byWeekday = Array(7).fill(0)
  const byCity = new Map<string, { reservations: number; pax: number }>()
  for (const doc of reservations.docs) {
    const data = doc.data()
    const start = asDate(data.startTime)
    const people = Math.max(0, Math.min(500, num(data.pax)))
    const companyId = str(data.companyId)
    const row = rowFor(companyId)
    const bucket = bucketOf(start)
    row.reservations += 1
    row.pax += people
    pax += people
    if (bucket) {
      bucket.reservations += 1
      bucket.pax += people
    }
    if (data.status === 'cancelled') {
      if (data.noShow === true) {
        status.noShows += 1
        row.noShows += 1
        if (bucket) bucket.noShows += 1
      } else if (data.cancelledBy === 'client') {
        status.cancelledByClient += 1
      } else {
        status.cancelledByRestaurant += 1
      }
      if (data.noShow !== true) {
        row.cancelled += 1
        if (bucket) bucket.cancelled += 1
      }
    } else if (data.status === 'confirmed') {
      status.attended += 1
      row.attended += 1
    } else {
      status.pending += 1
    }
    if (str(data.promotionId)) withPromotion += 1
    if (str(data.customerUid)) withAccount += 1
    if (start) {
      byHour[Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(start)) % 24] += 1
      byWeekday[(new Date(`${madridYmd(start)}T12:00:00Z`).getUTCDay() + 6) % 7] += 1
    }
    const city = placeName(companies.get(companyId)?.municipality, 'Sin ciudad')
    const cityRow = byCity.get(city) ?? { reservations: 0, pax: 0 }
    cityRow.reservations += 1
    cityRow.pax += people
    byCity.set(city, cityRow)
  }

  for (const doc of claims.docs) {
    const data = doc.data()
    rowFor(str(data.companyId)).claims += 1
    const bucket = bucketOf(asDate(data.claimedAt))
    if (bucket) bucket.claims += 1
  }

  let ratingSum = 0
  for (const doc of reviews.docs) {
    const data = doc.data()
    const rating = num(data.rating)
    ratingSum += rating
    const row = rowFor(str(data.companyId))
    row.reviews += 1
    row.ratingSum += rating
  }

  // Ingresos
  const revenueRows = ledger.docs.filter((doc) => isRevenueRow(doc.data(), includeTest))
  const byMonth = new Map<string, { invoices: number; grossCents: number; taxCents: number; refundsCents: number; netCents: number }>()
  const byPlan = new Map<string, { invoices: number; netCents: number }>()
  let grossCents = 0
  let taxCents = 0
  let refundsCents = 0
  let netCents = 0
  for (const doc of revenueRows) {
    const data = doc.data()
    const paidAt = asDate(data.paidAt)
    const month = paidAt ? madridYmd(paidAt).slice(0, 7) : 'sin fecha'
    const monthRow = byMonth.get(month) ?? { invoices: 0, grossCents: 0, taxCents: 0, refundsCents: 0, netCents: 0 }
    monthRow.invoices += 1
    monthRow.grossCents += num(data.totalCents)
    monthRow.taxCents += num(data.taxCents)
    monthRow.refundsCents += num(data.refundedCents)
    monthRow.netCents += num(data.netCents)
    byMonth.set(month, monthRow)
    const plan = str(data.planId) || 'otro'
    const planRow = byPlan.get(plan) ?? { invoices: 0, netCents: 0 }
    planRow.invoices += 1
    planRow.netCents += num(data.netCents)
    byPlan.set(plan, planRow)
    grossCents += num(data.totalCents)
    taxCents += num(data.taxCents)
    refundsCents += num(data.refundedCents)
    netCents += num(data.netCents)
    const bucket = bucketOf(paidAt)
    if (bucket) bucket.revenueCents += num(data.netCents)
    if (str(data.companyId)) rowFor(str(data.companyId)).revenueCents += num(data.netCents)
  }
  const failedPayments = ledger.docs.filter((doc) => doc.data().status === 'failed' && (includeTest || doc.data().testMode !== true)).length

  const invoices = ledger.docs
    .filter((doc) => includeTest || doc.data().testMode !== true)
    .map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        paidAt: asDate(data.paidAt)?.toISOString() ?? null,
        companyId: str(data.companyId),
        companyName: str(data.companyName) || str(data.customerName) || str(data.customerEmail),
        customerEmail: str(data.customerEmail),
        planId: str(data.planId),
        kind: str(data.kind),
        status: str(data.status),
        currency: str(data.currency) || 'EUR',
        totalCents: num(data.totalCents),
        taxCents: num(data.taxCents),
        refundedCents: num(data.refundedCents),
        netCents: num(data.netCents),
        invoiceUrl: str(data.invoiceUrl),
        testMode: data.testMode === true,
      }
    })
    .sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)))
    .slice(0, 500)

  const prevNetCents = prevLedger.docs
    .filter((doc) => isRevenueRow(doc.data(), includeTest))
    .reduce((sum, doc) => sum + num(doc.data().netCents), 0)

  const topCompanies = [...perCompany.entries()]
    .filter(([id]) => id && companies.has(id))
    .map(([id, row]) => {
      const data = companies.get(id) ?? {}
      return {
        id,
        name: str(data.name) || 'Local',
        municipality: str(data.municipality),
        planId: str(data.planId) || 'free',
        ...row,
        avgRating: row.reviews > 0 ? Math.round((row.ratingSum / row.reviews) * 10) / 10 : null,
      }
    })
    .sort((a, b) => b.reservations - a.reservations || b.revenueCents - a.revenueCents)
    .slice(0, 25)

  const totalReservations = reservations.docs.length
  return {
    generatedAt: new Date().toISOString(),
    range: { from: range.from, to: range.to, days: range.days, granularity: range.granularity },
    previous: { from: prevFrom, to: prevTo },
    includeTest,
    truncated: [users, reservations, claims, reviews, ledger].some((item) => item.truncated),
    kpis: {
      revenueNetCents: netCents,
      revenueGrossCents: grossCents,
      taxCents,
      refundsCents,
      invoices: revenueRows.length,
      failedPayments,
      avgTicketCents: revenueRows.length > 0 ? Math.round(grossCents / revenueRows.length) : 0,
      newCustomers: newCustomerDocs.length,
      newCompanies,
      reservations: totalReservations,
      pax,
      ...status,
      withPromotion,
      withAccount,
      claims: claims.docs.length,
      reviews: reviews.docs.length,
      avgRating: reviews.docs.length > 0 ? Math.round((ratingSum / reviews.docs.length) * 10) / 10 : null,
      prev: {
        revenueNetCents: prevNetCents,
        newCustomers: prevUsers.docs.filter((doc) => doc.data().role === 'customer').length,
        reservations: prevReservations,
      },
    },
    series,
    byHour,
    byWeekday,
    revenueByMonth: [...byMonth.entries()].map(([month, row]) => ({ month, ...row })).sort((a, b) => a.month.localeCompare(b.month)),
    revenueByPlan: [...byPlan.entries()].map(([planId, row]) => ({ planId, ...row })).sort((a, b) => b.netCents - a.netCents),
    invoices,
    topCompanies,
    reservationsByCity: [...byCity.entries()].map(([city, row]) => ({ city, ...row })).sort((a, b) => b.reservations - a.reservations).slice(0, 30),
    newCustomersByCountry: countBy(newCustomerDocs, (doc) => placeName(doc.data().homeCountry, 'Sin país')).slice(0, 30),
    newCustomersByCity: countBy(newCustomerDocs, (doc) => placeName(doc.data().homeCity ?? doc.data().homeMunicipality, 'Sin ciudad')).slice(0, 30),
  }
}

/** Mapa de toda la base: clientes por país y ciudad, restaurantes por ciudad. */
export async function computeAdminGeography() {
  const [customers, companiesSnap] = await Promise.all([
    adminDb.collection('users').where('role', '==', 'customer')
      .select('homeCountry', 'homeCity', 'homeMunicipality', 'blocked')
      .limit(100000).get(),
    adminDb.collection('companies').select('municipality', 'country', 'planId', 'deactivated').limit(MAX_DOCS).get(),
  ])
  const countries = new Map<string, { customers: number; cities: Map<string, number> }>()
  for (const doc of customers.docs) {
    const data = doc.data()
    const country = placeName(data.homeCountry, 'Sin país')
    const city = placeName(data.homeCity ?? data.homeMunicipality, 'Sin ciudad')
    const entry = countries.get(country) ?? { customers: 0, cities: new Map<string, number>() }
    entry.customers += 1
    entry.cities.set(city, (entry.cities.get(city) ?? 0) + 1)
    countries.set(country, entry)
  }
  const companyCities = new Map<string, { companies: number; paid: number; active: number; country: string }>()
  for (const doc of companiesSnap.docs) {
    const data = doc.data()
    const city = placeName(data.municipality, 'Sin ciudad')
    const entry = companyCities.get(city) ?? { companies: 0, paid: 0, active: 0, country: placeName(data.country, 'Sin país') }
    entry.companies += 1
    if (str(data.planId) && data.planId !== 'free') entry.paid += 1
    if (data.deactivated !== true) entry.active += 1
    companyCities.set(city, entry)
  }
  return {
    generatedAt: new Date().toISOString(),
    totalCustomers: customers.size,
    totalCompanies: companiesSnap.size,
    customersByCountry: [...countries.entries()]
      .map(([country, entry]) => ({
        country,
        customers: entry.customers,
        cities: [...entry.cities.entries()].map(([city, count]) => ({ city, customers: count })).sort((a, b) => b.customers - a.customers).slice(0, 50),
      }))
      .sort((a, b) => b.customers - a.customers),
    companiesByCity: [...companyCities.entries()].map(([city, entry]) => ({ city, ...entry })).sort((a, b) => b.companies - a.companies),
  }
}

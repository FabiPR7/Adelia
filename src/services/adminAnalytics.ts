import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore'
import { db } from '../config/firebase'

export interface AdminStats {
  totalUsers: number
  totalCustomers: number
  totalCompanies: number
  newUsersToday: number
  newUsersThisWeek: number
  newUsersThisMonth: number
  newCompaniesToday: number
  newCompaniesThisWeek: number
  newCompaniesThisMonth: number
  // Comparativas con periodo anterior
  userGrowthRate: number // % crecimiento mes vs mes anterior
  companyGrowthRate: number // % crecimiento mes vs mes anterior
  previousMonthUsers: number
  previousMonthCompanies: number
}

export interface UserGrowthData {
  labels: string[]
  values: number[]
}

export interface CompanyGrowthData {
  labels: string[]
  values: number[]
}

export interface GeographicData {
  country: string
  count: number
}

export type TimeRange = 
  | 'today'
  | 'week'
  | 'month'
  | 'quarter'
  | 'semester'
  | 'year'
  | 'custom'

export interface DateRangeFilter {
  startDate: Date
  endDate: Date
}

function getDateRangeForTimeRange(range: TimeRange): DateRangeFilter {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  switch (range) {
    case 'today':
      return {
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    
    case 'week': {
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return { startDate: weekAgo, endDate: today }
    }
    
    case 'month': {
      const monthAgo = new Date(today)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return { startDate: monthAgo, endDate: today }
    }
    
    case 'quarter': {
      const quarterAgo = new Date(today)
      quarterAgo.setMonth(quarterAgo.getMonth() - 3)
      return { startDate: quarterAgo, endDate: today }
    }
    
    case 'semester': {
      const semesterAgo = new Date(today)
      semesterAgo.setMonth(semesterAgo.getMonth() - 6)
      return { startDate: semesterAgo, endDate: today }
    }
    
    case 'year': {
      const yearAgo = new Date(today)
      yearAgo.setFullYear(yearAgo.getFullYear() - 1)
      return { startDate: yearAgo, endDate: today }
    }
    
    default:
      return { startDate: today, endDate: today }
  }
}

function mapUserDoc(data: Record<string, unknown>): { role: string; createdAt: Date; country: string } {
  return {
    role: (data.role as string) ?? 'customer',
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    country: (data.homeCountry as string) ?? 'Unknown',
  }
}

function mapCompanyDoc(data: Record<string, unknown>): { createdAt: Date; country: string } {
  return {
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    country: (data.country as string) ?? 'Unknown',
  }
}

export async function getAdminStats(): Promise<AdminStats> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date(today)
  monthAgo.setMonth(monthAgo.getMonth() - 1)
  const twoMonthsAgo = new Date(today)
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

  const [usersSnap, companiesSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'companies')),
  ])

  const users = usersSnap.docs.map(doc => mapUserDoc(doc.data()))
  const companies = companiesSnap.docs.map(doc => mapCompanyDoc(doc.data()))

  const customers = users.filter(u => u.role === 'customer')
  
  const newUsersToday = users.filter(u => u.createdAt >= today).length
  const newUsersThisWeek = users.filter(u => u.createdAt >= weekAgo).length
  const newUsersThisMonth = users.filter(u => u.createdAt >= monthAgo && u.createdAt < today).length
  const previousMonthUsers = users.filter(u => u.createdAt >= twoMonthsAgo && u.createdAt < monthAgo).length
  
  const newCompaniesToday = companies.filter(c => c.createdAt >= today).length
  const newCompaniesThisWeek = companies.filter(c => c.createdAt >= weekAgo).length
  const newCompaniesThisMonth = companies.filter(c => c.createdAt >= monthAgo && c.createdAt < today).length
  const previousMonthCompanies = companies.filter(c => c.createdAt >= twoMonthsAgo && c.createdAt < monthAgo).length

  // Calcular tasas de crecimiento
  const userGrowthRate = previousMonthUsers > 0
    ? ((newUsersThisMonth - previousMonthUsers) / previousMonthUsers) * 100
    : newUsersThisMonth > 0 ? 100 : 0

  const companyGrowthRate = previousMonthCompanies > 0
    ? ((newCompaniesThisMonth - previousMonthCompanies) / previousMonthCompanies) * 100
    : newCompaniesThisMonth > 0 ? 100 : 0

  return {
    totalUsers: users.length,
    totalCustomers: customers.length,
    totalCompanies: companies.length,
    newUsersToday,
    newUsersThisWeek,
    newUsersThisMonth,
    newCompaniesToday,
    newCompaniesThisWeek,
    newCompaniesThisMonth,
    userGrowthRate: Math.round(userGrowthRate * 10) / 10,
    companyGrowthRate: Math.round(companyGrowthRate * 10) / 10,
    previousMonthUsers,
    previousMonthCompanies,
  }
}

export async function getUserGrowthData(
  timeRange: TimeRange,
  customRange?: DateRangeFilter
): Promise<UserGrowthData> {
  const dateRange = customRange ?? getDateRangeForTimeRange(timeRange)
  
  const usersSnap = await getDocs(
    query(
      collection(db, 'users'),
      where('createdAt', '>=', Timestamp.fromDate(dateRange.startDate)),
      where('createdAt', '<=', Timestamp.fromDate(dateRange.endDate))
    )
  )

  const users = usersSnap.docs
    .map(doc => mapUserDoc(doc.data()))
    .filter(u => u.role === 'customer')

  // Group by date
  const grouped = groupByDate(users.map(u => u.createdAt), timeRange)
  
  return {
    labels: grouped.labels,
    values: grouped.values,
  }
}

export async function getCompanyGrowthData(
  timeRange: TimeRange,
  customRange?: DateRangeFilter
): Promise<CompanyGrowthData> {
  const dateRange = customRange ?? getDateRangeForTimeRange(timeRange)
  
  const companiesSnap = await getDocs(
    query(
      collection(db, 'companies'),
      where('createdAt', '>=', Timestamp.fromDate(dateRange.startDate)),
      where('createdAt', '<=', Timestamp.fromDate(dateRange.endDate))
    )
  )

  const companies = companiesSnap.docs.map(doc => mapCompanyDoc(doc.data()))

  const grouped = groupByDate(companies.map(c => c.createdAt), timeRange)
  
  return {
    labels: grouped.labels,
    values: grouped.values,
  }
}

export async function getUsersByCountry(countryFilter?: string): Promise<GeographicData[]> {
  const usersSnap = await getDocs(collection(db, 'users'))
  
  const users = usersSnap.docs
    .map(doc => mapUserDoc(doc.data()))
    .filter(u => u.role === 'customer')

  const grouped = users.reduce((acc, user) => {
    const country = user.country || 'Desconocido'
    if (countryFilter && country !== countryFilter) {
      return acc
    }
    acc[country] = (acc[country] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return Object.entries(grouped)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
}

export async function getCompaniesByCountry(countryFilter?: string): Promise<GeographicData[]> {
  const companiesSnap = await getDocs(collection(db, 'companies'))
  
  const companies = companiesSnap.docs.map(doc => mapCompanyDoc(doc.data()))

  const grouped = companies.reduce((acc, company) => {
    const country = company.country || 'Desconocido'
    if (countryFilter && country !== countryFilter) {
      return acc
    }
    acc[country] = (acc[country] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return Object.entries(grouped)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
}

function groupByDate(
  dates: Date[],
  timeRange: TimeRange
): { labels: string[]; values: number[] } {
  if (dates.length === 0) {
    return { labels: [], values: [] }
  }

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
  const grouped: Record<string, number> = {}

  for (const date of sorted) {
    let key: string
    
    switch (timeRange) {
      case 'today':
      case 'week':
        // Group by day
        key = `${date.getDate()}/${date.getMonth() + 1}`
        break
      
      case 'month':
      case 'quarter':
        // Group by day
        key = `${date.getDate()}/${date.getMonth() + 1}`
        break
      
      case 'semester':
      case 'year':
        // Group by month
        key = `${getMonthName(date.getMonth())} ${date.getFullYear()}`
        break
      
      default:
        key = date.toISOString().split('T')[0]
    }
    
    grouped[key] = (grouped[key] || 0) + 1
  }

  const labels = Object.keys(grouped)
  const values = Object.values(grouped)

  return { labels, values }
}

function getMonthName(month: number): string {
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ]
  return months[month]
}

export async function getAllCountries(): Promise<string[]> {
  const [usersSnap, companiesSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'companies')),
  ])

  const countries = new Set<string>()

  usersSnap.docs.forEach(doc => {
    const country = (doc.data().homeCountry as string) ?? ''
    if (country) countries.add(country)
  })

  companiesSnap.docs.forEach(doc => {
    const country = (doc.data().country as string) ?? ''
    if (country) countries.add(country)
  })

  return Array.from(countries).sort()
}

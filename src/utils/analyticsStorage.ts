import type { TimeRange } from '../services/adminAnalytics'

const STORAGE_KEY = 'adelia-admin-analytics-filters'

interface AnalyticsFilters {
  timeRange: TimeRange
  countryFilter: string
}

export function saveAnalyticsFilters(filters: AnalyticsFilters): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
  } catch (error) {
    console.warn('Failed to save analytics filters:', error)
  }
}

export function loadAnalyticsFilters(): AnalyticsFilters | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as AnalyticsFilters
  } catch (error) {
    console.warn('Failed to load analytics filters:', error)
    return null
  }
}

export function clearAnalyticsFilters(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to clear analytics filters:', error)
  }
}

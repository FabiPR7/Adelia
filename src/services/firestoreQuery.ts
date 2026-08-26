export const DISCOVERY_INDEX_LIMIT = 250
export const ADMIN_LIST_PAGE_SIZE = 80
export const ADMIN_EVENTS_PAGE_SIZE = 80
export const ADMIN_REVIEWS_PAGE_SIZE = 50
export const ADMIN_COMPANY_LIST_LIMIT = 200
export const CUSTOMER_RESERVATION_LIMIT = 80
export const COMPANY_REVIEW_PAGE_SIZE = 60
export const COMPANY_RESERVATION_QUERY_LIMIT = 400
export const COMPANY_RESERVATION_RANGE_LIMIT = 800
export const COMPANY_TABLE_LIMIT = 80
export const COMPANY_PROMOTION_LIMIT = 40
export const COMPANY_MENU_BOARD_LIMIT = 12
export const GAMIFICATION_RESERVATION_DAYS = 62
export const COMPANY_CLIENT_RESERVATION_LIMIT = 80
export const RESERVATION_QUERY_CACHE_MS = 15_000

export function startOfCalendarDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addCalendarDays(date: Date, days: number): Date {
  const next = startOfCalendarDay(date)
  next.setDate(next.getDate() + days)
  return next
}

export function monthBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  return { start, end }
}

export function dayBounds(date: Date): { start: Date; end: Date } {
  const start = startOfCalendarDay(date)
  return { start, end: addCalendarDays(start, 1) }
}

export function yearBounds(year: number): { start: Date; end: Date } {
  return {
    start: new Date(year, 0, 1),
    end: new Date(year + 1, 0, 1),
  }
}

export function recentDaysBounds(days: number, now = new Date()): { start: Date; end: Date } {
  const end = addCalendarDays(now, 1)
  return { start: addCalendarDays(now, -days), end }
}

export function reportYearOptions(now = new Date(), count = 6): number[] {
  return Array.from({ length: count }, (_, index) => now.getFullYear() - index)
}

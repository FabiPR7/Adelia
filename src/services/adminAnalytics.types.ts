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

export type ReservationStatus = 'confirmed' | 'cancelled' | 'completed'

import type { CompanyReview } from '../types/review'
import {
  getReportDateRange,
  type DateRange,
  type ReportPeriodConfig,
} from './reservationReports'

export { formatReportPeriodLabel, getReportDateRange } from './reservationReports'
export type { ReportGranularity, ReportPeriodConfig } from './reservationReports'

export function filterReviewsInRange(reviews: CompanyReview[], range: DateRange): CompanyReview[] {
  return reviews.filter((review) => {
    const time = review.createdAt.getTime()
    return time >= range.start.getTime() && time < range.end.getTime()
  })
}

export function getReviewReportYears(reviews: CompanyReview[]): number[] {
  const years = new Set(reviews.map((review) => review.createdAt.getFullYear()))
  return [...years].sort((left, right) => right - left)
}

export interface ReviewReportKpis {
  total: number
  average: number
  adelinas: number
  withPhoto: number
  withReply: number
  replyRate: number
}

export function computeReviewKpis(reviews: CompanyReview[]): ReviewReportKpis {
  const total = reviews.length
  const ratingSum = reviews.reduce((sum, review) => sum + review.rating, 0)
  const adelinas = reviews.reduce((sum, review) => sum + review.adelinasEarned, 0)
  const withPhoto = reviews.filter((review) => review.hasPhoto).length
  const withReply = reviews.filter((review) => Boolean(review.ownerReply?.text.trim())).length
  return {
    total,
    average: total > 0 ? ratingSum / total : 0,
    adelinas,
    withPhoto,
    withReply,
    replyRate: total > 0 ? withReply / total : 0,
  }
}

export interface RatingDistribution {
  labels: string[]
  values: number[]
  max: number
}

export function computeRatingDistribution(reviews: CompanyReview[]): RatingDistribution {
  const values = [1, 2, 3, 4, 5].map((rating) => reviews.filter((review) => review.rating === rating).length)
  return {
    labels: ['1', '2', '3', '4', '5'],
    values,
    max: Math.max(1, ...values),
  }
}

export interface ReviewTrendPoint {
  labels: string[]
  reviews: number[]
  adelinas: number[]
}

export function computeReviewTrend(
  reviews: CompanyReview[],
  period: ReportPeriodConfig,
): ReviewTrendPoint {
  const range = getReportDateRange(period)
  if (period.granularity === 'annual') {
    const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const reviewsValues = Array.from({ length: 12 }, () => 0)
    const adelinasValues = Array.from({ length: 12 }, () => 0)
    for (const review of reviews) {
      if (review.createdAt < range.start || review.createdAt >= range.end) continue
      const month = review.createdAt.getMonth()
      reviewsValues[month] += 1
      adelinasValues[month] += review.adelinasEarned
    }
    return { labels, reviews: reviewsValues, adelinas: adelinasValues }
  }

  if (period.granularity === 'quarterly') {
    const labels = ['Mes 1', 'Mes 2', 'Mes 3']
    const reviewsValues = [0, 0, 0]
    const adelinasValues = [0, 0, 0]
    for (const review of reviews) {
      if (review.createdAt < range.start || review.createdAt >= range.end) continue
      const index = review.createdAt.getMonth() - range.start.getMonth()
      if (index >= 0 && index < 3) {
        reviewsValues[index] += 1
        adelinasValues[index] += review.adelinasEarned
      }
    }
    return { labels, reviews: reviewsValues, adelinas: adelinasValues }
  }

  const days = new Date(period.year, period.month, 0).getDate()
  const labels = Array.from({ length: days }, (_, index) => String(index + 1))
  const reviewsValues = Array.from({ length: days }, () => 0)
  const adelinasValues = Array.from({ length: days }, () => 0)
  for (const review of reviews) {
    if (review.createdAt < range.start || review.createdAt >= range.end) continue
    const day = review.createdAt.getDate() - 1
    reviewsValues[day] += 1
    adelinasValues[day] += review.adelinasEarned
  }
  return { labels, reviews: reviewsValues, adelinas: adelinasValues }
}

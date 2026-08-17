import { getIdToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface CustomerReviewSummary {
  id: string
  companyId: string
  companyName: string
  companySlug: string
  rating: number
  hasPhoto: boolean
  commentExcerpt: string
  createdAt: string
}

export async function listMyReviews(): Promise<CustomerReviewSummary[]> {
  const token = await getIdToken()
  if (!token) {
    return []
  }

  try {
    const response = await fetch(`${API_BASE}/api/customer/reviews`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      return []
    }
    const data = await response.json() as { reviews?: CustomerReviewSummary[] }
    return Array.isArray(data.reviews) ? data.reviews : []
  } catch {
    return []
  }
}

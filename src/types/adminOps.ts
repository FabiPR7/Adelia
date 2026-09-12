export interface AdminCustomerRow {
  id: string
  displayName: string
  email: string
  phone: string
  phoneVerified: boolean
  onboardingCompleted: boolean
  homeCity: string
  homeCountry: string
  createdAt: Date
  blocked: boolean
  xp: number
  adelinas: number
  reservationCount: number
}

export interface IndexedReview {
  id: string
  companyId: string
  companyName: string
  companySlug: string
  customerUid: string
  rating: number
  hasPhoto: boolean
  commentExcerpt: string
  createdAt: Date
}

export interface AdminSecurityEvent {
  id: string
  type: string
  severity: string
  email: string
  resource: string
  action: string
  timestamp: Date
}

export interface AdminLoginLock {
  id: string
  attemptCount: number
  lockedUntil: Date | null
  lastAttemptAt: Date | null
}

export interface AdminMissionRow {
  id: string
  name: string
  description: string
  xp: number
  target: number
  cadence: string
  category: string
  icon: string
}

export interface SaasSubscriptionLead {
  id: string
  planName: string
  planId: string
  status: string
  customerEmail: string
  restaurantName: string
  city: string
  amountTotal: number
  currency: string
  livemode: boolean
  createdAt: Date | null
}

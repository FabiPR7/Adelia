import { FieldValue } from 'firebase-admin/firestore'

export function defaultCustomerGamification() {
  return {
    xp: 0,
    adelinas: 0,
    completedMissions: [] as string[],
    visitedCompanyIds: [] as string[],
    weekKey: '',
    weeklyCompleted: [] as string[],
    monthKey: '',
    monthlyCompleted: [] as string[],
    reviewsCount: 0,
    reviewsWithPhotoCount: 0,
    textReviewsCount: 0,
    reviewedReservationIds: [] as string[],
    reviewedCompanyIds: [] as string[],
    redemptionsCount: 0,
    helpfulReviewVotes: 0,
    favoritesAddedThisWeek: 0,
    favoriteSlugsAtWeekStart: [] as string[],
    awardedReservationXpIds: [] as string[],
    claimedPromotions: [] as unknown[],
    ladderBaselinesByCompany: {} as Record<string, number>,
    activeLadderPromotionByCompany: {} as Record<string, string>,
    ladderCompletionsByCompany: {} as Record<string, number>,
    lastCelebratedLevel: null as number | null,
    celebratedMissionIds: [] as string[],
    celebrationsBootstrapped: false,
    cancellationStrikeCount: 0,
    cancelledReservationIds: [] as string[],
    xpPenaltyTotal: 0,
    promoLocked: false,
    inventory: {} as Record<string, number>,
    grantedItemKeys: [] as string[],
    tokenCreditsByCompany: {} as Record<string, number>,
    pendingTokenSpend: [] as unknown[],
  }
}

export function buildCustomerProfileDoc(input: {
  email: string
  displayName: string
  phone: string
  phoneVerified: boolean
  authProvider: 'password' | 'google.com'
  photoUrl?: string
}) {
  const displayName = input.displayName.trim()
  return {
    email: input.email.trim().toLowerCase(),
    role: 'customer' as const,
    companyId: null,
    displayName,
    displayNameLower: displayName.toLowerCase(),
    phone: input.phone,
    phoneVerified: input.phoneVerified,
    photoUrl: input.photoUrl ?? '',
    homeCity: '',
    homeMunicipality: '',
    homeCountry: '',
    homePostalCode: '',
    homeLatitude: null,
    homeLongitude: null,
    foodPreferences: [] as string[],
    onboardingCompleted: false,
    authProvider: input.authProvider,
    favoriteSlugs: [] as string[],
    gamification: defaultCustomerGamification(),
    xp: 0,
    adelinas: 0,
    mustChangePassword: false,
    blocked: false,
    createdAt: FieldValue.serverTimestamp(),
  }
}

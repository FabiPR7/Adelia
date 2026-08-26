import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from '../data/collections.ts'
import {
  processCompanyGamification,
  readCompanyGamificationState,
  type CompanyReviewRow,
  type CompanyVisit,
} from './companyProgress.ts'
import { getCompanyLevelForXp, getCompanyXpToNext } from './companyCatalog.ts'
import {
  companyGamificationRef,
  notifyCompanyGamificationChanges,
} from '../notifications/companyNotifications.ts'

function asDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  if (value instanceof Timestamp) {
    return value.toDate()
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }
  return new Date(0)
}

const COMPANY_LEVEL_COLORS: Record<number, [string, string]> = {
  1: ['#F4E6D4', '#C4A574'],
  2: ['#34D399', '#059669'],
  3: ['#60A5FA', '#2563EB'],
  4: ['#A78BFA', '#6D28D9'],
  5: ['#F97316', '#C2410C'],
  6: ['#FBBF24', '#B45309'],
  7: ['#F43F5E', '#9F1239'],
  8: ['#FB7185', '#7C2D12'],
  9: ['#22D3EE', '#0E7490'],
  10: ['#E879F9', '#BE185D'],
}

export function companyGamificationPayload(state: ReturnType<typeof processCompanyGamification>) {
  const level = getCompanyLevelForXp(state.xp)
  return {
    state,
    level: {
      ...level,
      colors: COMPANY_LEVEL_COLORS[level.level] ?? COMPANY_LEVEL_COLORS[1],
      styleClass: `companyLevel${level.level}`,
    },
    xpToNext: getCompanyXpToNext(state.xp, level),
  }
}

async function loadCompanyContext(companyId: string) {
  const companyRef = adminDb.collection(COLLECTIONS.companies).doc(companyId)
  const since = Timestamp.fromDate(new Date(Date.now() - 62 * 24 * 60 * 60 * 1000))
  const reservationsQuery = adminDb
    .collection(COLLECTIONS.reservations)
    .where('companyId', '==', companyId)
    .where('startTime', '>=', since)
    .limit(400)
  const [companySnap, reservationsSnap, reviewsSnap, promotionsSnap, confirmedCountSnap] = await Promise.all([
    companyRef.get(),
    reservationsQuery.get().catch(() =>
      adminDb.collection(COLLECTIONS.reservations).where('companyId', '==', companyId).limit(400).get(),
    ),
    companyRef.collection('reviews').orderBy('createdAt', 'desc').limit(60).get().catch(() =>
      companyRef.collection('reviews').limit(60).get(),
    ),
    companyRef.collection('promotions').where('active', '==', true).limit(40).get(),
    adminDb.collection(COLLECTIONS.reservations)
      .where('companyId', '==', companyId)
      .where('status', '==', 'confirmed')
      .count()
      .get()
      .catch(() => null),
  ])

  if (!companySnap.exists) {
    throw new Error('Restaurante no encontrado.')
  }

  const company = companySnap.data()!
  const reservations: CompanyVisit[] = reservationsSnap.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      status: String(data.status ?? ''),
      startTime: asDate(data.startTime),
      pax: typeof data.pax === 'number' ? data.pax : 0,
      clientEmail: String(data.clientEmail ?? ''),
      clientPhone: String(data.clientPhone ?? ''),
      clientName: String(data.clientName ?? ''),
    }
  })
  const reviews: CompanyReviewRow[] = reviewsSnap.docs.map((docSnap) => {
    const data = docSnap.data()
    const reply = data.ownerReply && typeof data.ownerReply === 'object'
      ? data.ownerReply as Record<string, unknown>
      : null
    const replyText = typeof reply?.text === 'string' ? reply.text : ''
    return {
      id: docSnap.id,
      rating: typeof data.rating === 'number' ? data.rating : 0,
      hasPhoto: data.hasPhoto === true,
      createdAt: asDate(data.createdAt),
      replyText,
      replyAt: replyText ? asDate(reply?.updatedAt ?? reply?.createdAt) : null,
    }
  })

  const reviewCount = typeof company.reviewCount === 'number' ? company.reviewCount : reviews.length
  const reviewRatingSum = typeof company.reviewRatingSum === 'number'
    ? company.reviewRatingSum
    : reviews.reduce((sum, review) => sum + review.rating, 0)
  const reviewAdelinas = typeof company.reviewAdelinas === 'number' ? company.reviewAdelinas : 0

  return {
    company,
    companyRef,
    reservations,
    reviews,
    activePromotionCount: promotionsSnap.size,
    lifetimeConfirmedCount: confirmedCountSnap?.data().count ?? reservations.filter((item) => item.status === 'confirmed').length,
    reviewCount,
    reviewRatingSum,
    reviewAdelinas,
    averageRating: reviewCount > 0 ? reviewRatingSum / reviewCount : 0,
  }
}

export async function syncCompanyGamificationDoc(companyId: string) {
  const statsRef = companyGamificationRef(companyId)
  const statsSnap = await statsRef.get()
  const firstSync = !statsSnap.exists
  const updatedAt = statsSnap.data()?.updatedAt
  const syncedAt = updatedAt instanceof Timestamp ? updatedAt.toMillis() : 0
  if (!firstSync && Date.now() - syncedAt < 20_000) {
    return companyGamificationPayload(
      readCompanyGamificationState(statsSnap.data()?.state as Record<string, unknown> | undefined),
    )
  }

  const loaded = await loadCompanyContext(companyId)
  const before = readCompanyGamificationState(statsSnap.data()?.state as Record<string, unknown> | undefined)
  const next = processCompanyGamification(statsSnap.data()?.state as Record<string, unknown> | undefined, {
    reservations: loaded.reservations,
    reviews: loaded.reviews,
    activePromotionCount: loaded.activePromotionCount,
    reviewAdelinas: loaded.reviewAdelinas,
    reviewCount: loaded.reviewCount,
    reviewRatingSum: loaded.reviewRatingSum,
    lifetimeConfirmedCount: loaded.lifetimeConfirmedCount,
  })
  const level = getCompanyLevelForXp(next.xp)

  await statsRef.set({
    companyId,
    xp: next.xp,
    level: level.level,
    levelTitle: level.title,
    name: String(loaded.company.name ?? ''),
    slug: String(loaded.company.slug ?? ''),
    logoUrl: String(loaded.company.logoUrl ?? ''),
    municipality: String(loaded.company.municipality ?? ''),
    country: String(loaded.company.country ?? 'España'),
    reviewAdelinas: loaded.reviewAdelinas,
    reviewCount: loaded.reviewCount,
    averageRating: loaded.averageRating,
    state: next,
    updatedAt: Timestamp.now(),
  }, { merge: true })

  await loaded.companyRef.set({
    compiteXp: next.xp,
    compiteLevel: level.level,
  }, { merge: true })

  if (!firstSync) {
    await notifyCompanyGamificationChanges(
      companyId,
      before as unknown as Record<string, unknown>,
      next as unknown as Record<string, unknown>,
    )
  }

  return companyGamificationPayload(next)
}

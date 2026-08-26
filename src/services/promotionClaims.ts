import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '../config/firebase'
import type { ClaimedPromotionRecord } from '../types/gamification'

export async function listPromotionClaims(customerUid: string): Promise<ClaimedPromotionRecord[]> {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'promotionClaims'),
        where('customerUid', '==', customerUid),
        limit(100),
      ),
    )
    return snapshot.docs.map((item) => {
      const data = item.data()
      return {
        promotionId: String(data.promotionId ?? ''),
        companyId: String(data.companyId ?? ''),
        companyName: String(data.companyName ?? ''),
        companySlug: String(data.companySlug ?? ''),
        title: String(data.title ?? ''),
        prizeLabel: String(data.prizeLabel ?? ''),
        claimedAt: typeof data.claimedAt === 'string'
          ? data.claimedAt
          : (data.claimedAt as { toDate?: () => Date })?.toDate?.().toISOString() ?? new Date().toISOString(),
        description: typeof data.description === 'string' ? data.description : undefined,
        detail: typeof data.detail === 'string' ? data.detail : undefined,
        photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : undefined,
        companyPhotoUrl: typeof data.companyPhotoUrl === 'string' ? data.companyPhotoUrl : undefined,
        promotionType: data.promotionType as ClaimedPromotionRecord['promotionType'],
        reservationId: typeof data.reservationId === 'string' ? data.reservationId : undefined,
      }
    }).filter((item) => item.promotionId && item.companyId)
      .sort((left, right) => right.claimedAt.localeCompare(left.claimedAt))
  } catch {
    return []
  }
}

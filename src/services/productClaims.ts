import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../config/firebase'

export interface ProductClaimRecord {
  id: string
  companyId: string
  reservationId: string
  promotionId: string | null
  totalCents: number
  verifiedAt: string
}

export async function listProductClaims(customerUid: string): Promise<ProductClaimRecord[]> {
  try {
    const snapshot = await getDocs(
      query(collection(db, 'productClaims'), where('customerUid', '==', customerUid)),
    )
    return snapshot.docs.map((item) => {
      const data = item.data()
      const verifiedAt = data.verifiedAt && typeof data.verifiedAt.toDate === 'function'
        ? data.verifiedAt.toDate().toISOString()
        : typeof data.verifiedAt === 'string'
          ? data.verifiedAt
          : new Date().toISOString()
      return {
        id: item.id,
        companyId: String(data.companyId ?? ''),
        reservationId: String(data.reservationId ?? ''),
        promotionId: typeof data.promotionId === 'string' ? data.promotionId : null,
        totalCents: typeof data.totalCents === 'number' ? data.totalCents : 0,
        verifiedAt,
      }
    }).filter((item) => item.companyId && item.reservationId)
      .sort((left, right) => right.verifiedAt.localeCompare(left.verifiedAt))
  } catch {
    return []
  }
}

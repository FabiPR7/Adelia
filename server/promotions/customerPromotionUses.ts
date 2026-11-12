import { adminDb } from '../firebase-admin.ts'

export {
  claimWindowError,
  countClaimsForPromotion,
  customerLimitMessage,
  isPromotionSoldOut,
  readMaxClaimsPerCustomer,
} from './customerPromotionRules.ts'

/** Reservas no canceladas de este email con la promo: cada una es un uso (reclamado o en camino). */
export async function countCustomerPromotionReservations(
  companyId: string,
  promotionId: string,
  email: string,
): Promise<number> {
  const snapshot = await adminDb
    .collection('reservations')
    .where('clientEmail', '==', email)
    .where('promotionId', '==', promotionId)
    .limit(500)
    .get()

  return snapshot.docs.filter((doc) => {
    const data = doc.data()
    return data.companyId === companyId && data.status !== 'cancelled'
  }).length
}

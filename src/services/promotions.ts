import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { COMPANY_PROMOTION_LIMIT } from './firestoreQuery'
import {
  getDemoPromotions,
  isDemoCompanyId,
  rejectIfDemoCompanyWrite,
} from '../data/companyPanelDemo'
import type { CompanyPromotion, MenuNode, PromotionInput } from '../types/company'
import {
  buildPromotionProductRefs,
  formatPromotionOfferHighlight,
  normalizePromotionOffer,
  normalizePromotionProductRefs,
} from '../utils/promotionOffer'

function mapPromotion(id: string, companyId: string, data: Record<string, unknown>): CompanyPromotion {
  return {
    id,
    companyId,
    type: data.type as CompanyPromotion['type'],
    title: (data.title as string) ?? '',
    description: (data.description as string) ?? '',
    photoUrl: (data.photoUrl as string) ?? '',
    offer: normalizePromotionOffer(data),
    productRefs: normalizePromotionProductRefs(data),
    active: data.active === true,
    requiresReservation: data.requiresReservation === true,
    requiredReservations: typeof data.requiredReservations === 'number'
      ? data.requiredReservations
      : null,
    minimumSpendEnabled: data.minimumSpendEnabled === true,
    minimumSpendCents: typeof data.minimumSpendCents === 'number'
      ? data.minimumSpendCents
      : null,
    activeFromTime: (data.activeFromTime as string) ?? '',
    activeToTime: (data.activeToTime as string) ?? '',
    maxRedemptions: typeof data.maxRedemptions === 'number' ? data.maxRedemptions : null,
    currentRedemptions: typeof data.currentRedemptions === 'number' ? data.currentRedemptions : 0,
    arrivalWindowMinutes: typeof data.arrivalWindowMinutes === 'number'
      ? data.arrivalWindowMinutes
      : null,
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp | undefined)?.toDate?.() ?? new Date(),
  }
}

function serializePromotion(
  companyId: string,
  input: PromotionInput,
  productRefs: ReturnType<typeof buildPromotionProductRefs>,
) {
  return {
    companyId,
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    photoUrl: input.photoUrl.trim(),
    offer: input.offer,
    productRefs,
    offerHighlight: formatPromotionOfferHighlight(input.offer),
    active: input.active,
    requiresReservation: input.requiresReservation,
    requiredReservations: input.requiredReservations,
    minimumSpendEnabled: input.minimumSpendEnabled,
    minimumSpendCents: input.minimumSpendEnabled ? input.minimumSpendCents : null,
    activeFromTime: input.activeFromTime,
    activeToTime: input.activeToTime,
    maxRedemptions: input.maxRedemptions,
    arrivalWindowMinutes: input.arrivalWindowMinutes,
    updatedAt: serverTimestamp(),
  }
}

export async function getCompanyPromotions(companyId: string): Promise<CompanyPromotion[]> {
  if (isDemoCompanyId(companyId)) {
    return getDemoPromotions()
  }

  const promotionsRef = collection(db, 'companies', companyId, 'promotions')
  const snapshot = await getDocs(query(promotionsRef, limit(COMPANY_PROMOTION_LIMIT)))

  return snapshot.docs
    .map((promotionDoc) =>
      mapPromotion(promotionDoc.id, companyId, promotionDoc.data() as Record<string, unknown>),
    )
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
}

export async function createCompanyPromotion(
  companyId: string,
  input: PromotionInput,
  menuProducts: MenuNode[] = [],
): Promise<string> {
  rejectIfDemoCompanyWrite(companyId)
  const productRefs = buildPromotionProductRefs(input.productIds, menuProducts)
  const promotionsRef = collection(db, 'companies', companyId, 'promotions')
  const docRef = await addDoc(promotionsRef, {
    ...serializePromotion(companyId, input, productRefs),
    currentRedemptions: 0,
    createdAt: serverTimestamp(),
  })

  return docRef.id
}

export async function updateCompanyPromotion(
  companyId: string,
  promotionId: string,
  input: PromotionInput,
  menuProducts: MenuNode[] = [],
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  const productRefs = buildPromotionProductRefs(input.productIds, menuProducts)
  const promotionRef = doc(db, 'companies', companyId, 'promotions', promotionId)
  await updateDoc(promotionRef, serializePromotion(companyId, input, productRefs))
}

export async function deleteCompanyPromotion(companyId: string, promotionId: string): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  const promotionRef = doc(db, 'companies', companyId, 'promotions', promotionId)
  await deleteDoc(promotionRef)
}

export async function setCompanyPromotionActive(
  companyId: string,
  promotionId: string,
  active: boolean,
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  const promotionRef = doc(db, 'companies', companyId, 'promotions', promotionId)
  await updateDoc(promotionRef, {
    active,
    updatedAt: serverTimestamp(),
  })
}

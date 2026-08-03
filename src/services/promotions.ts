import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import type { CompanyPromotion, PromotionInput } from '../types/company'

function mapPromotion(id: string, companyId: string, data: Record<string, unknown>): CompanyPromotion {
  return {
    id,
    companyId,
    type: data.type as CompanyPromotion['type'],
    title: (data.title as string) ?? '',
    description: (data.description as string) ?? '',
    photoUrl: (data.photoUrl as string) ?? '',
    active: data.active === true,
    requiresReservation: data.requiresReservation === true,
    requiredReservations: typeof data.requiredReservations === 'number'
      ? data.requiredReservations
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

function serializePromotion(companyId: string, input: PromotionInput) {
  return {
    companyId,
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    photoUrl: input.photoUrl.trim(),
    active: input.active,
    requiresReservation: input.requiresReservation,
    requiredReservations: input.requiredReservations,
    activeFromTime: input.activeFromTime,
    activeToTime: input.activeToTime,
    maxRedemptions: input.maxRedemptions,
    arrivalWindowMinutes: input.arrivalWindowMinutes,
    updatedAt: serverTimestamp(),
  }
}

export async function getCompanyPromotions(companyId: string): Promise<CompanyPromotion[]> {
  const promotionsRef = collection(db, 'companies', companyId, 'promotions')
  const snapshot = await getDocs(promotionsRef)

  return snapshot.docs
    .map((promotionDoc) =>
      mapPromotion(promotionDoc.id, companyId, promotionDoc.data() as Record<string, unknown>),
    )
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
}

export async function createCompanyPromotion(
  companyId: string,
  input: PromotionInput,
): Promise<string> {
  const promotionsRef = collection(db, 'companies', companyId, 'promotions')
  const docRef = await addDoc(promotionsRef, {
    ...serializePromotion(companyId, input),
    currentRedemptions: 0,
    createdAt: serverTimestamp(),
  })

  return docRef.id
}

export async function updateCompanyPromotion(
  companyId: string,
  promotionId: string,
  input: PromotionInput,
): Promise<void> {
  const promotionRef = doc(db, 'companies', companyId, 'promotions', promotionId)
  await updateDoc(promotionRef, serializePromotion(companyId, input))
}

export async function deleteCompanyPromotion(companyId: string, promotionId: string): Promise<void> {
  const promotionRef = doc(db, 'companies', companyId, 'promotions', promotionId)
  await deleteDoc(promotionRef)
}

export async function setCompanyPromotionActive(
  companyId: string,
  promotionId: string,
  active: boolean,
): Promise<void> {
  const promotionRef = doc(db, 'companies', companyId, 'promotions', promotionId)
  await updateDoc(promotionRef, {
    active,
    updatedAt: serverTimestamp(),
  })
}

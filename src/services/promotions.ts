import { collection, getDocs, limit, query } from 'firebase/firestore'
import { db } from '../config/firebase'
import { COMPANY_PROMOTION_LIMIT } from './firestoreQuery'
import {
  getDemoPromotions,
  isDemoCompanyId,
  rejectIfDemoCompanyWrite,
} from '../data/companyPanelDemo'
import type { CompanyPromotion, MenuNode, PromotionInput } from '../types/company'
import { mapPromotion } from '../utils/promotionSerialize'
import { callCompanyApi } from './companyApi'


const promoPath = (companyId: string, suffix = '') => `/${encodeURIComponent(companyId)}/promotions${suffix}`

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
  void menuProducts // el servidor saca los productos de la carta del propio local
  const data = await callCompanyApi<{ id: string }>(promoPath(companyId), 'POST', input, 'No se pudo crear la promoción.')
  return data.id
}

export async function updateCompanyPromotion(
  companyId: string,
  promotionId: string,
  input: PromotionInput,
  menuProducts: MenuNode[] = [],
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  void menuProducts
  await callCompanyApi(promoPath(companyId, `/${encodeURIComponent(promotionId)}`), 'PUT', input, 'No se pudo guardar la promoción.')
}

export async function deleteCompanyPromotion(companyId: string, promotionId: string): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  await callCompanyApi(promoPath(companyId, `/${encodeURIComponent(promotionId)}`), 'DELETE', undefined, 'No se pudo borrar la promoción.')
}

export async function setCompanyPromotionActive(
  companyId: string,
  promotionId: string,
  active: boolean,
): Promise<void> {
  rejectIfDemoCompanyWrite(companyId)
  await callCompanyApi(promoPath(companyId, `/${encodeURIComponent(promotionId)}/active`), 'PATCH', { active }, 'No se pudo cambiar la promoción.')
}

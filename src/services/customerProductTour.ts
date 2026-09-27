import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../config/firebase'

export const PRODUCT_TOUR_STORAGE_KEY = 'adelia_product_tour_completed_v1'

export function readLocalProductTourCompleted(): boolean {
  try {
    return localStorage.getItem(PRODUCT_TOUR_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeLocalProductTourCompleted(): void {
  try {
    localStorage.setItem(PRODUCT_TOUR_STORAGE_KEY, '1')
  } catch {
    // ignore quota / private mode
  }
}

export function clearLocalProductTourCompleted(): void {
  try {
    localStorage.removeItem(PRODUCT_TOUR_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export async function markCustomerProductTourCompleted(uid: string): Promise<void> {
  writeLocalProductTourCompleted()
  await updateDoc(doc(db, 'users', uid), {
    productTourCompleted: true,
  })
}

import type { Transaction } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from './collections.ts'
import {
  readGamificationFromDocs,
  userGamificationRef,
  writeGamification,
} from './userGamification.ts'

export function timeLimitedClaimDocId(
  uid: string,
  reservationId: string,
  promotionId: string,
): string {
  return `${uid}_${reservationId}_${promotionId}`
}

export function ladderClaimDocId(uid: string, promotionId: string, cycle: number): string {
  return `${uid}_${promotionId}_${cycle}`
}

export function promotionClaimRef(claimId: string) {
  return adminDb.collection(COLLECTIONS.promotionClaims).doc(claimId)
}

export function appendClaimToState(
  current: Record<string, unknown>,
  claim: Record<string, unknown>,
): Record<string, unknown> {
  const claims = Array.isArray(current.claimedPromotions) ? current.claimedPromotions : []
  const redemptionsCount = typeof current.redemptionsCount === 'number'
    ? current.redemptionsCount + 1
    : claims.length + 1

  return {
    ...current,
    claimedPromotions: [...claims, claim],
    redemptionsCount,
  }
}

export async function writeClaimInTransaction(
  transaction: Transaction,
  uid: string,
  claimId: string,
  claim: Record<string, unknown>,
  nextState: Record<string, unknown>,
) {
  const claimRef = promotionClaimRef(claimId)
  const existing = await transaction.get(claimRef)
  if (existing.exists) {
    return false
  }

  transaction.set(claimRef, {
    customerUid: uid,
    ...claim,
  })
  writeGamification(transaction, uid, nextState)
  return true
}

export async function readCurrentGamification(transaction: Transaction, uid: string) {
  const userRef = adminDb.collection(COLLECTIONS.users).doc(uid)
  const [userSnap, statsSnap] = await Promise.all([
    transaction.get(userRef),
    transaction.get(userGamificationRef(uid)),
  ])
  return readGamificationFromDocs(statsSnap.data(), userSnap.data())
}

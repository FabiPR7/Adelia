import type { Transaction } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from './collections.ts'

const MAX_STORED_CLAIMS = 20

export function userGamificationRef(uid: string) {
  return adminDb.collection(COLLECTIONS.userGamification).doc(uid)
}

export function readGamificationFromDocs(
  dedicated: FirebaseFirestore.DocumentData | undefined,
  userData: FirebaseFirestore.DocumentData | undefined,
): Record<string, unknown> {
  if (dedicated && typeof dedicated.state === 'object' && dedicated.state) {
    return dedicated.state as Record<string, unknown>
  }
  if (userData?.gamification && typeof userData.gamification === 'object') {
    return userData.gamification as Record<string, unknown>
  }
  return {}
}

export function compactGamificationForUserDoc(state: Record<string, unknown>): Record<string, unknown> {
  const next = { ...state }
  delete next.claimedPromotions
  delete next.cancelledReservationIds
  delete next.grantedItemKeys
  return next
}

export function compactGamificationForStatsDoc(state: Record<string, unknown>): Record<string, unknown> {
  const claims = Array.isArray(state.claimedPromotions) ? state.claimedPromotions : []
  return {
    ...state,
    claimedPromotions: claims.slice(-MAX_STORED_CLAIMS),
  }
}

export function writeGamification(
  transaction: Transaction,
  uid: string,
  state: Record<string, unknown>,
) {
  const xp = typeof state.xp === 'number' ? state.xp : 0
  const adelinas = typeof state.adelinas === 'number' ? state.adelinas : 0
  const statsState = compactGamificationForStatsDoc(state)
  const statsRef = userGamificationRef(uid)
  const userRef = adminDb.collection(COLLECTIONS.users).doc(uid)

  // Reemplaza `state` / `gamification` enteros. Con merge profundo, borrar una carta
  // del inventario no quitaba la clave y esa carta se podía usar sin límite.
  transaction.set(statsRef, {
    uid,
    xp,
    adelinas,
    state: statsState,
    updatedAt: new Date(),
  }, { mergeFields: ['uid', 'xp', 'adelinas', 'state', 'updatedAt'] })
  transaction.set(userRef, {
    gamification: compactGamificationForUserDoc(statsState),
    xp,
    adelinas,
  }, { mergeFields: ['gamification', 'xp', 'adelinas'] })
}

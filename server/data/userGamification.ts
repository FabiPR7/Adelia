import { FieldValue, type Transaction } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from './collections.ts'
import { cachedLevelForXp } from './gameCatalog.ts'

// Los canjes del mapa se leen del perfil para pintar qué premios del ciclo ya se cobraron.
const MAX_STORED_CLAIMS = 100
const MAX_PENDING_TOKEN_SPEND = 10

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
  const pending = Array.isArray(state.pendingTokenSpend) ? state.pendingTokenSpend : []
  return {
    ...state,
    claimedPromotions: claims.slice(-MAX_STORED_CLAIMS),
    pendingTokenSpend: pending.slice(-MAX_PENDING_TOKEN_SPEND),
  }
}

export function writeGamification(
  transaction: Transaction,
  uid: string,
  state: Record<string, unknown>,
) {
  const xp = typeof state.xp === 'number' ? state.xp : 0
  const level = cachedLevelForXp(xp)
  const adelinas = typeof state.adelinas === 'number' ? state.adelinas : 0
  const statsState = compactGamificationForStatsDoc(state)
  const statsRef = userGamificationRef(uid)
  const userRef = adminDb.collection(COLLECTIONS.users).doc(uid)

  // El estado grande vive en `userGamification`. En `users` solo quedan xp/adelinas
  // para ranking; `gamification` se borra para no duplicar megabytes en cada jugada.
  transaction.set(statsRef, {
    uid,
    xp,
    adelinas,
    ...(level != null ? { level } : {}),
    state: statsState,
    updatedAt: new Date(),
  }, { mergeFields: ['uid', 'xp', 'adelinas', ...(level != null ? ['level'] : []), 'state', 'updatedAt'] })
  transaction.set(userRef, {
    xp,
    adelinas,
    ...(level != null ? { level } : {}),
    gamification: FieldValue.delete(),
  }, { merge: true })
}

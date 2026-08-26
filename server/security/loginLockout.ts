import { Timestamp } from 'firebase-admin/firestore'
import { adminDb, canUseAdminSdk } from '../firebase-admin.ts'
import { hashRateKey } from './requestIdentity.ts'

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000

function lockoutRef(identifier: string) {
  const id = hashRateKey(`login:${identifier.trim().toLowerCase()}`)
  return adminDb.collection('loginAttempts').doc(id)
}

export async function isLoginLocked(identifier: string): Promise<boolean> {
  if (!canUseAdminSdk || !identifier.trim()) {
    return false
  }

  const snap = await lockoutRef(identifier).get()
  if (!snap.exists) {
    return false
  }

  const lockedUntil = snap.data()?.lockedUntil
  if (!(lockedUntil instanceof Timestamp)) {
    return false
  }

  if (lockedUntil.toMillis() > Date.now()) {
    return true
  }

  await snap.ref.set({
    attemptCount: 0,
    lockedUntil: null,
    lockedAt: null,
  }, { merge: true })
  return false
}

export async function recordLoginFailure(identifier: string): Promise<void> {
  if (!canUseAdminSdk || !identifier.trim()) {
    return
  }

  const ref = lockoutRef(identifier)
  const now = Timestamp.now()
  await adminDb.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref)
    const current = snap.exists ? (snap.data()?.attemptCount as number | undefined) ?? 0 : 0
    const nextCount = current + 1
    const locked = nextCount >= MAX_LOGIN_ATTEMPTS
    transaction.set(ref, {
      attemptCount: nextCount,
      lastAttemptAt: now,
      lockedUntil: locked ? Timestamp.fromMillis(Date.now() + LOCKOUT_DURATION_MS) : null,
      lockedAt: locked ? now : null,
    }, { merge: true })
  })
}

export async function recordLoginSuccess(identifier: string): Promise<void> {
  if (!canUseAdminSdk || !identifier.trim()) {
    return
  }

  await lockoutRef(identifier).set({
    attemptCount: 0,
    lockedUntil: null,
    lockedAt: null,
    lastSuccessAt: Timestamp.now(),
  }, { merge: true })
}

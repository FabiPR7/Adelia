import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '../config/firebase'

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000

interface LoginAttemptRecord {
  attemptCount: number
  lastAttemptAt: Timestamp
  lockedUntil: Timestamp | null
  lockedAt: Timestamp | null
}

function getAttemptDocRef(identifier: string) {
  return doc(db, 'loginAttempts', identifier.toLowerCase().trim())
}

export async function checkAccountLocked(identifier: string): Promise<boolean> {
  try {
    const attemptDoc = await getDoc(getAttemptDocRef(identifier))
    
    if (!attemptDoc.exists()) {
      return false
    }
    
    const data = attemptDoc.data() as LoginAttemptRecord
    
    if (!data.lockedUntil) {
      return false
    }
    
    const now = Date.now()
    const lockedUntil = data.lockedUntil.toMillis()
    
    if (now < lockedUntil) {
      return true
    }
    
    await updateDoc(attemptDoc.ref, {
      lockedUntil: null,
      lockedAt: null,
      attemptCount: 0,
    })
    
    return false
  } catch {
    return false
  }
}

export async function recordFailedLoginAttempt(identifier: string): Promise<void> {
  try {
    const attemptRef = getAttemptDocRef(identifier)
    const attemptDoc = await getDoc(attemptRef)
    
    const now = Date.now()
    const nowTimestamp = Timestamp.fromMillis(now)
    
    if (!attemptDoc.exists()) {
      await setDoc(attemptRef, {
        attemptCount: 1,
        lastAttemptAt: nowTimestamp,
        lockedUntil: null,
        lockedAt: null,
      })
      return
    }
    
    const data = attemptDoc.data() as LoginAttemptRecord
    const newAttemptCount = data.attemptCount + 1
    
    if (newAttemptCount >= MAX_LOGIN_ATTEMPTS) {
      const lockedUntil = Timestamp.fromMillis(now + LOCKOUT_DURATION_MS)
      await updateDoc(attemptRef, {
        attemptCount: newAttemptCount,
        lastAttemptAt: nowTimestamp,
        lockedUntil,
        lockedAt: nowTimestamp,
      })
    } else {
      await updateDoc(attemptRef, {
        attemptCount: newAttemptCount,
        lastAttemptAt: nowTimestamp,
      })
    }
  } catch {
  }
}

export async function resetLoginAttempts(identifier: string): Promise<void> {
  try {
    const attemptRef = getAttemptDocRef(identifier)
    const attemptDoc = await getDoc(attemptRef)
    
    if (attemptDoc.exists()) {
      await updateDoc(attemptRef, {
        attemptCount: 0,
        lockedUntil: null,
        lockedAt: null,
      })
    }
  } catch {
  }
}

export async function getLockedUntilTime(identifier: string): Promise<number | null> {
  try {
    const attemptDoc = await getDoc(getAttemptDocRef(identifier))
    
    if (!attemptDoc.exists()) {
      return null
    }
    
    const data = attemptDoc.data() as LoginAttemptRecord
    
    if (!data.lockedUntil) {
      return null
    }
    
    const lockedUntil = data.lockedUntil.toMillis()
    const now = Date.now()
    
    if (now >= lockedUntil) {
      return null
    }
    
    return lockedUntil
  } catch {
    return null
  }
}

export function formatLockoutMessage(lockedUntilMs: number): string {
  const remainingMs = lockedUntilMs - Date.now()
  const remainingMinutes = Math.ceil(remainingMs / (60 * 1000))
  
  if (remainingMinutes <= 1) {
    return 'Cuenta bloqueada temporalmente. Intenta de nuevo en 1 minuto.'
  }
  
  return `Cuenta bloqueada temporalmente. Intenta de nuevo en ${remainingMinutes} minutos.`
}

export function isFailedCredentialError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false
  }
  const code = String((error as { code: unknown }).code)
  return (
    code === 'auth/wrong-password'
    || code === 'auth/invalid-credential'
    || code === 'auth/user-not-found'
    || code === 'auth/invalid-email'
  )
}

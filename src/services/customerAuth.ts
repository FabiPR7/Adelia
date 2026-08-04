import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { defaultGamificationState } from '../types/gamification'
import { auth, db } from '../config/firebase'
import { getAuthErrorMessage } from './auth'

export async function registerCustomer(
  email: string,
  password: string,
  displayName: string,
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password)

  await setDoc(doc(db, 'users', credential.user.uid), {
    email: normalizedEmail,
    role: 'customer',
    companyId: null,
    displayName: displayName.trim(),
    favoriteSlugs: [],
    gamification: defaultGamificationState(),
    xp: 0,
    adelinas: 0,
    mustChangePassword: false,
    createdAt: serverTimestamp(),
  })
}

export async function loginCustomer(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
}

export async function requestCustomerPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase())
  } catch (error) {
    throw new Error(getAuthErrorMessage(error))
  }
}

export async function updateCustomerFavorites(uid: string, favoriteSlugs: string[]): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    favoriteSlugs,
  })
}

export async function updateCustomerDisplayName(uid: string, displayName: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    displayName: displayName.trim(),
  })
}

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  linkWithCredential,
  PhoneAuthProvider,
  RecaptchaVerifier,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { defaultGamificationState } from '../types/gamification'
import { auth, db } from '../config/firebase'
import { getAuthErrorMessage } from './auth'
import { getUserProfile } from './firestore'
import { replaceUserFavorites } from './userFavorites'
import {
  requestCustomerVerificationEmailSend,
  syncCustomerPhoneVerification,
} from './customerAuthApi'
import { normalizePhoneE164 } from '../utils/customerRouting'
import { formatSpanishPhoneForStorage, isValidSpanishPhone } from '../utils/helpers'
import {
  checkAccountLocked,
  recordFailedLoginAttempt,
  resetLoginAttempts,
  getLockedUntilTime,
  formatLockoutMessage,
} from './authSecurity'

export interface RegisterCustomerInput {
  email: string
  password: string
  displayName: string
  phone: string
}

function requireCustomerPhone(phone: string): string {
  if (!isValidSpanishPhone(phone)) {
    throw new Error('Indica un teléfono válido de España (9 dígitos, p. ej. 612 345 678).')
  }
  return formatSpanishPhoneForStorage(phone)
}

function buildCustomerDoc(input: {
  email: string
  displayName: string
  phone: string
  phoneVerified: boolean
  authProvider: 'password' | 'google.com'
}) {
  return {
    email: input.email.trim().toLowerCase(),
    role: 'customer' as const,
    companyId: null,
    displayName: input.displayName.trim(),
    phone: input.phone,
    phoneVerified: input.phoneVerified,
    photoUrl: '',
    homeCity: '',
    homeMunicipality: '',
    homeCountry: '',
    homePostalCode: '',
    homeLatitude: null,
    homeLongitude: null,
    foodPreferences: [] as string[],
    onboardingCompleted: false,
    authProvider: input.authProvider,
    favoriteSlugs: [] as string[],
    gamification: defaultGamificationState(),
    xp: 0,
    adelinas: 0,
    displayNameLower: input.displayName.trim().toLowerCase(),
    mustChangePassword: false,
    createdAt: serverTimestamp(),
  }
}

let recaptchaVerifier: RecaptchaVerifier | null = null
let phoneVerificationId: string | null = null

async function sendCustomerVerificationEmail(user: User): Promise<void> {
  try {
    await requestCustomerVerificationEmailSend()
  } catch {
    await sendEmailVerification(user)
  }
}

export function resetPhoneVerificationSession() {
  recaptchaVerifier?.clear()
  recaptchaVerifier = null
  phoneVerificationId = null
}

export function getPhoneRecaptchaContainerId() {
  return 'customer-phone-recaptcha'
}

export async function startPhoneVerification(phone: string): Promise<void> {
  const user = auth.currentUser

  if (!user) {
    throw new Error('Debes iniciar sesión para verificar el teléfono.')
  }

  resetPhoneVerificationSession()

  recaptchaVerifier = new RecaptchaVerifier(auth, getPhoneRecaptchaContainerId(), {
    size: 'normal',
  })

  const phoneProvider = new PhoneAuthProvider(auth)
  phoneVerificationId = await phoneProvider.verifyPhoneNumber(
    normalizePhoneE164(phone),
    recaptchaVerifier,
  )
}

export async function confirmPhoneVerification(code: string, _phone: string): Promise<void> {
  const user = auth.currentUser

  if (!user) {
    throw new Error('Sesión expirada. Vuelve a registrarte.')
  }

  if (!phoneVerificationId) {
    throw new Error('Primero solicita el código SMS.')
  }

  const credential = PhoneAuthProvider.credential(phoneVerificationId, code.trim())
  await linkWithCredential(user, credential)
  await syncCustomerPhoneVerification()

  resetPhoneVerificationSession()
}

export async function registerCustomer(input: RegisterCustomerInput): Promise<User> {
  const normalizedEmail = input.email.trim().toLowerCase()
  const storedPhone = requireCustomerPhone(input.phone)
  const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, input.password)

  await updateProfile(credential.user, {
    displayName: input.displayName.trim(),
  })

  // Asegura que el token de auth esté listo antes de escribir en Firestore.
  await credential.user.getIdToken(true)

  await setDoc(
    doc(db, 'users', credential.user.uid),
    buildCustomerDoc({
      email: normalizedEmail,
      displayName: input.displayName,
      phone: storedPhone,
      phoneVerified: false,
      authProvider: 'password',
    }),
  )

  await sendCustomerVerificationEmail(credential.user)
  return credential.user
}

export async function registerCustomerAndSignOut(input: RegisterCustomerInput): Promise<void> {
  await registerCustomer(input)
  await finalizeEmailRegistration()
}

export async function finalizeEmailRegistration(): Promise<void> {
  await signOut(auth)
  resetPhoneVerificationSession()
}

export async function loginCustomer(email: string, password: string): Promise<User> {
  const identifier = email.trim().toLowerCase()
  
  const isLocked = await checkAccountLocked(identifier)
  if (isLocked) {
    const lockedUntil = await getLockedUntilTime(identifier)
    if (lockedUntil) {
      throw new Error(formatLockoutMessage(lockedUntil))
    }
  }
  
  try {
    const credential = await signInWithEmailAndPassword(auth, identifier, password)

    if (!credential.user.emailVerified) {
      await sendCustomerVerificationEmail(credential.user).catch(() => {
        // Puede fallar por rate limit; igual bloqueamos el acceso.
      })
      await signOut(auth)
      throw new Error(
        'Confirma tu email antes de entrar. Revisa tu bandeja (y spam) y vuelve a intentarlo.',
      )
    }

    const profile = await getUserProfile(credential.user.uid).catch(() => null)
    const role = profile?.role

    if (role !== 'customer') {
      await signOut(auth)
      throw new Error('Esta cuenta no es de cliente. Usa el acceso de empresas.')
    }

    await resetLoginAttempts(identifier)
    
    return credential.user
  } catch (error) {
    await recordFailedLoginAttempt(identifier)
    throw error
  }
}

export async function resendCustomerVerificationEmail(): Promise<void> {
  const user = auth.currentUser

  if (!user) {
    throw new Error('Inicia sesión para reenviar el correo de verificación.')
  }

  await sendCustomerVerificationEmail(user)
}

export async function checkEmailVerified(): Promise<boolean> {
  const user = auth.currentUser

  if (!user) {
    return false
  }

  await user.reload()
  return user.emailVerified
}

export async function signInCustomerWithGoogle(): Promise<'existing' | 'created'> {
  const result = await signInWithPopup(auth, new GoogleAuthProvider())
  const user = result.user
  const profile = await getUserProfile(user.uid).catch(() => null)

  if (profile) {
    if (profile.role !== 'customer') {
      await signOut(auth)
      throw new Error('Esta cuenta de Google no es de cliente.')
    }

    return 'existing'
  }

  const profileRef = doc(db, 'users', user.uid)
  const existing = await getDoc(profileRef)

  if (existing.exists()) {
    const role = existing.data()?.role

    if (role !== 'customer') {
      await signOut(auth)
      throw new Error('Esta cuenta de Google no es de cliente.')
    }

    return 'existing'
  }

  await user.getIdToken(true)

  await setDoc(profileRef, {
    ...buildCustomerDoc({
      email: (user.email ?? '').trim().toLowerCase(),
      displayName: user.displayName?.trim() || 'Comensal',
      phone: user.phoneNumber && isValidSpanishPhone(user.phoneNumber)
        ? formatSpanishPhoneForStorage(user.phoneNumber)
        : '',
      phoneVerified: Boolean(user.phoneNumber && isValidSpanishPhone(user.phoneNumber)),
      authProvider: 'google.com',
    }),
    photoUrl: user.photoURL ?? '',
  })

  return 'created'
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
  await replaceUserFavorites(uid, favoriteSlugs).catch(() => undefined)
}

export async function updateCustomerPhone(uid: string, phone: string): Promise<void> {
  const storedPhone = requireCustomerPhone(phone)
  await updateDoc(doc(db, 'users', uid), {
    phone: storedPhone,
  })
}

export async function updateCustomerDisplayName(uid: string, displayName: string): Promise<void> {
  const trimmed = displayName.trim()
  await updateDoc(doc(db, 'users', uid), {
    displayName: trimmed,
    displayNameLower: trimmed.toLowerCase(),
  })
}

export interface CustomerOnboardingPayload {
  photoUrl: string
  homeCity: string
  homeMunicipality: string
  homeCountry: string
  homePostalCode: string
  homeLatitude: number | null
  homeLongitude: number | null
  foodPreferences: string[]
  phone?: string
}

export async function completeCustomerOnboarding(
  uid: string,
  payload: CustomerOnboardingPayload,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    photoUrl: payload.photoUrl,
    homeCity: payload.homeCity,
    homeMunicipality: payload.homeMunicipality,
    homeCountry: payload.homeCountry,
    homePostalCode: payload.homePostalCode,
    homeLatitude: payload.homeLatitude,
    homeLongitude: payload.homeLongitude,
    foodPreferences: payload.foodPreferences,
    onboardingCompleted: true,
    ...(payload.phone ? { phone: payload.phone } : {}),
  })
}

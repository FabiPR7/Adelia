import {
  GoogleAuthProvider,
  linkWithCredential,
  PhoneAuthProvider,
  RecaptchaVerifier,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import {
  arrayRemove,
  arrayUnion,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import { getUserProfile } from './firestore'
import { favoriteDocId, replaceUserFavorites } from './userFavorites'
import {
  requestCustomerVerificationEmailSend,
  syncCustomerPhoneVerification,
} from './customerAuthApi'
import {
  bootstrapCustomerProfile,
  preLoginCustomer,
  registerCustomerAccount,
  requestCustomerPasswordReset as requestCustomerPasswordResetApi,
} from './authApi'
import { normalizePhoneE164 } from '../utils/customerRouting'
import { formatSpanishPhoneForStorage, isValidSpanishPhone } from '../utils/helpers'
import { requireAuthPassword } from '../utils/passwordValidation'

export interface RegisterCustomerInput {
  email: string
  password: string
  displayName: string
  phone: string
  recaptchaToken?: string
}

function requireCustomerPhone(phone: string): string {
  if (!isValidSpanishPhone(phone)) {
    throw new Error('Indica un teléfono válido de España (9 dígitos, p. ej. 612 345 678).')
  }
  return formatSpanishPhoneForStorage(phone)
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

export async function registerCustomer(input: RegisterCustomerInput): Promise<void> {
  requireAuthPassword(input.password)
  requireCustomerPhone(input.phone)
  await registerCustomerAccount({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    displayName: input.displayName.trim(),
    phone: input.phone,
    recaptchaToken: input.recaptchaToken,
  })
}

export async function registerCustomerAndSignOut(input: RegisterCustomerInput): Promise<void> {
  await registerCustomer(input)
}

export async function finalizeEmailRegistration(): Promise<void> {
  await signOut(auth)
  resetPhoneVerificationSession()
}

export async function loginCustomer(email: string, password: string): Promise<User> {
  const identifier = email.trim().toLowerCase()
  await preLoginCustomer(identifier, password)
  const credential = await signInWithEmailAndPassword(auth, identifier, password)
  const profile = await getUserProfile(credential.user.uid).catch(() => null)
  const role = profile?.role

  if (role === 'admin' || role === 'company') {
    return credential.user
  }

  if (!credential.user.emailVerified) {
    await sendCustomerVerificationEmail(credential.user).catch(() => {
      // Puede fallar por rate limit; igual bloqueamos el acceso.
    })
    await signOut(auth)
    throw new Error(
      'Confirma tu email antes de entrar. Revisa tu bandeja (y spam) y vuelve a intentarlo.',
    )
  }

  if (role !== 'customer') {
    await signOut(auth)
    throw new Error('Esta cuenta no es de cliente. Usa el acceso de empresas.')
  }

  if (profile?.blocked) {
    await signOut(auth)
    throw new Error('Esta cuenta está bloqueada. Escribe a Adelia si es un error.')
  }

  return credential.user
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

export async function signInCustomerWithGoogle(recaptchaToken?: string): Promise<'existing' | 'created'> {
  const result = await signInWithPopup(auth, new GoogleAuthProvider())
  const user = result.user

  try {
    const boot = await bootstrapCustomerProfile(recaptchaToken)
    const profile = await getUserProfile(user.uid).catch(() => null)
    if (profile?.blocked) {
      await signOut(auth)
      throw new Error('Esta cuenta está bloqueada. Escribe a Adelia si es un error.')
    }
    return boot.existing ? 'existing' : 'created'
  } catch (error) {
    await signOut(auth)
    throw error
  }
}

export async function requestCustomerPasswordReset(email: string): Promise<string> {
  return requestCustomerPasswordResetApi(email)
}

export async function updateCustomerFavorites(uid: string, favoriteSlugs: string[]): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    favoriteSlugs,
  })
  await replaceUserFavorites(uid, favoriteSlugs).catch(() => undefined)
}

export async function setCustomerFavorite(
  uid: string,
  slug: string,
  saved: boolean,
): Promise<void> {
  const normalizedSlug = slug.trim()
  if (!uid || !normalizedSlug) {
    return
  }

  const batch = writeBatch(db)
  batch.update(doc(db, 'users', uid), {
    favoriteSlugs: saved ? arrayUnion(normalizedSlug) : arrayRemove(normalizedSlug),
  })

  const favoriteRef = doc(db, 'userFavorites', favoriteDocId(uid, normalizedSlug))
  if (saved) {
    batch.set(favoriteRef, {
      userId: uid,
      slug: normalizedSlug,
      createdAt: serverTimestamp(),
    }, { merge: true })
  } else {
    batch.delete(favoriteRef)
  }

  await batch.commit()
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

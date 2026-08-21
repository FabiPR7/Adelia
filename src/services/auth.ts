import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth'
import { auth } from '../config/firebase'
import { resolveLoginAuthEmail } from './firestore'
import { syncInitialPasswordChange } from './authApi'
import {
  checkAccountLocked,
  recordFailedLoginAttempt,
  resetLoginAttempts,
  getLockedUntilTime,
  formatLockoutMessage,
} from './authSecurity'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'Ya existe una cuenta con este email.',
  'auth/invalid-email': 'Email o contraseña incorrectos.',
  'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
  'auth/user-not-found': 'Email o contraseña incorrectos.',
  'auth/wrong-password': 'Email o contraseña incorrectos.',
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres e incluir mayúsculas, minúsculas y números.',
  'auth/too-many-requests':
    'Demasiados intentos fallidos. Inténtalo de nuevo más tarde.',
  'auth/network-request-failed':
    'Error de conexión. Comprueba tu internet e inténtalo de nuevo.',
  'auth/requires-recent-login':
    'Por seguridad, vuelve a iniciar sesión e inténtalo de nuevo.',
}

export function getAuthErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    if (error.code === 'permission-denied') {
      return 'No tienes permiso en Firestore. Despliega las reglas con npm run deploy:rules (base de datos adelia).'
    }

    return AUTH_ERROR_MESSAGES[error.code] ?? 'No se pudo iniciar sesión.'
  }

  return 'No se pudo iniciar sesión.'
}

export async function loginWithUsername(username: string, password: string) {
  const identifier = username.trim().toLowerCase()
  
  const isLocked = await checkAccountLocked(identifier)
  if (isLocked) {
    const lockedUntil = await getLockedUntilTime(identifier)
    if (lockedUntil) {
      throw new Error(formatLockoutMessage(lockedUntil))
    }
  }
  
  try {
    const email = await resolveLoginAuthEmail(username)
    const credential = await signInWithEmailAndPassword(auth, email, password)
    
    await resetLoginAttempts(identifier)
    
    return credential.user
  } catch (error) {
    await recordFailedLoginAttempt(identifier)
    throw error
  }
}

export async function logout() {
  await signOut(auth)
}

export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser

  if (!user) {
    return null
  }

  return user.getIdToken()
}

export async function changePasswordWithReauth(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = auth.currentUser

  if (!user?.email) {
    throw new Error('No hay sesión activa.')
  }

  const credential = EmailAuthProvider.credential(user.email, currentPassword)

  try {
    await reauthenticateWithCredential(user, credential)
    await updatePassword(user, newPassword)
  } catch (error) {
    throw new Error(getAuthErrorMessage(error))
  }
}

export async function changeInitialPassword(
  currentPassword: string,
  newPassword: string,
  _companyId: string | null,
): Promise<void> {
  await changePasswordWithReauth(currentPassword, newPassword)
  await syncInitialPasswordChange(newPassword)
}

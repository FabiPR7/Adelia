import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth'
import { auth } from '../config/firebase'
import { clearMustChangePassword, updateCompanyLoginPassword } from './firestore'
import { slugify, slugToAuthEmail } from '../utils/helpers'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'El nombre no es válido.',
  'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
  'auth/user-not-found': 'Nombre o contraseña incorrectos.',
  'auth/wrong-password': 'Nombre o contraseña incorrectos.',
  'auth/invalid-credential': 'Nombre o contraseña incorrectos.',
  'auth/weak-password': 'La nueva contraseña es demasiado débil.',
  'auth/too-many-requests':
    'Demasiados intentos fallidos. Inténtalo de nuevo más tarde.',
  'auth/network-request-failed':
    'Error de conexión. Comprueba tu internet e inténtalo de nuevo.',
  'auth/requires-recent-login':
    'Vuelve a iniciar sesión e inténtalo de nuevo.',
}

export function getAuthErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    if (error.code === 'permission-denied') {
      return 'Firestore bloquea el acceso. Cambia las reglas en Firebase Console y ejecuta npm run seed.'
    }

    return AUTH_ERROR_MESSAGES[error.code] ?? 'No se pudo iniciar sesión.'
  }

  return 'No se pudo iniciar sesión.'
}

export async function loginWithUsername(username: string, password: string) {
  const email = slugToAuthEmail(slugify(username))
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
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
  companyId: string | null,
): Promise<void> {
  await changePasswordWithReauth(currentPassword, newPassword)

  const user = auth.currentUser

  if (!user) {
    throw new Error('No hay sesión activa.')
  }

  if (companyId) {
    await updateCompanyLoginPassword(companyId, newPassword)
  }

  await clearMustChangePassword(user.uid)
}

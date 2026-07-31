import type { User } from 'firebase/auth'
import type { AppUser } from '../types'

export function computeMustChangePassword(
  profile: AppUser,
  credentialsMustChange: boolean | null,
): boolean {
  const userRequired = profile.mustChangePassword === true
  const userCleared = profile.mustChangePasswordCleared
  const credRequired = credentialsMustChange === true
  const credCleared = credentialsMustChange === false

  if (userCleared && credCleared) {
    return false
  }

  return userRequired || credRequired
}

export async function resolveMustChangePassword(
  user: User,
  profile: AppUser,
  credentialsMustChange: boolean | null,
): Promise<AppUser> {
  void user

  return {
    ...profile,
    mustChangePassword: computeMustChangePassword(profile, credentialsMustChange),
  }
}

export function getPostLoginPath(profile: AppUser) {
  if (profile.role === 'admin') {
    return '/admin'
  }

  if (profile.mustChangePassword) {
    return '/cambiar-contrasena'
  }

  return '/'
}

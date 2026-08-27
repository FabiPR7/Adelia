import type { User } from 'firebase/auth'
import type { AppUser, UserRole } from '../types'

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

export function resolveSafeRedirect(redirect: string | null | undefined): string | null {
  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//') || redirect.includes('\\')) {
    return null
  }
  if (/[\t\n\r]/.test(redirect) || redirect.includes('://')) {
    return null
  }
  try {
    const parsed = new URL(redirect, 'https://adeliareservas.com')
    if (parsed.origin !== 'https://adeliareservas.com' || parsed.username || parsed.password) {
      return null
    }
  } catch {
    return null
  }
  return redirect
}

export function unauthenticatedPathForRole(role: UserRole): string {
  return role === 'customer' ? '/cuenta/entrar' : '/login'
}

export function getPostLoginPath(profile: AppUser, user?: { emailVerified: boolean } | null) {
  if (profile.role === 'admin') {
    return '/admin'
  }

  if (profile.role === 'customer') {
    if (user && profile.authProvider === 'password' && !user.emailVerified) {
      return '/cuenta/verificar-email'
    }

    if (!profile.onboardingCompleted) {
      return '/cuenta/completar-perfil'
    }

    return '/app/explorar'
  }

  if (profile.mustChangePassword) {
    return '/cambiar-contrasena'
  }

  return '/panel'
}

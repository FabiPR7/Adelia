import type { User } from 'firebase/auth'
import type { AppUser } from '../types'

export function needsEmailVerification(user: User, profile: AppUser): boolean {
  return profile.authProvider === 'password' && !user.emailVerified
}

export function needsOnboarding(profile: AppUser): boolean {
  return !profile.onboardingCompleted
}

export function getCustomerDestination(user: User, profile: AppUser): string {
  if (needsEmailVerification(user, profile)) {
    return '/cuenta/verificar-email'
  }

  if (needsOnboarding(profile)) {
    return '/cuenta/completar-perfil'
  }

  return '/app/explorar'
}

export function normalizePhoneE164(raw: string): string {
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, '')

  if (trimmed.startsWith('+')) {
    return `+${digits}`
  }

  if (digits.startsWith('34') && digits.length >= 11) {
    return `+${digits}`
  }

  if (digits.length === 9) {
    return `+34${digits}`
  }

  return `+${digits}`
}

export interface PasswordChecks {
  minLength: boolean
  uppercase: boolean
  lowercase: boolean
  specialChar: boolean
  match: boolean
}

export const PASSWORD_REQUIREMENTS = [
  { key: 'minLength' as const, label: 'Al menos 8 caracteres' },
  { key: 'uppercase' as const, label: 'Una letra mayúscula' },
  { key: 'lowercase' as const, label: 'Una letra minúscula' },
  { key: 'specialChar' as const, label: 'Un carácter especial (!@#$…)' },
  { key: 'match' as const, label: 'Las contraseñas coinciden' },
]

export function getPasswordChecks(password: string, confirmPassword: string): PasswordChecks {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-ZÁÉÍÓÚÑÜ]/.test(password),
    lowercase: /[a-záéíóúñü]/.test(password),
    specialChar: /[^A-Za-z0-9ÁÉÍÓÚÑÜáéíóúñü]/.test(password),
    match: password.length > 0 && confirmPassword.length > 0 && password === confirmPassword,
  }
}

export function isPasswordValid(checks: PasswordChecks): boolean {
  return PASSWORD_REQUIREMENTS.every((requirement) => checks[requirement.key])
}

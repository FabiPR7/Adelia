export interface PasswordValidationResult {
  isValid: boolean
  errors: string[]
  strength: 'weak' | 'medium' | 'strong'
}

export interface PasswordCheck {
  label: string
  met: boolean
}

export const PASSWORD_REQUIREMENTS = [
  { key: 'length', label: 'Mínimo 8 caracteres', test: (pwd: string) => pwd.length >= 8 },
  { key: 'lowercase', label: 'Una letra minúscula', test: (pwd: string) => /[a-z]/.test(pwd) },
  { key: 'uppercase', label: 'Una letra mayúscula', test: (pwd: string) => /[A-Z]/.test(pwd) },
  { key: 'number', label: 'Un número', test: (pwd: string) => /[0-9]/.test(pwd) },
]

export function getPasswordChecks(password: string, confirmPassword: string): PasswordCheck[] {
  const checks: PasswordCheck[] = PASSWORD_REQUIREMENTS.map(req => ({
    label: req.label,
    met: req.test(password),
  }))

  if (confirmPassword) {
    checks.push({
      label: 'Las contraseñas coinciden',
      met: password === confirmPassword,
    })
  }

  return checks
}

export function isPasswordValid(checks: PasswordCheck[]): boolean {
  return checks.every(check => check.met)
}

/** Contraseña lista para Firebase Auth: se hashea allí, nunca en Firestore. */
export function requireAuthPassword(password: string): string {
  const result = validatePasswordStrength(password)
  if (!result.isValid) {
    throw new Error(result.errors[0] ?? 'La contraseña no cumple los requisitos.')
  }
  return password
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = []
  let strength: 'weak' | 'medium' | 'strong' = 'weak'
  
  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Debe incluir al menos una letra minúscula')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Debe incluir al menos una letra mayúscula')
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Debe incluir al menos un número')
  }
  
  if (password.length >= 12 && /[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    strength = 'strong'
  } else if (errors.length === 0) {
    strength = 'medium'
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength,
  }
}

export function getPasswordStrengthLabel(strength: 'weak' | 'medium' | 'strong'): string {
  switch (strength) {
    case 'weak':
      return 'Débil'
    case 'medium':
      return 'Media'
    case 'strong':
      return 'Fuerte'
  }
}

export function getPasswordStrengthColor(strength: 'weak' | 'medium' | 'strong'): string {
  switch (strength) {
    case 'weak':
      return '#ef4444'
    case 'medium':
      return '#f59e0b'
    case 'strong':
      return '#10b981'
  }
}

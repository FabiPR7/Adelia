/** Campos que nunca deben persistirse en Firestore. La contraseña vive en Firebase Auth. */
export const FIRESTORE_FORBIDDEN_SECRET_KEYS = [
  'loginPassword',
  'password',
  'passwordHash',
  'passwordSalt',
  'pwd',
] as const

export function hasForbiddenSecretField(data: Record<string, unknown> | null | undefined): boolean {
  if (!data) {
    return false
  }
  return FIRESTORE_FORBIDDEN_SECRET_KEYS.some((key) => key in data)
}

export function omitSecretFields<T extends Record<string, unknown>>(data: T): T {
  const next = { ...data }
  for (const key of FIRESTORE_FORBIDDEN_SECRET_KEYS) {
    delete next[key]
  }
  return next
}

export function assertNoSecretFields(data: Record<string, unknown>, context: string): void {
  const found = FIRESTORE_FORBIDDEN_SECRET_KEYS.filter((key) => key in data && data[key] != null && data[key] !== '')
  if (found.length > 0) {
    throw new Error(`${context}: no se puede guardar ${found.join(', ')} en Firestore. Firebase Auth hashea la contraseña.`)
  }
}

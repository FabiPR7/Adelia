/** Debe coincidir con LEGAL_ACCEPTANCE_VERSION en src/content/publicLegal.ts */
export const LEGAL_ACCEPTANCE_VERSION = '2026-09-26'

export function requireAcceptedLegalVersion(value: unknown): string {
  const version = typeof value === 'string' ? value.trim() : ''
  if (version !== LEGAL_ACCEPTANCE_VERSION) {
    throw new Error('Debes aceptar el aviso legal, la privacidad y los términos vigentes.')
  }
  return version
}

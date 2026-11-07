/** Debe coincidir con LEGAL_ACCEPTANCE_VERSION en src/content/publicLegal.ts */
export const LEGAL_ACCEPTANCE_VERSION = '2026-11-07'

// La app móvil se publica por separado y aún envía su versión: no debe romper su registro.
const STILL_ACCEPTED_VERSIONS = [LEGAL_ACCEPTANCE_VERSION, '2026-09-26']

export function requireAcceptedLegalVersion(value: unknown): string {
  const version = typeof value === 'string' ? value.trim() : ''
  if (!STILL_ACCEPTED_VERSIONS.includes(version)) {
    throw new Error('Debes aceptar el aviso legal y los términos vigentes.')
  }
  return version
}

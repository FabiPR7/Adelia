export function normalizeClientEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidClientEmail(email: string): boolean {
  const trimmed = email.trim()
  return trimmed.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)
}

export function clientDocIdFromEmail(email: string): string {
  return normalizeClientEmail(email)
}

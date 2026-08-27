import { slugToAuthEmail, slugify } from '../utils.ts'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function staffAuthEmailCandidates(loginName: string): string[] {
  const trimmed = loginName.trim()
  const emails: string[] = []

  if (trimmed.includes('@')) {
    emails.push(normalizeEmail(trimmed))
  }

  const slug = slugify(trimmed)
  if (slug) {
    emails.push(slugToAuthEmail(slug))
    emails.push(`${slug}@adeliareservas.com`)
  }

  return [...new Set(emails.filter(Boolean))]
}

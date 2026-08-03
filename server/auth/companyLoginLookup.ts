import { adminDb } from '../firebase-admin.ts'

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function resolveCompanyIdFromLoginName(loginName: string): Promise<string | null> {
  const trimmed = loginName.trim()

  if (!trimmed) {
    return null
  }

  const normalized = slugify(trimmed)
  const loginDoc = await adminDb.collection('logins').doc(normalized).get()

  if (loginDoc.exists) {
    const companyId = loginDoc.data()?.companyId as string | undefined

    if (companyId) {
      return companyId
    }
  }

  const byLoginName = await adminDb
    .collection('logins')
    .where('loginName', '==', trimmed)
    .limit(1)
    .get()

  if (!byLoginName.empty) {
    const companyId = byLoginName.docs[0].data().companyId as string | undefined

    if (companyId) {
      return companyId
    }
  }

  const companyLogins = await adminDb.collection('logins').where('role', '==', 'company').get()
  const loginByDisplayName = companyLogins.docs.find((item) => {
    const storedLoginName = item.data().loginName as string | undefined

    if (!storedLoginName) {
      return false
    }

    return storedLoginName === trimmed || slugify(storedLoginName) === normalized
  })

  if (loginByDisplayName) {
    const companyId = loginByDisplayName.data().companyId as string | undefined

    if (companyId) {
      return companyId
    }
  }

  const companies = await adminDb.collection('companies').get()
  const companyMatch = companies.docs.find((item) => {
    const name = item.data().name as string
    return name === trimmed || slugify(name) === normalized
  })

  return companyMatch?.id ?? null
}

export async function getCompanyContactEmail(companyId: string): Promise<string> {
  const companySnap = await adminDb.collection('companies').doc(companyId).get()

  if (!companySnap.exists) {
    return ''
  }

  return normalizeEmail((companySnap.data()?.contactEmail as string | undefined) ?? '')
}

export function emailsMatch(storedEmail: string, submittedEmail: string): boolean {
  const normalizedStored = normalizeEmail(storedEmail)
  const normalizedSubmitted = normalizeEmail(submittedEmail)

  return normalizedStored.length > 0 && normalizedStored === normalizedSubmitted
}

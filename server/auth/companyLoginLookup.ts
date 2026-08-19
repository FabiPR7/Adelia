import { adminDb } from '../firebase-admin.ts'
import { slugToAuthEmail, slugify } from '../utils.ts'

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

export async function resolveCompanyAuthEmail(loginName: string): Promise<string | null> {
  const trimmed = loginName.trim()
  if (!trimmed) {
    return null
  }

  const normalized = slugify(trimmed)
  const loginDoc = await adminDb.collection('logins').doc(normalized).get()
  if (loginDoc.exists) {
    const authEmail = loginDoc.data()?.authEmail as string | undefined
    if (authEmail) {
      return normalizeEmail(authEmail)
    }
  }

  const byLoginName = await adminDb
    .collection('logins')
    .where('loginName', '==', trimmed)
    .limit(1)
    .get()
  if (!byLoginName.empty) {
    const authEmail = byLoginName.docs[0].data().authEmail as string | undefined
    if (authEmail) {
      return normalizeEmail(authEmail)
    }
  }

  const companyBySlug = await adminDb
    .collection('companies')
    .where('slug', '==', normalized)
    .limit(1)
    .get()
  if (!companyBySlug.empty) {
    const companyId = companyBySlug.docs[0].id
    const credentialsSnap = await adminDb.collection('companyCredentials').doc(companyId).get()
    const credentialsEmail = credentialsSnap.data()?.authEmail as string | undefined
    if (credentialsEmail) {
      return normalizeEmail(credentialsEmail)
    }
    return slugToAuthEmail(normalized)
  }

  return null
}

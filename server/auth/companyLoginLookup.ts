import { adminAuth, adminDb } from '../firebase-admin.ts'
import { slugify } from '../utils.ts'
import { staffAuthEmailCandidates } from './staffAuthEmails.ts'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isStaffRole(role: unknown): role is 'admin' | 'company' {
  return role === 'admin' || role === 'company'
}

async function staffEmailFromUid(uid: string): Promise<string | null> {
  const snap = await adminDb.collection('users').doc(uid).get()
  if (!snap.exists) {
    return null
  }

  const data = snap.data()
  if (!isStaffRole(data?.role)) {
    return null
  }

  try {
    const record = await adminAuth.getUser(uid)
    if (record.email) {
      return normalizeEmail(record.email)
    }
  } catch {
    // Si Auth no responde, caemos al email del perfil.
  }

  const email = typeof data?.email === 'string' ? data.email : ''
  return email ? normalizeEmail(email) : null
}

async function staffEmailFromAuthEmail(email: string | undefined): Promise<string | null> {
  if (!email) {
    return null
  }

  const normalized = normalizeEmail(email)
  if (!normalized.includes('@')) {
    return null
  }

  try {
    const record = await adminAuth.getUserByEmail(normalized)
    return staffEmailFromUid(record.uid)
  } catch {
    return null
  }
}

async function staffEmailFromCompanyId(companyId: unknown): Promise<string | null> {
  if (typeof companyId !== 'string' || !companyId.trim()) {
    return null
  }

  const companySnap = await adminDb.collection('companies').doc(companyId).get()
  const ownerUid = companySnap.data()?.ownerUid as string | undefined
  return ownerUid ? staffEmailFromUid(ownerUid) : null
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

  const companyBySlug = await adminDb
    .collection('companies')
    .where('slug', '==', normalized)
    .limit(1)
    .get()

  return companyBySlug.empty ? null : companyBySlug.docs[0].id
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
    const fromLogin = await staffEmailFromAuthEmail(loginDoc.data()?.authEmail as string | undefined)
    if (fromLogin) {
      return fromLogin
    }
    const fromCompanyOwner = await staffEmailFromCompanyId(loginDoc.data()?.companyId)
    if (fromCompanyOwner) {
      return fromCompanyOwner
    }
  }

  const byLoginName = await adminDb
    .collection('logins')
    .where('loginName', '==', trimmed)
    .limit(1)
    .get()
  if (!byLoginName.empty) {
    const fromLoginName = await staffEmailFromAuthEmail(
      byLoginName.docs[0].data().authEmail as string | undefined,
    )
    if (fromLoginName) {
      return fromLoginName
    }
  }

  const companyBySlug = await adminDb
    .collection('companies')
    .where('slug', '==', normalized)
    .limit(1)
    .get()
  if (!companyBySlug.empty) {
    const companyId = companyBySlug.docs[0].id
    const ownerUid = companyBySlug.docs[0].data()?.ownerUid as string | undefined
    const fromOwner = ownerUid ? await staffEmailFromUid(ownerUid) : null
    if (fromOwner) {
      return fromOwner
    }
    const credentialsSnap = await adminDb.collection('companyCredentials').doc(companyId).get()
    const fromCredentials = await staffEmailFromAuthEmail(
      credentialsSnap.data()?.authEmail as string | undefined,
    )
    if (fromCredentials) {
      return fromCredentials
    }
  }

  const usersByLoginName = await adminDb
    .collection('users')
    .where('loginName', '==', trimmed)
    .limit(1)
    .get()
  if (!usersByLoginName.empty) {
    const fromProfile = await staffEmailFromUid(usersByLoginName.docs[0].id)
    if (fromProfile) {
      return fromProfile
    }
  }

  for (const candidate of staffAuthEmailCandidates(trimmed)) {
    const fromAuth = await staffEmailFromAuthEmail(candidate)
    if (fromAuth) {
      return fromAuth
    }
  }

  return null
}

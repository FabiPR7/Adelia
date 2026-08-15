import type { Request } from 'express'
import { adminAuth, adminDb } from '../firebase-admin.ts'

function readInternalSecret(req: Request): string | null {
  const configured = process.env.INTERNAL_API_SECRET?.trim()
  if (!configured) {
    return null
  }

  const header = req.headers['x-internal-secret']
  if (typeof header !== 'string' || header.trim() !== configured) {
    return null
  }

  return configured
}

async function isCompanyOwnerForReservation(
  uid: string,
  companyId: string,
): Promise<boolean> {
  const [companySnap, userSnap] = await Promise.all([
    adminDb.collection('companies').doc(companyId).get(),
    adminDb.collection('users').doc(uid).get(),
  ])

  if (!userSnap.exists) {
    return false
  }

  const role = userSnap.data()?.role as string | undefined
  const userCompanyId = userSnap.data()?.companyId as string | undefined

  if (role === 'admin') {
    return true
  }

  if (role === 'company' && userCompanyId === companyId) {
    return true
  }

  if (companySnap.exists && companySnap.data()?.ownerUid === uid) {
    return true
  }

  return false
}

export async function canManageReservationNotifications(
  req: Request,
  reservation: FirebaseFirestore.DocumentData,
): Promise<boolean> {
  if (readInternalSecret(req)) {
    return true
  }

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return false
  }

  try {
    const decoded = await adminAuth.verifyIdToken(header.slice(7))
    const companyId = typeof reservation.companyId === 'string' ? reservation.companyId : ''
    if (!companyId) {
      return false
    }

    return isCompanyOwnerForReservation(decoded.uid, companyId)
  } catch {
    return false
  }
}

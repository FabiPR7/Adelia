import type { NextFunction, Request, Response } from 'express'
import { adminAuth, adminDb, canUseAdminSdk } from '../firebase-admin.ts'
import { getUserRoleWithRest, verifyIdTokenWithRest } from '../rest-firebase.ts'

export interface VerifiedRequestUser {
  uid: string
  email: string
  data: FirebaseFirestore.DocumentData
}

function bearerToken(req: Request): string {
  const header = req.headers.authorization
  return header?.startsWith('Bearer ') ? header.slice(7) : ''
}

async function verifyRequestUser(req: Request): Promise<VerifiedRequestUser> {
  const token = bearerToken(req)
  if (!token) {
    throw new Error('No autorizado.')
  }

  const decoded = await adminAuth.verifyIdToken(token)
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get()
  if (!userSnap.exists) {
    throw new Error('Perfil no encontrado.')
  }

  const data = userSnap.data()!
  const email = typeof data.email === 'string'
    ? data.email.trim().toLowerCase()
    : decoded.email?.trim().toLowerCase() ?? ''

  return { uid: decoded.uid, email, data }
}

export async function verifyCustomerUid(req: Request): Promise<VerifiedRequestUser> {
  const user = await verifyRequestUser(req)
  if (user.data.role !== 'customer' || !user.email) {
    throw new Error('Debes iniciar sesión como cliente.')
  }
  return user
}

export async function verifyCompanyOwner(
  req: Request,
  companyId: string,
): Promise<VerifiedRequestUser> {
  const user = await verifyRequestUser(req)
  const companySnap = await adminDb.collection('companies').doc(companyId).get()
  if (
    user.data.role !== 'admin'
    && user.data.companyId !== companyId
    && companySnap.data()?.ownerUid !== user.uid
  ) {
    throw new Error('No tienes acceso a este restaurante.')
  }
  return user
}

export async function ensureCompanyOwner(
  req: Request,
  res: Response,
  companyId: string,
): Promise<boolean> {
  try {
    if (!companyId.trim()) {
      res.status(400).json({ error: 'Restaurante no válido.' })
      return false
    }
    await verifyCompanyOwner(req, companyId)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No autorizado.'
    const status = message.includes('acceso') ? 403 : 401
    res.status(status).json({ error: message })
    return false
  }
}

export async function verifyCompanyAccount(req: Request): Promise<VerifiedRequestUser & { companyId: string }> {
  const user = await verifyRequestUser(req)
  const companyId = typeof user.data.companyId === 'string' ? user.data.companyId.trim() : ''
  if (user.data.role !== 'company' || !companyId) {
    throw new Error('Debes iniciar sesión como restaurante.')
  }
  return { ...user, companyId }
}

export async function verifySignedInUser(req: Request): Promise<VerifiedRequestUser> {
  return verifyRequestUser(req)
}

export async function verifyAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!canUseAdminSdk) {
      const token = bearerToken(req)
      if (!token) {
        res.status(401).json({ error: 'No autorizado.' })
        return
      }
      const decoded = await verifyIdTokenWithRest(token)
      const role = await getUserRoleWithRest(token, decoded.uid)
      if (role !== 'admin') {
        res.status(403).json({ error: 'Solo el administrador puede realizar esta acción.' })
        return
      }
      next()
      return
    }

    const user = await verifyRequestUser(req)
    if (user.data.role !== 'admin') {
      res.status(403).json({ error: 'Solo el administrador puede realizar esta acción.' })
      return
    }
    next()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token inválido o expirado.'
    res.status(401).json({ error: message })
  }
}

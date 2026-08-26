import { Router, type Request, type Response } from 'express'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb, canUseAdminSdk } from '../firebase-admin.ts'
import { signInWithPasswordRest } from '../rest-firebase.ts'

const router = Router()

function getBearerToken(req: Request) {
  return req.headers.authorization?.slice(7) ?? ''
}

function userMustChangePassword(
  userData: Record<string, unknown>,
  decoded: { mustChangePassword?: boolean },
) {
  return userData.mustChangePassword === true || decoded.mustChangePassword === true
}

router.post('/complete-initial-password-change', async (req: Request, res: Response) => {
  try {
    if (!canUseAdminSdk) {
      res.status(503).json({
        error:
          'Sincronizar contraseña requiere serviceAccountKey.json en la raíz del proyecto.',
      })
      return
    }

    const token = getBearerToken(req)
    const { newPassword } = req.body as { newPassword?: string }

    if (!token) {
      res.status(401).json({ error: 'No autorizado.' })
      return
    }

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'Contraseña nueva no válida.' })
      return
    }

    const decoded = await adminAuth.verifyIdToken(token)
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get()

    if (!userSnap.exists) {
      res.status(404).json({ error: 'Perfil no encontrado.' })
      return
    }

    const userData = userSnap.data()!

    if (userData.role !== 'company') {
      res.status(403).json({ error: 'Esta acción solo aplica a cuentas de empresa.' })
      return
    }

    await adminAuth.setCustomUserClaims(decoded.uid, { mustChangePassword: false })

    const companyId = userData.companyId as string
    const now = Timestamp.now()

    await adminDb.collection('users').doc(decoded.uid).update({
      mustChangePassword: false,
    })

    if (companyId) {
      await adminDb.collection('companyCredentials').doc(companyId).set(
        {
          loginPassword: FieldValue.delete(),
          mustChangePassword: false,
          updatedAt: now,
        },
        { merge: true },
      )
    }

    res.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al sincronizar la contraseña.'
    res.status(500).json({ error: message })
  }
})

router.post('/change-initial-password', async (req: Request, res: Response) => {
  try {
    if (!canUseAdminSdk) {
      res.status(503).json({
        error:
          'Cambiar contraseña requiere serviceAccountKey.json en la raíz del proyecto.',
      })
      return
    }

    const token = getBearerToken(req)
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string
      newPassword?: string
    }

    if (!token) {
      res.status(401).json({ error: 'No autorizado.' })
      return
    }

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Indica la contraseña actual y la nueva.' })
      return
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' })
      return
    }

    if (currentPassword === newPassword) {
      res.status(400).json({
        error: 'La nueva contraseña debe ser distinta a la contraseña temporal.',
      })
      return
    }

    const decoded = await adminAuth.verifyIdToken(token)
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get()

    if (!userSnap.exists) {
      res.status(404).json({ error: 'Perfil no encontrado.' })
      return
    }

    const userData = userSnap.data()!

    if (userData.role !== 'company') {
      res.status(403).json({ error: 'Esta acción solo aplica a cuentas de empresa.' })
      return
    }

    if (!userMustChangePassword(userData, decoded)) {
      res.status(400).json({ error: 'No necesitas cambiar la contraseña.' })
      return
    }

    const email = (userData.email as string) ?? decoded.email

    if (!email) {
      res.status(400).json({ error: 'No se pudo verificar la cuenta.' })
      return
    }

    try {
      await signInWithPasswordRest(email, currentPassword)
    } catch {
      res.status(401).json({ error: 'La contraseña actual no es correcta.' })
      return
    }

    await adminAuth.updateUser(decoded.uid, { password: newPassword })
    await adminAuth.setCustomUserClaims(decoded.uid, { mustChangePassword: false })

    const companyId = userData.companyId as string
    const now = Timestamp.now()

    await adminDb.collection('users').doc(decoded.uid).update({
      mustChangePassword: false,
    })

    if (companyId) {
      await adminDb.collection('companyCredentials').doc(companyId).set(
        {
          loginPassword: FieldValue.delete(),
          mustChangePassword: false,
          updatedAt: now,
        },
        { merge: true },
      )
    }

    res.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al cambiar la contraseña.'
    res.status(500).json({ error: message })
  }
})

export default router

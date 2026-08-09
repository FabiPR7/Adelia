import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import {
  emailsMatch,
  getCompanyContactEmail,
  resolveCompanyIdFromLoginName,
} from '../auth/companyLoginLookup.ts'
import {
  createPasswordResetToken,
  deletePasswordResetToken,
  getPasswordResetTokenRecord,
  sendPasswordResetEmail,
} from '../email/passwordResetEmail.ts'
import { sendCustomerVerificationEmail } from '../email/customerVerificationEmail.ts'
import { APP_URL, isValidClientEmail } from '../email/config.ts'
import { adminAuth, adminDb, canUseAdminSdk } from '../firebase-admin.ts'
import { signInWithPasswordRest } from '../rest-firebase.ts'

const router = Router()

const GENERIC_FORGOT_SUCCESS =
  'Si los datos son correctos, recibirás un correo con instrucciones en unos minutos.'

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
          loginPassword: newPassword,
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
          loginPassword: newPassword,
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

router.post('/customer/send-verification-email', async (req: Request, res: Response) => {
  try {
    if (!canUseAdminSdk) {
      res.status(503).json({
        error: 'Verificación por correo no disponible en este entorno.',
      })
      return
    }

    const token = getBearerToken(req)

    if (!token) {
      res.status(401).json({ error: 'No autorizado.' })
      return
    }

    const decoded = await adminAuth.verifyIdToken(token)
    const userRecord = await adminAuth.getUser(decoded.uid)

    if (userRecord.emailVerified) {
      res.json({ success: true, alreadyVerified: true })
      return
    }

    const userSnap = await adminDb.collection('users').doc(decoded.uid).get()

    if (!userSnap.exists || userSnap.data()?.role !== 'customer') {
      res.status(403).json({ error: 'Esta acción solo aplica a cuentas de cliente.' })
      return
    }

    const email = userRecord.email?.trim().toLowerCase() ?? ''

    if (!isValidClientEmail(email)) {
      res.status(400).json({ error: 'No se pudo verificar el correo de la cuenta.' })
      return
    }

    const displayName =
      userRecord.displayName?.trim()
      || (userSnap.data()?.displayName as string | undefined)?.trim()
      || 'Comensal'

    const verifyUrl = await adminAuth.generateEmailVerificationLink(email, {
      url: `${APP_URL}/cuenta/entrar?verified=1`,
      handleCodeInApp: false,
    })

    await sendCustomerVerificationEmail({
      to: email,
      displayName,
      verifyUrl,
    })

    res.json({ success: true })
  } catch (error) {
    console.error('customer send-verification-email error:', error)
    const message =
      error instanceof Error ? error.message : 'No se pudo enviar el correo de verificación.'
    res.status(500).json({ error: message })
  }
})

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    if (!canUseAdminSdk) {
      res.status(503).json({
        error: 'Recuperación de contraseña no disponible en este entorno.',
      })
      return
    }

    const { loginName, email } = req.body as {
      loginName?: string
      email?: string
    }

    if (!loginName?.trim() || !email?.trim()) {
      res.status(400).json({ error: 'Indica el nombre de la empresa y el correo registrado.' })
      return
    }

    if (!isValidClientEmail(email)) {
      res.status(400).json({ error: 'Indica un correo válido.' })
      return
    }

    const companyId = await resolveCompanyIdFromLoginName(loginName)

    if (!companyId) {
      res.json({ success: true, message: GENERIC_FORGOT_SUCCESS })
      return
    }

    const [companySnap, credentialsSnap, contactEmail] = await Promise.all([
      adminDb.collection('companies').doc(companyId).get(),
      adminDb.collection('companyCredentials').doc(companyId).get(),
      getCompanyContactEmail(companyId),
    ])

    if (!companySnap.exists || !credentialsSnap.exists || !emailsMatch(contactEmail, email)) {
      res.json({ success: true, message: GENERIC_FORGOT_SUCCESS })
      return
    }

    const companyName = (companySnap.data()?.name as string | undefined) ?? 'Tu restaurante'
    const ownerUid = credentialsSnap.data()?.ownerUid as string | undefined

    if (!ownerUid) {
      res.json({ success: true, message: GENERIC_FORGOT_SUCCESS })
      return
    }

    const token = await createPasswordResetToken(companyId, ownerUid, email)

    try {
      await sendPasswordResetEmail({
        to: email,
        companyName,
        token,
      })
    } catch (sendError) {
      await deletePasswordResetToken(token)
      console.error('Password reset email failed:', sendError)
      res.status(503).json({
        error: 'No se pudo enviar el correo. Inténtalo más tarde.',
      })
      return
    }

    res.json({ success: true, message: GENERIC_FORGOT_SUCCESS })
  } catch (error) {
    console.error('forgot-password error:', error)
    res.status(500).json({ error: 'No se pudo procesar la solicitud.' })
  }
})

router.get('/reset-password/validate', async (req: Request, res: Response) => {
  try {
    if (!canUseAdminSdk) {
      res.status(503).json({ valid: false })
      return
    }

    const token = typeof req.query.token === 'string' ? req.query.token.trim() : ''

    if (!token) {
      res.status(400).json({ valid: false })
      return
    }

    const record = await getPasswordResetTokenRecord(token)

    if (!record) {
      res.json({ valid: false })
      return
    }

    const companySnap = await adminDb.collection('companies').doc(record.companyId).get()

    res.json({
      valid: true,
      companyName: (companySnap.data()?.name as string | undefined) ?? '',
    })
  } catch (error) {
    console.error('reset-password validate error:', error)
    res.status(500).json({ valid: false })
  }
})

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    if (!canUseAdminSdk) {
      res.status(503).json({
        error: 'Restablecer contraseña no disponible en este entorno.',
      })
      return
    }

    const { token, newPassword } = req.body as {
      token?: string
      newPassword?: string
    }

    if (!token?.trim() || !newPassword) {
      res.status(400).json({ error: 'Indica el enlace y la nueva contraseña.' })
      return
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' })
      return
    }

    const record = await getPasswordResetTokenRecord(token.trim())

    if (!record) {
      res.status(400).json({
        error: 'El enlace no es válido o ha caducado. Solicita uno nuevo.',
      })
      return
    }

    await adminAuth.updateUser(record.ownerUid, { password: newPassword })
    await adminAuth.setCustomUserClaims(record.ownerUid, { mustChangePassword: false })

    const now = Timestamp.now()

    await adminDb.collection('users').doc(record.ownerUid).set(
      {
        mustChangePassword: false,
      },
      { merge: true },
    )

    await adminDb.collection('companyCredentials').doc(record.companyId).set(
      {
        loginPassword: newPassword,
        mustChangePassword: false,
        updatedAt: now,
      },
      { merge: true },
    )

    await deletePasswordResetToken(record.token)

    res.json({ success: true })
  } catch (error) {
    console.error('reset-password error:', error)
    const message =
      error instanceof Error ? error.message : 'No se pudo restablecer la contraseña.'
    res.status(500).json({ error: message })
  }
})

export default router

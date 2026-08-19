import { Router, type Request, type Response } from 'express'
import { verifySignedInUser } from '../auth/verifyRequest.ts'
import { readGamificationFromDocs, userGamificationRef } from '../data/userGamification.ts'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import {
  emailsMatch,
  getCompanyContactEmail,
  resolveCompanyAuthEmail,
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
import { InputError, asPassword, asTrimmed } from '../security/validate.ts'
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

function toIsoDate(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString()
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  if (typeof value === 'string') {
    return value
  }
  return new Date().toISOString()
}

router.get('/profile', async (req: Request, res: Response) => {
  try {
    const user = await verifySignedInUser(req)
    const statsSnap = await userGamificationRef(user.uid).get()
    const gamification = readGamificationFromDocs(statsSnap.data(), user.data)
    const data = user.data
    let favoriteSlugs = Array.isArray(data.favoriteSlugs)
      ? data.favoriteSlugs.filter((item): item is string => typeof item === 'string')
      : []
    try {
      const favSnap = await adminDb.collection('userFavorites').where('userId', '==', user.uid).get()
      if (!favSnap.empty) {
        favoriteSlugs = [...new Set(
          favSnap.docs
            .map((item) => item.data().slug)
            .filter((item): item is string => typeof item === 'string' && item.length > 0),
        )]
      }
    } catch {
      // Índice de favoritos aún no rellenado.
    }

    res.json({
      email: typeof data.email === 'string' ? data.email : user.email,
      role: data.role === 'admin' || data.role === 'company' || data.role === 'customer'
        ? data.role
        : 'customer',
      companyId: typeof data.companyId === 'string' ? data.companyId : null,
      displayName: typeof data.displayName === 'string' ? data.displayName : '',
      favoriteSlugs,
      gamification,
      xp: typeof gamification.xp === 'number' ? gamification.xp : 0,
      adelinas: typeof gamification.adelinas === 'number' ? gamification.adelinas : 0,
      mustChangePassword: data.mustChangePassword === true,
      createdAt: toIsoDate(data.createdAt),
      phone: typeof data.phone === 'string' ? data.phone : '',
      phoneVerified: data.phoneVerified === true,
      photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : '',
      homeCity: typeof data.homeCity === 'string' ? data.homeCity : '',
      homeMunicipality: typeof data.homeMunicipality === 'string' ? data.homeMunicipality : '',
      homeCountry: typeof data.homeCountry === 'string' ? data.homeCountry : '',
      homePostalCode: typeof data.homePostalCode === 'string' ? data.homePostalCode : '',
      homeLatitude: typeof data.homeLatitude === 'number' ? data.homeLatitude : null,
      homeLongitude: typeof data.homeLongitude === 'number' ? data.homeLongitude : null,
      foodPreferences: Array.isArray(data.foodPreferences) ? data.foodPreferences : [],
      onboardingCompleted: data.onboardingCompleted === true
        || (data.onboardingCompleted == null && Boolean(data.displayName)),
      authProvider: data.authProvider === 'google.com' ? 'google.com' : 'password',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No autorizado.'
    res.status(401).json({ error: message })
  }
})

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

    const email = (userData.email as string | undefined) ?? decoded.email
    if (!email) {
      res.status(400).json({ error: 'No se pudo verificar la cuenta.' })
      return
    }
    try {
      await signInWithPasswordRest(email, newPassword)
    } catch {
      res.status(409).json({ error: 'La contraseña de acceso aún no se ha actualizado.' })
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

router.post('/customer/sync-phone-verification', async (req: Request, res: Response) => {
  try {
    if (!canUseAdminSdk) {
      res.status(503).json({ error: 'Verificación de teléfono no disponible en este entorno.' })
      return
    }
    const token = getBearerToken(req)
    if (!token) {
      res.status(401).json({ error: 'No autorizado.' })
      return
    }
    const decoded = await adminAuth.verifyIdToken(token)
    const [userRecord, userSnap] = await Promise.all([
      adminAuth.getUser(decoded.uid),
      adminDb.collection('users').doc(decoded.uid).get(),
    ])
    if (!userSnap.exists || userSnap.data()?.role !== 'customer' || !userRecord.phoneNumber) {
      res.status(403).json({ error: 'No se pudo verificar el teléfono de la cuenta.' })
      return
    }
    await userSnap.ref.update({
      phone: userRecord.phoneNumber,
      phoneVerified: true,
    })
    res.json({ success: true })
  } catch (error) {
    console.error('sync phone verification error:', error)
    res.status(500).json({ error: 'No se pudo guardar la verificación del teléfono.' })
  }
})

router.post('/resolve-login', async (req: Request, res: Response) => {
  try {
    if (!canUseAdminSdk) {
      res.status(503).json({ error: 'Inicio de sesión no disponible en este entorno.' })
      return
    }

    const loginName = asTrimmed(req.body?.loginName, 80, 'El nombre de usuario')
    const authEmail = await resolveCompanyAuthEmail(loginName)
    if (!authEmail) {
      res.status(401).json({ error: 'Nombre o contraseña incorrectos.' })
      return
    }

    res.json({ authEmail })
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('resolve-login error:', error)
    res.status(500).json({ error: 'No se pudo iniciar sesión.' })
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

    const companyLogin = asTrimmed(loginName, 80, 'El nombre de la empresa')
    if (!email?.trim() || !isValidClientEmail(email)) {
      res.status(400).json({ error: 'Indica un correo válido.' })
      return
    }

    const companyId = await resolveCompanyIdFromLoginName(companyLogin)

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
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message })
      return
    }
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

    if (!token?.trim()) {
      res.status(400).json({ error: 'Indica el enlace y la nueva contraseña.' })
      return
    }

    const password = asPassword(newPassword)

    const record = await getPasswordResetTokenRecord(token.trim())

    if (!record) {
      res.status(400).json({
        error: 'El enlace no es válido o ha caducado. Solicita uno nuevo.',
      })
      return
    }

    await adminAuth.updateUser(record.ownerUid, { password })
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
        loginPassword: FieldValue.delete(),
        mustChangePassword: false,
        updatedAt: now,
      },
      { merge: true },
    )

    await deletePasswordResetToken(record.token)

    res.json({ success: true })
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('reset-password error:', error)
    res.status(500).json({ error: 'No se pudo restablecer la contraseña.' })
  }
})

export default router

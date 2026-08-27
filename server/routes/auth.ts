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
  createCustomerPasswordResetToken,
  createPasswordResetToken,
  deletePasswordResetToken,
  getPasswordResetTokenRecord,
  hashPasswordResetToken,
  sendCustomerPasswordResetEmail,
  sendPasswordResetEmail,
} from '../email/passwordResetEmail.ts'
import { sendCustomerVerificationEmail } from '../email/customerVerificationEmail.ts'
import { APP_URL, isValidClientEmail } from '../email/config.ts'
import { InputError, asOptionalCustomerPhotoUrl, asPassword, asPlainText, asTrimmed } from '../security/validate.ts'
import { adminAuth, adminDb, canUseAdminSdk } from '../firebase-admin.ts'
import { signInWithPasswordRest } from '../rest-firebase.ts'
import { isLoginLocked, recordLoginFailure, recordLoginSuccess } from '../security/loginLockout.ts'
import { requireRecaptcha } from '../security/recaptcha.ts'
import { requireSpanishPhone } from '../security/phone.ts'
import { buildCustomerProfileDoc } from '../data/customerProfile.ts'
import { settleMinDuration } from '../security/timing.ts'

const router = Router()

const GENERIC_FORGOT_SUCCESS =
  'Si los datos son correctos, recibirás un correo con instrucciones en unos minutos.'

const GENERIC_LOGIN_ERROR = 'Nombre o contraseña incorrectos.'
const GENERIC_CUSTOMER_LOGIN_ERROR = 'Email o contraseña incorrectos.'

function asLoginSecret(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128 || /\u0000/.test(value)) {
    throw new InputError(GENERIC_LOGIN_ERROR)
  }
  return value
}

async function findCustomerForPasswordReset(email: string) {
  try {
    const authUser = await adminAuth.getUserByEmail(email)
    if (authUser.disabled) {
      return null
    }

    const profileSnap = await adminDb.collection('users').doc(authUser.uid).get()
    if (!profileSnap.exists) {
      return null
    }

    const data = profileSnap.data() ?? {}
    if (data.role !== 'customer' || data.blocked === true) {
      return null
    }

    const hasPassword = authUser.providerData.some((provider) => provider.providerId === 'password')
    if (!hasPassword) {
      return null
    }

    return {
      uid: authUser.uid,
      email: (authUser.email ?? email).trim().toLowerCase(),
      displayName: typeof data.displayName === 'string' && data.displayName.trim()
        ? data.displayName.trim()
        : 'tu cuenta Adelia',
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/user-not-found') {
      return null
    }
    throw error
  }
}

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
      const favSnap = await adminDb.collection('userFavorites').where('userId', '==', user.uid).limit(50).get()
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

    if (!newPassword) {
      res.status(400).json({ error: 'Contraseña nueva no válida.' })
      return
    }
    asPassword(newPassword)

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
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message })
      return
    }
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

    const nextPassword = asPassword(newPassword)

    if (currentPassword === nextPassword) {
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

    await adminAuth.updateUser(decoded.uid, { password: nextPassword })
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
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message })
      return
    }
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
  const started = Date.now()
  try {
    if (!canUseAdminSdk) {
      res.status(503).json({ error: 'Inicio de sesión no disponible en este entorno.' })
      return
    }

    const loginName = asTrimmed(req.body?.loginName, 80, 'El nombre de usuario')
    const password = asLoginSecret(req.body?.password)

    if (await isLoginLocked(loginName)) {
      await settleMinDuration(started, 450)
      res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' })
      return
    }

    const authEmail = await resolveCompanyAuthEmail(loginName)
    if (!authEmail) {
      await settleMinDuration(started, 450)
      res.status(401).json({ error: GENERIC_LOGIN_ERROR })
      return
    }

    try {
      await signInWithPasswordRest(authEmail, password)
    } catch {
      await recordLoginFailure(loginName)
      await settleMinDuration(started, 450)
      res.status(401).json({ error: GENERIC_LOGIN_ERROR })
      return
    }

    await recordLoginSuccess(loginName)
    await settleMinDuration(started, 450)
    res.json({ authEmail })
  } catch (error) {
    if (error instanceof InputError) {
      await settleMinDuration(started, 450)
      res.status(401).json({ error: GENERIC_LOGIN_ERROR })
      return
    }
    console.error('resolve-login error:', error)
    res.status(500).json({ error: 'No se pudo iniciar sesión.' })
  }
})

router.post('/customer/pre-login', async (req: Request, res: Response) => {
  const started = Date.now()
  try {
    if (!canUseAdminSdk) {
      res.status(503).json({ error: 'Inicio de sesión no disponible en este entorno.' })
      return
    }

    const emailRaw = typeof req.body?.email === 'string' ? req.body.email : ''
    if (!emailRaw.trim() || !isValidClientEmail(emailRaw)) {
      await settleMinDuration(started, 450)
      res.status(401).json({ error: GENERIC_CUSTOMER_LOGIN_ERROR })
      return
    }

    const email = emailRaw.trim().toLowerCase()
    const password = asLoginSecret(req.body?.password)

    if (await isLoginLocked(email)) {
      await settleMinDuration(started, 450)
      res.status(401).json({ error: GENERIC_CUSTOMER_LOGIN_ERROR })
      return
    }

    try {
      await signInWithPasswordRest(email, password)
    } catch {
      await recordLoginFailure(email)
      await settleMinDuration(started, 450)
      res.status(401).json({ error: GENERIC_CUSTOMER_LOGIN_ERROR })
      return
    }

    try {
      const authUser = await adminAuth.getUserByEmail(email)
      const profileSnap = await adminDb.collection('users').doc(authUser.uid).get()
      const data = profileSnap.data()
      if (!profileSnap.exists || data.blocked === true || authUser.disabled) {
        await settleMinDuration(started, 450)
        res.status(401).json({ error: GENERIC_CUSTOMER_LOGIN_ERROR })
        return
      }

      const role = data?.role
      if (role !== 'customer' && role !== 'admin' && role !== 'company') {
        await settleMinDuration(started, 450)
        res.status(401).json({ error: GENERIC_CUSTOMER_LOGIN_ERROR })
        return
      }
    } catch {
      await settleMinDuration(started, 450)
      res.status(401).json({ error: GENERIC_CUSTOMER_LOGIN_ERROR })
      return
    }

    await recordLoginSuccess(email)
    await settleMinDuration(started, 450)
    res.json({ ok: true })
  } catch (error) {
    if (error instanceof InputError) {
      await settleMinDuration(started, 450)
      res.status(401).json({ error: GENERIC_CUSTOMER_LOGIN_ERROR })
      return
    }
    console.error('customer pre-login error:', error)
    res.status(500).json({ error: 'No se pudo iniciar sesión.' })
  }
})

router.post('/customer/register', async (req: Request, res: Response) => {
  try {
    if (!canUseAdminSdk) {
      res.status(503).json({ error: 'Registro no disponible en este entorno.' })
      return
    }

    await requireRecaptcha(req.body?.recaptchaToken, 'register', 0.7)

    const emailRaw = typeof req.body?.email === 'string' ? req.body.email : ''
    if (!emailRaw.trim() || !isValidClientEmail(emailRaw)) {
      res.status(400).json({ error: 'Indica un correo válido.' })
      return
    }

    const email = emailRaw.trim().toLowerCase()
    const password = asPassword(req.body?.password)
    const displayName = asPlainText(req.body?.displayName, 80, 'El nombre')
    const phone = requireSpanishPhone(req.body?.phone)

    const created = await adminAuth.createUser({
      email,
      password,
      displayName,
      emailVerified: false,
      disabled: false,
    })

    try {
      await adminDb.collection('users').doc(created.uid).set(buildCustomerProfileDoc({
        email,
        displayName,
        phone,
        phoneVerified: false,
        authProvider: 'password',
      }))
    } catch (writeError) {
      await adminAuth.deleteUser(created.uid).catch(() => undefined)
      throw writeError
    }

    const verifyUrl = await adminAuth.generateEmailVerificationLink(email, {
      url: `${APP_URL}/cuenta/entrar?verified=1`,
      handleCodeInApp: false,
    })
    await sendCustomerVerificationEmail({
      to: email,
      displayName,
      verifyUrl,
    })

    res.json({ ok: true })
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message })
      return
    }
    const code = (error as { code?: string }).code
    if (code === 'auth/email-already-exists') {
      res.status(409).json({ error: 'Ya existe una cuenta con este email.' })
      return
    }
    console.error('customer register error:', error)
    const message = error instanceof Error ? error.message : 'No se pudo crear la cuenta.'
    res.status(message.includes('robot') || message.includes('teléfono') ? 400 : 500).json({ error: message })
  }
})

router.post('/customer/bootstrap', async (req: Request, res: Response) => {
  try {
    if (!canUseAdminSdk) {
      res.status(503).json({ error: 'Registro no disponible en este entorno.' })
      return
    }

    const token = getBearerToken(req)
    if (!token) {
      res.status(401).json({ error: 'No autorizado.' })
      return
    }

    const decoded = await adminAuth.verifyIdToken(token)
    const userRecord = await adminAuth.getUser(decoded.uid)
    if (userRecord.disabled) {
      res.status(401).json({ error: 'No autorizado.' })
      return
    }

    const profileSnap = await adminDb.collection('users').doc(decoded.uid).get()
    if (profileSnap.exists) {
      const role = profileSnap.data()?.role
      if (role !== 'customer' || profileSnap.data()?.blocked === true) {
        res.status(403).json({ error: 'Esta cuenta de Google no es de cliente.' })
        return
      }
      res.json({ ok: true, existing: true })
      return
    }

    await requireRecaptcha(req.body?.recaptchaToken, 'register_google', 0.7)

    const email = (userRecord.email ?? '').trim().toLowerCase()
    if (!email || !isValidClientEmail(email)) {
      res.status(400).json({ error: 'Esta cuenta de Google no tiene un correo válido.' })
      return
    }

    const displayName = userRecord.displayName?.trim() || 'Comensal'
    let photoUrl = ''
    try {
      photoUrl = asOptionalCustomerPhotoUrl(userRecord.photoURL ?? '')
    } catch {
      photoUrl = ''
    }

    await adminDb.collection('users').doc(decoded.uid).set(buildCustomerProfileDoc({
      email,
      displayName,
      phone: '',
      phoneVerified: Boolean(userRecord.phoneNumber),
      authProvider: 'google.com',
      photoUrl,
    }))

    res.json({ ok: true, existing: false })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo completar el registro.'
    console.error('customer bootstrap error:', error)
    res.status(message.includes('robot') ? 400 : 500).json({ error: message })
  }
})

router.post('/forgot-password', async (req: Request, res: Response) => {
  const started = Date.now()
  const respondOk = async () => {
    await settleMinDuration(started, 650)
    res.json({ success: true, message: GENERIC_FORGOT_SUCCESS })
  }

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
      await respondOk()
      return
    }

    const [companySnap, credentialsSnap, contactEmail] = await Promise.all([
      adminDb.collection('companies').doc(companyId).get(),
      adminDb.collection('companyCredentials').doc(companyId).get(),
      getCompanyContactEmail(companyId),
    ])

    if (!companySnap.exists || !credentialsSnap.exists || !emailsMatch(contactEmail, email)) {
      await respondOk()
      return
    }

    const companyName = (companySnap.data()?.name as string | undefined) ?? 'Tu restaurante'
    const ownerUid = credentialsSnap.data()?.ownerUid as string | undefined

    if (!ownerUid) {
      await respondOk()
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
      await deletePasswordResetToken(hashPasswordResetToken(token))
      console.error('Password reset email failed:', sendError)
      res.status(503).json({
        error: 'No se pudo enviar el correo. Inténtalo más tarde.',
      })
      return
    }

    await respondOk()
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('forgot-password error:', error)
    res.status(500).json({ error: 'No se pudo procesar la solicitud.' })
  }
})

router.post('/customer/forgot-password', async (req: Request, res: Response) => {
  const started = Date.now()
  const respondOk = async () => {
    await settleMinDuration(started, 650)
    res.json({ success: true, message: GENERIC_FORGOT_SUCCESS })
  }

  try {
    if (!canUseAdminSdk) {
      res.status(503).json({
        error: 'Recuperación de contraseña no disponible en este entorno.',
      })
      return
    }

    const emailRaw = typeof req.body?.email === 'string' ? req.body.email : ''
    if (!emailRaw.trim() || !isValidClientEmail(emailRaw)) {
      res.status(400).json({ error: 'Indica un correo válido.' })
      return
    }

    const email = emailRaw.trim().toLowerCase()
    const customer = await findCustomerForPasswordReset(email)

    if (!customer) {
      await respondOk()
      return
    }

    const token = await createCustomerPasswordResetToken(customer.uid, customer.email, customer.displayName)

    try {
      await sendCustomerPasswordResetEmail({
        to: customer.email,
        displayName: customer.displayName,
        token,
      })
    } catch (sendError) {
      await deletePasswordResetToken(hashPasswordResetToken(token))
      console.error('Customer password reset email failed:', sendError)
      res.status(503).json({
        error: 'No se pudo enviar el correo. Inténtalo más tarde.',
      })
      return
    }

    await respondOk()
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('customer forgot-password error:', error)
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

    if (record.audience === 'customer') {
      res.json({
        valid: true,
        audience: 'customer',
        accountName: record.displayName || 'tu cuenta Adelia',
      })
      return
    }

    const companySnap = record.companyId
      ? await adminDb.collection('companies').doc(record.companyId).get()
      : null

    res.json({
      valid: true,
      audience: 'company',
      companyName: (companySnap?.data()?.name as string | undefined) ?? '',
      accountName: (companySnap?.data()?.name as string | undefined) ?? '',
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
    await adminAuth.revokeRefreshTokens(record.ownerUid)

    if (record.audience === 'company') {
      await adminAuth.setCustomUserClaims(record.ownerUid, { mustChangePassword: false })

      const now = Timestamp.now()

      await adminDb.collection('users').doc(record.ownerUid).set(
        {
          mustChangePassword: false,
        },
        { merge: true },
      )

      if (record.companyId) {
        await adminDb.collection('companyCredentials').doc(record.companyId).set(
          {
            loginPassword: FieldValue.delete(),
            mustChangePassword: false,
            updatedAt: now,
          },
          { merge: true },
        )
      }
    }

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

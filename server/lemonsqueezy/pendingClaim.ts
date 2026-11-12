import { createHash, randomBytes } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { Resend } from 'resend'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from '../data/collections.ts'
import { APP_URL, EMAIL_FROM, EMAIL_REPLY_TO, getResendApiKey, isValidClientEmail } from '../email/config.ts'
import { escapeHtml } from '../email/emailLayout.ts'
import { claimPendingLemonPlan, lemonPendingKey } from './syncCompany.ts'

const PENDING_COLLECTION = 'lemonSqueezyPending'
const CLAIM_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Único restaurante cuyo dueño se dio de alta con este correo (si hay dos, no adivinamos). */
async function findCompanyIdByOwnerEmail(email: string): Promise<string | null> {
  const owners = await adminDb
    .collection(COLLECTIONS.users)
    .where('contactEmail', '==', email)
    .where('role', '==', 'company')
    .limit(2)
    .get()
  if (owners.size !== 1) {
    return null
  }
  const companyId = owners.docs[0].data().companyId
  return typeof companyId === 'string' && companyId ? companyId : null
}

/**
 * Un plan pagado solo con un correo (sin sesión) no se concede directamente:
 * cualquiera podría haber dado de alta un restaurante con el correo de quien
 * paga. Se manda a ese correo un enlace; quien lo abre demuestra que es suyo.
 */
export async function offerPendingPlanClaim(email: string, companyId?: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase()
  if (!isValidClientEmail(normalized)) {
    return false
  }
  const pendingRef = adminDb.collection(PENDING_COLLECTION).doc(lemonPendingKey(normalized))
  const pendingSnap = await pendingRef.get()
  if (!pendingSnap.exists) {
    return false
  }
  const targetCompanyId = companyId ?? await findCompanyIdByOwnerEmail(normalized)
  if (!targetCompanyId) {
    return false
  }
  const companySnap = await adminDb.collection(COLLECTIONS.companies).doc(targetCompanyId).get()
  if (!companySnap.exists) {
    return false
  }

  const token = randomBytes(32).toString('hex')
  await pendingRef.set({
    claimTokenHash: hashToken(token),
    claimCompanyId: targetCompanyId,
    claimExpiresAt: Timestamp.fromMillis(Date.now() + CLAIM_LINK_TTL_MS),
  }, { merge: true })

  const apiKey = getResendApiKey()
  if (!apiKey) {
    console.error('Lemon Squeezy: sin RESEND_API_KEY para enviar el enlace del plan', targetCompanyId)
    return false
  }
  const companyName = String(companySnap.data()?.name ?? 'tu restaurante')
  const link = `${APP_URL}/api/public/billing/claim-plan?token=${token}`
  const result = await new Resend(apiKey).emails.send({
    from: EMAIL_FROM,
    to: normalized,
    replyTo: EMAIL_REPLY_TO,
    subject: 'Activa tu plan de Adelia',
    html: `<p>Hola,</p>
<p>Hemos recibido el pago de tu plan de Adelia. Para activarlo en <strong>${escapeHtml(companyName)}</strong>, pulsa este enlace:</p>
<p><a href="${escapeHtml(link)}">Activar mi plan</a></p>
<p>El enlace caduca en 7 días. Si no has dado de alta ese restaurante, no lo abras y responde a este correo.</p>`,
    text: `Hemos recibido el pago de tu plan de Adelia. Para activarlo en ${companyName}, abre este enlace (caduca en 7 días):\n${link}\n\nSi no has dado de alta ese restaurante, no lo abras y responde a este correo.`,
  })
  if (result.error) {
    throw new Error(result.error.message)
  }
  return true
}

export type PlanClaimResult = 'activated' | 'invalid' | 'expired'

export async function claimPendingPlanByToken(token: string): Promise<PlanClaimResult> {
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return 'invalid'
  }
  const snap = await adminDb
    .collection(PENDING_COLLECTION)
    .where('claimTokenHash', '==', hashToken(token))
    .limit(1)
    .get()
  if (snap.empty) {
    return 'invalid'
  }
  const data = snap.docs[0].data()
  const expiresAt = data.claimExpiresAt instanceof Timestamp ? data.claimExpiresAt.toMillis() : 0
  if (expiresAt < Date.now()) {
    return 'expired'
  }
  const companyId = typeof data.claimCompanyId === 'string' ? data.claimCompanyId : ''
  const email = typeof data.email === 'string' ? data.email : ''
  if (!companyId || !email) {
    return 'invalid'
  }
  const planId = await claimPendingLemonPlan(companyId, email)
  return planId ? 'activated' : 'invalid'
}

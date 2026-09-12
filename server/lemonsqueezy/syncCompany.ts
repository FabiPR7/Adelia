import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from '../data/collections.ts'
import { applyPlanFeatureLimits } from '../company/enforcePlanLimits.ts'
import { lemonVariant, type LemonBillingPeriod, type LemonPlanId } from './config.ts'

const PENDING_COLLECTION = 'lemonSqueezyPending'
const PENDING_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function lemonPendingKey(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 200) || 'unknown'
}

interface LemonSubscriptionAttributes {
  variant_id?: unknown
  user_email?: unknown
  customer_id?: unknown
  status?: unknown
  ends_at?: unknown
  urls?: { customer_portal?: unknown; update_payment_method?: unknown } | null
}

interface ParsedSubscription {
  subscriptionId: string
  planId: LemonPlanId | null
  period: LemonBillingPeriod
  email: string
  customerId: string
  portalUrl: string
  status: string
  endsAt: Date | null
}

export function parseLemonSubscription(data: unknown): ParsedSubscription | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const record = data as { id?: unknown; attributes?: LemonSubscriptionAttributes }
  const subscriptionId = String(record.id ?? '')
  if (!subscriptionId) {
    return null
  }
  const attrs = record.attributes ?? {}
  const endsRaw = typeof attrs.ends_at === 'string' ? new Date(attrs.ends_at) : null
  const variant = lemonVariant(attrs.variant_id)

  return {
    subscriptionId,
    planId: variant?.plan ?? null,
    period: variant?.period ?? 'monthly',
    email: String(attrs.user_email ?? '').trim().toLowerCase(),
    customerId: String(attrs.customer_id ?? ''),
    portalUrl:
      (typeof attrs.urls?.customer_portal === 'string' && attrs.urls.customer_portal)
      || (typeof attrs.urls?.update_payment_method === 'string' && attrs.urls.update_payment_method)
      || '',
    status: String(attrs.status ?? ''),
    endsAt: endsRaw && !Number.isNaN(endsRaw.getTime()) ? endsRaw : null,
  }
}

async function findCompanyByEmail(email: string) {
  if (!email) {
    return null
  }
  const snap = await adminDb
    .collection(COLLECTIONS.companies)
    .where('contactEmail', '==', email)
    .limit(1)
    .get()
  if (!snap.empty) {
    return snap.docs[0]
  }
  // La empresa podría tener el correo guardado por la suscripción de LS.
  const bySub = await adminDb
    .collection(COLLECTIONS.companies)
    .where('lemonSqueezyEmail', '==', email)
    .limit(1)
    .get()
  return bySub.empty ? null : bySub.docs[0]
}

/** Campos base que fijan un plan de pago activo desde Lemon Squeezy. */
function activePlanWrites(sub: ParsedSubscription, planId: LemonPlanId, pastDue: boolean) {
  return {
    planId,
    planBilling: sub.period,
    planStartedAt: FieldValue.serverTimestamp(),
    planLastPaidAt: pastDue ? FieldValue.delete() : FieldValue.serverTimestamp(),
    planPaymentState: pastDue ? 'past_due' : FieldValue.delete(),
    planPaymentFailedAt: pastDue ? FieldValue.serverTimestamp() : FieldValue.delete(),
    pendingPlanId: FieldValue.delete(),
    pendingPlanAt: FieldValue.delete(),
    lemonSqueezySubscriptionId: sub.subscriptionId,
    lemonSqueezyCustomerId: sub.customerId || FieldValue.delete(),
    lemonSqueezyPortalUrl: sub.portalUrl || FieldValue.delete(),
    lemonSqueezyEmail: sub.email || FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  }
}

function freePlanWrites() {
  return {
    planId: 'free' as const,
    planBilling: null,
    planStartedAt: FieldValue.delete(),
    planLastPaidAt: FieldValue.delete(),
    planPaymentState: FieldValue.delete(),
    planPaymentFailedAt: FieldValue.delete(),
    pendingPlanId: FieldValue.delete(),
    pendingPlanAt: FieldValue.delete(),
    lemonSqueezySubscriptionId: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  }
}

/**
 * Aplica el estado de una suscripción de Lemon Squeezy a la empresa que le
 * corresponde (buscada por correo). Si aún no existe empresa —el pago va antes
 * del alta— guarda el estado en `lemonSqueezyPending/{email}` para que el alta
 * lo recoja.
 */
export async function syncCompanyFromLemonSubscription(data: unknown): Promise<void> {
  const sub = parseLemonSubscription(data)
  if (!sub) {
    return
  }

  const company = await findCompanyByEmail(sub.email)

  const cancelledOrGone = sub.status === 'expired'
  const stillPayingButAtRisk = sub.status === 'past_due'
  const lostAccess = sub.status === 'unpaid' || sub.status === 'paused'
  const scheduledToEnd = sub.status === 'cancelled'

  if (!company) {
    // Sin empresa todavía: dejamos el estado listo para el alta.
    if (sub.planId && !cancelledOrGone && !lostAccess) {
      await adminDb.collection(PENDING_COLLECTION).doc(lemonPendingKey(sub.email)).set({
        planId: sub.planId,
        period: sub.period,
        subscriptionId: sub.subscriptionId,
        customerId: sub.customerId,
        portalUrl: sub.portalUrl,
        email: sub.email,
        status: sub.status,
        updatedAt: FieldValue.serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + PENDING_TTL_MS),
      })
    } else {
      await adminDb.collection(PENDING_COLLECTION).doc(lemonPendingKey(sub.email)).delete().catch(() => undefined)
    }
    return
  }

  const ref = company.ref

  if (cancelledOrGone || lostAccess) {
    await ref.set(freePlanWrites(), { merge: true })
    await applyPlanFeatureLimits(company.id, 'free')
    return
  }

  if (scheduledToEnd) {
    // Cancelada pero con acceso hasta fin de periodo.
    await ref.set(
      {
        pendingPlanId: 'free',
        pendingPlanAt: sub.endsAt ? Timestamp.fromDate(sub.endsAt) : FieldValue.delete(),
        lemonSqueezyPortalUrl: sub.portalUrl || FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    return
  }

  if (!sub.planId) {
    return
  }

  await ref.set(activePlanWrites(sub, sub.planId, stillPayingButAtRisk), { merge: true })
  await applyPlanFeatureLimits(company.id, sub.planId)
}

/**
 * Al crear la empresa en el alta, recoge el plan que ya pagó en Lemon Squeezy
 * (si el webhook llegó antes). Devuelve el plan aplicado o `null`.
 */
export async function claimPendingLemonPlan(
  companyId: string,
  contactEmail: string,
): Promise<LemonPlanId | null> {
  const key = lemonPendingKey(contactEmail)
  const pendingRef = adminDb.collection(PENDING_COLLECTION).doc(key)
  const snap = await pendingRef.get()
  if (!snap.exists) {
    return null
  }

  const data = snap.data() ?? {}
  const planId = data.planId === 'basic' || data.planId === 'premium' ? (data.planId as LemonPlanId) : null
  if (!planId) {
    await pendingRef.delete().catch(() => undefined)
    return null
  }
  const period: LemonBillingPeriod = data.period === 'annual' ? 'annual' : 'monthly'

  await adminDb.collection(COLLECTIONS.companies).doc(companyId).set(
    {
      planId,
      planBilling: period,
      planStartedAt: FieldValue.serverTimestamp(),
      planLastPaidAt: FieldValue.serverTimestamp(),
      lemonSqueezySubscriptionId: typeof data.subscriptionId === 'string' ? data.subscriptionId : FieldValue.delete(),
      lemonSqueezyCustomerId: typeof data.customerId === 'string' && data.customerId ? data.customerId : FieldValue.delete(),
      lemonSqueezyPortalUrl: typeof data.portalUrl === 'string' && data.portalUrl ? data.portalUrl : FieldValue.delete(),
      lemonSqueezyEmail: contactEmail.trim().toLowerCase(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  await applyPlanFeatureLimits(companyId, planId)
  await pendingRef.delete().catch(() => undefined)
  return planId
}

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

/**
 * Busca la empresa de un pago de Lemon Squeezy, de más a menos fiable:
 * 1. `company_id` que la web mete en el checkout cuando el restaurante ha iniciado sesión.
 * 2. La suscripción ya enlazada.
 * 3. El correo con el que ya pagó antes.
 * 4. El correo del dueño guardado en su usuario al darse de alta (el restaurante no puede cambiarlo).
 * Nunca se usa `contactEmail`: lo edita el propio restaurante, y otro local podría
 * ponerse el correo de quien va a pagar para quedarse con su plan.
 */
export async function findCompanyForLemonPayment(
  subscriptionId: string,
  email: string,
  customCompanyId = '',
) {
  const companies = adminDb.collection(COLLECTIONS.companies)
  if (customCompanyId && /^[A-Za-z0-9_-]{1,128}$/.test(customCompanyId)) {
    const byCustom = await companies.doc(customCompanyId).get()
    if (byCustom.exists) {
      return byCustom
    }
  }
  if (subscriptionId) {
    const bySubscription = await companies
      .where('lemonSqueezySubscriptionId', '==', subscriptionId)
      .limit(1)
      .get()
    if (!bySubscription.empty) {
      return bySubscription.docs[0]
    }
  }
  if (!email) {
    return null
  }
  const byLemonEmail = await companies
    .where('lemonSqueezyEmail', '==', email)
    .limit(1)
    .get()
  if (!byLemonEmail.empty) {
    return byLemonEmail.docs[0]
  }
  const owners = await adminDb
    .collection(COLLECTIONS.users)
    .where('contactEmail', '==', email)
    .where('role', '==', 'company')
    .limit(2)
    .get()
  // Si dos cuentas comparten correo no adivinamos: el plan queda pendiente para revisarlo.
  if (owners.size !== 1) {
    return null
  }
  const ownerCompanyId = owners.docs[0].data().companyId
  if (typeof ownerCompanyId !== 'string' || !ownerCompanyId) {
    return null
  }
  const byOwner = await companies.doc(ownerCompanyId).get()
  return byOwner.exists ? byOwner : null
}

/** Plan de por vida (pago único): ningún aviso de suscripción puede quitarlo. */
export function isPerpetualCompany(data: FirebaseFirestore.DocumentData | undefined): boolean {
  return data?.planBilling === 'perpetual' && data?.planId !== 'free'
}

/** Campos base que fijan un plan de pago activo desde Lemon Squeezy. */
function activePlanWrites(
  sub: ParsedSubscription,
  planId: LemonPlanId,
  pastDue: boolean,
  isNewSubscription: boolean,
) {
  return {
    planId,
    planBilling: sub.period,
    // Las fechas solo se fijan al enlazar la suscripción: subscription_updated
    // llega muchas veces y no significa que haya un cobro nuevo.
    ...(isNewSubscription
      ? {
          planStartedAt: FieldValue.serverTimestamp(),
          ...(pastDue ? {} : { planLastPaidAt: FieldValue.serverTimestamp() }),
        }
      : {}),
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
export async function syncCompanyFromLemonSubscription(data: unknown, customCompanyId = ''): Promise<void> {
  const sub = parseLemonSubscription(data)
  if (!sub) {
    return
  }

  if (!sub.planId) {
    // Una variante desconocida (p. ej. IDs de prueba tras pasar a modo real) no
    // debe pasar en silencio: el cliente ha pagado y no recibiría el plan.
    console.error('Lemon Squeezy: variante sin plan asociado', sub.subscriptionId)
  }

  const company = await findCompanyForLemonPayment(sub.subscriptionId, sub.email, customCompanyId)

  if (company && isPerpetualCompany(company.data())) {
    // Ya tiene el plan de por vida: una suscripción vieja que caduca no puede bajarle el plan.
    console.warn('Lemon Squeezy: suscripción ignorada en empresa con plan de por vida', company.id, sub.subscriptionId)
    return
  }

  const cancelledOrGone = sub.status === 'expired'
  const stillPayingButAtRisk = sub.status === 'past_due'
  const lostAccess = sub.status === 'unpaid' || sub.status === 'paused'
  const scheduledToEnd = sub.status === 'cancelled'

  if (!company) {
    const pendingRef = adminDb.collection(PENDING_COLLECTION).doc(lemonPendingKey(sub.email))
    if (cancelledOrGone || lostAccess) {
      await pendingRef.delete().catch(() => undefined)
      return
    }
    // Sin empresa todavía: dejamos el estado listo para el alta.
    if (sub.planId) {
      await pendingRef.set({
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

  const isNewSubscription = company.data()?.lemonSqueezySubscriptionId !== sub.subscriptionId
  await ref.set(activePlanWrites(sub, sub.planId, stillPayingButAtRisk, isNewSubscription), { merge: true })
  await applyPlanFeatureLimits(company.id, sub.planId)
}

interface LemonInvoiceAttributes {
  subscription_id?: unknown
  user_email?: unknown
}

/**
 * `subscription_payment_*` no trae una suscripción sino una factura (sin
 * variante ni estado de suscripción). Solo actualiza el estado del cobro: nunca
 * crea ni borra el plan pendiente, porque esos avisos llegan también antes del alta.
 */
export async function syncCompanyFromLemonInvoice(data: unknown, eventName: string): Promise<void> {
  if (!data || typeof data !== 'object') {
    return
  }
  const attrs = (data as { attributes?: LemonInvoiceAttributes }).attributes ?? {}
  const company = await findCompanyForLemonPayment(
    String(attrs.subscription_id ?? ''),
    String(attrs.user_email ?? '').trim().toLowerCase(),
  )
  if (!company) {
    return
  }

  if (eventName === 'subscription_payment_failed') {
    await company.ref.set(
      {
        planPaymentState: 'past_due',
        planPaymentFailedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    return
  }

  await company.ref.set(
    {
      planLastPaidAt: FieldValue.serverTimestamp(),
      planPaymentState: FieldValue.delete(),
      planPaymentFailedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
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
  const period: LemonBillingPeriod | 'perpetual' = data.period === 'perpetual'
    ? 'perpetual'
    : data.period === 'annual' ? 'annual' : 'monthly'

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
      ...(period === 'perpetual' && typeof data.orderId === 'string' ? { lifetimeOrderId: data.orderId } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  await applyPlanFeatureLimits(companyId, planId)
  await pendingRef.delete().catch(() => undefined)
  return planId
}

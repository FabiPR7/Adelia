import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { applyPlanFeatureLimits } from '../company/enforcePlanLimits.ts'
import { findCompanyForLemonPayment, isPerpetualCompany, lemonPendingKey } from './syncCompany.ts'

/** Plan que da el pago único "de por vida": el más completo (Local). */
export const LIFETIME_PLAN_ID = 'premium' as const

const PENDING_COLLECTION = 'lemonSqueezyPending'
const PENDING_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * variant_id del producto de pago único en Lemon Squeezy. Se configura con
 * `LEMONSQUEEZY_LIFETIME_VARIANT_IDS` (separados por comas: el de prueba y el real).
 * Sin configurar, ningún pedido da el plan de por vida.
 */
export function lifetimeVariantIds(): Set<string> {
  return new Set(
    (process.env.LEMONSQUEEZY_LIFETIME_VARIANT_IDS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  )
}

interface LemonOrderAttributes {
  status?: unknown
  user_email?: unknown
  customer_id?: unknown
  refunded?: unknown
  first_order_item?: { variant_id?: unknown } | null
  urls?: { receipt?: unknown } | null
}

interface ParsedOrder {
  orderId: string
  variantId: string
  email: string
  customerId: string
  paid: boolean
  refunded: boolean
}

export function parseLemonOrder(data: unknown): ParsedOrder | null {
  if (!data || typeof data !== 'object') return null
  const record = data as { id?: unknown; attributes?: LemonOrderAttributes }
  const orderId = String(record.id ?? '')
  if (!orderId) return null
  const attrs = record.attributes ?? {}
  const status = String(attrs.status ?? '')
  return {
    orderId,
    variantId: String(attrs.first_order_item?.variant_id ?? ''),
    email: String(attrs.user_email ?? '').trim().toLowerCase(),
    customerId: String(attrs.customer_id ?? ''),
    paid: status === 'paid',
    refunded: status === 'refunded' || attrs.refunded === true,
  }
}

/**
 * Pedido de pago único (`order_created` / `order_refunded`). Solo actúa sobre la
 * variante de "de por vida": cualquier otro pedido lo gestionan las suscripciones.
 */
export async function syncCompanyFromLemonOrder(
  data: unknown,
  eventName: string,
  customCompanyId = '',
): Promise<void> {
  const order = parseLemonOrder(data)
  if (!order || !lifetimeVariantIds().has(order.variantId)) {
    return
  }

  const company = await findCompanyForLemonPayment('', order.email, customCompanyId)

  if (eventName === 'order_refunded' || order.refunded) {
    // Devolución: se retira el plan de por vida (solo si venía de este pedido).
    if (company && company.data()?.lifetimeOrderId === order.orderId) {
      await company.ref.set(
        {
          planId: 'free',
          planBilling: null,
          lifetimeOrderId: FieldValue.delete(),
          lifetimeRefundedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      await applyPlanFeatureLimits(company.id, 'free')
    }
    await adminDb.collection(PENDING_COLLECTION).doc(lemonPendingKey(order.email)).delete().catch(() => undefined)
    return
  }

  if (!order.paid) {
    return
  }

  if (!company) {
    // Pagó antes de darse de alta: el alta recoge el plan con este correo.
    await adminDb.collection(PENDING_COLLECTION).doc(lemonPendingKey(order.email)).set({
      planId: LIFETIME_PLAN_ID,
      period: 'perpetual',
      orderId: order.orderId,
      customerId: order.customerId,
      email: order.email,
      status: 'paid',
      updatedAt: FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromMillis(Date.now() + PENDING_TTL_MS),
    }, { merge: true })
    const { offerPendingPlanClaim } = await import('./pendingClaim.ts')
    await offerPendingPlanClaim(order.email).catch((error) => {
      console.error('Lemon Squeezy: no se pudo enviar el enlace del plan', error)
    })
    return
  }

  if (isPerpetualCompany(company.data()) && company.data()?.lifetimeOrderId === order.orderId) {
    return
  }

  await company.ref.set(
    {
      planId: LIFETIME_PLAN_ID,
      planBilling: 'perpetual',
      planStartedAt: FieldValue.serverTimestamp(),
      planLastPaidAt: FieldValue.serverTimestamp(),
      planPaymentState: FieldValue.delete(),
      planPaymentFailedAt: FieldValue.delete(),
      pendingPlanId: FieldValue.delete(),
      pendingPlanAt: FieldValue.delete(),
      lifetimeOrderId: order.orderId,
      lemonSqueezyCustomerId: order.customerId || FieldValue.delete(),
      lemonSqueezyEmail: order.email || FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  await applyPlanFeatureLimits(company.id, LIFETIME_PLAN_ID)
}

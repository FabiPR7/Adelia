import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { findCompanyForLemonPayment } from './syncCompany.ts'
import { lifetimeVariantIds, parseLemonOrder } from './lifetime.ts'

/**
 * Libro de cobros: una fila por factura (suscripción) o pedido (pago único) de
 * Lemon Squeezy. Es lo que lee el panel de administración para ingresos por
 * mes, año o entre fechas. Lemon da los importes en céntimos.
 */
export const BILLING_LEDGER = 'billingLedger'

const INVOICE_STATUS: Record<string, 'paid' | 'refunded' | 'failed'> = {
  subscription_payment_success: 'paid',
  subscription_payment_recovered: 'paid',
  subscription_payment_refunded: 'refunded',
  subscription_payment_failed: 'failed',
  order_created: 'paid',
  order_refunded: 'refunded',
}

function cents(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.round(number) : 0
}

function text(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function toTimestamp(value: unknown): Timestamp {
  const date = typeof value === 'string' ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? Timestamp.fromDate(date) : Timestamp.now()
}

export function ledgerRowFromLemon(
  data: { id?: unknown; attributes?: Record<string, unknown> } | null | undefined,
  eventName: string,
) {
  const status = INVOICE_STATUS[eventName]
  const id = text(data?.id, 80)
  if (!status || !id) {
    return null
  }
  const attrs = data?.attributes ?? {}
  const isOrder = eventName.startsWith('order_')
  const totalCents = cents(attrs.total)
  const taxCents = cents(attrs.tax)
  const refundedCents = status === 'refunded'
    ? (attrs.refunded_amount != null ? cents(attrs.refunded_amount) : totalCents)
    : 0
  const urls = (attrs.urls && typeof attrs.urls === 'object' ? attrs.urls : {}) as Record<string, unknown>
  const firstItem = (attrs.first_order_item && typeof attrs.first_order_item === 'object'
    ? attrs.first_order_item
    : {}) as Record<string, unknown>

  return {
    docId: `${isOrder ? 'ord' : 'inv'}_${id}`,
    row: {
      source: 'lemonsqueezy',
      kind: isOrder ? 'order' : 'subscription',
      externalId: id,
      status,
      currency: text(attrs.currency, 8).toUpperCase() || 'EUR',
      totalCents,
      taxCents,
      subtotalCents: attrs.subtotal != null ? cents(attrs.subtotal) : totalCents - taxCents,
      refundedCents,
      // Lo que de verdad queda: un cobro fallido no suma y una devolución resta.
      netCents: status === 'failed' ? 0 : Math.max(0, totalCents - refundedCents),
      billingReason: text(attrs.billing_reason, 40),
      productName: text(firstItem.product_name ?? attrs.product_name, 120),
      variantName: text(firstItem.variant_name ?? attrs.variant_name, 120),
      customerEmail: text(attrs.user_email, 160).toLowerCase(),
      customerName: text(attrs.user_name, 160),
      subscriptionId: text(attrs.subscription_id, 80),
      invoiceUrl: text(urls.invoice_url ?? urls.receipt, 500),
      cardBrand: text(attrs.card_brand, 30),
      testMode: attrs.test_mode === true,
      paidAt: toTimestamp(attrs.created_at),
    },
  }
}

/** Guarda (o actualiza, en una devolución) la fila del cobro. Nunca rompe el webhook. */
export async function recordLemonPayment(
  data: { id?: unknown; attributes?: Record<string, unknown> } | null | undefined,
  eventName: string,
  customCompanyId = '',
): Promise<void> {
  // La primera cuota de una suscripción llega también como pedido: solo se
  // apuntan los pedidos de pago único; las cuotas ya van por su factura.
  if (eventName.startsWith('order_')) {
    const order = parseLemonOrder(data)
    if (!order || !lifetimeVariantIds().has(order.variantId)) {
      return
    }
  }
  const entry = ledgerRowFromLemon(data, eventName)
  if (!entry) {
    return
  }
  try {
    const company = await findCompanyForLemonPayment(
      entry.row.subscriptionId,
      entry.row.customerEmail,
      customCompanyId,
    ).catch(() => null)
    const companyData = company?.data() ?? {}
    await adminDb.collection(BILLING_LEDGER).doc(entry.docId).set({
      ...entry.row,
      companyId: company?.id ?? '',
      companyName: typeof companyData.name === 'string' ? companyData.name : '',
      planId: typeof companyData.planId === 'string' ? companyData.planId : '',
      municipality: typeof companyData.municipality === 'string' ? companyData.municipality : '',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
  } catch (error) {
    console.error('Lemon Squeezy ledger error:', entry.docId, error)
  }
}


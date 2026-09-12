import { FieldValue } from 'firebase-admin/firestore'
import type Stripe from 'stripe'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from '../data/collections.ts'
import { createStripeClient, getAppBaseUrl, getStripeSecretKey, isStripeConfigured } from './config.ts'
import {
  parseSaasCheckoutPlanId,
  SAAS_CHECKOUT_META,
  SAAS_CHECKOUT_PLANS,
  type SaasCheckoutPlanId,
} from './saasCatalog.ts'
import { getOrCreateSaasPrice } from './saasPrices.ts'
import { syncCompanyFromStripeSubscription } from './saasPlanChanges.ts'
import { applyPlanFeatureLimits } from '../company/enforcePlanLimits.ts'
import { sendPlanPaymentFailedEmail, sendPlanPaymentReceiptEmail } from '../email/planPaymentConfirmation.ts'
import { isValidClientEmail } from '../email/config.ts'

export function isStripeTestMode(): boolean {
  return (getStripeSecretKey() ?? '').startsWith('sk_test_')
}

export function saasBillingStatus() {
  return {
    configured: isStripeConfigured(),
    testMode: isStripeTestMode(),
  }
}

function customText(session: Stripe.Checkout.Session, key: string): string {
  const field = session.custom_fields?.find((item) => item.key === key)
  const value = field?.text?.value
  return typeof value === 'string' ? value.trim() : ''
}

export async function createSaasCheckoutSession(input: {
  planId: SaasCheckoutPlanId
  companyId?: string
  customerId?: string
  appUrl?: string
  successNext?: 'signup' | 'panel'
}): Promise<{ url: string; testMode: boolean }> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe no está configurado en el servidor.')
  }

  const stripe = createStripeClient()
  const priceId = await getOrCreateSaasPrice(stripe, input.planId)
  const spec = SAAS_CHECKOUT_PLANS[input.planId]
  const appUrl = (input.appUrl || getAppBaseUrl()).replace(/\/$/, '')
  const metadata: Record<string, string> = {
    type: SAAS_CHECKOUT_META,
    planId: input.planId,
    planName: spec.name,
  }

  if (input.companyId) {
    metadata.companyId = input.companyId
  }

  const successQuery = input.successNext === 'panel'
    ? 'session_id={CHECKOUT_SESSION_ID}&next=panel'
    : 'session_id={CHECKOUT_SESSION_ID}'
  const cancelUrl = input.successNext === 'panel'
    ? `${appUrl}/panel?tab=plan`
    : `${appUrl}/empresa/planes?cancelado=1`

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    locale: 'es',
    billing_address_collection: 'required',
    phone_number_collection: { enabled: true },
    tax_id_collection: { enabled: true },
    allow_promotion_codes: true,
    payment_method_types: ['card'],
    success_url: `${appUrl}/empresa/planes/exito?${successQuery}`,
    cancel_url: cancelUrl,
    line_items: [{ price: priceId, quantity: 1 }],
    ...(input.customerId ? { customer: input.customerId, customer_update: { name: 'auto', address: 'auto' } } : {}),
    ...(input.companyId
      ? {}
      : {
          custom_fields: [
            {
              key: 'restaurant_name',
              label: { type: 'custom', custom: 'Nombre del restaurante' },
              type: 'text',
              text: { maximum_length: 80 },
            },
            {
              key: 'city',
              label: { type: 'custom', custom: 'Ciudad' },
              type: 'text',
              text: { maximum_length: 60 },
            },
          ],
        }),
    metadata,
    subscription_data: {
      metadata,
      description: `Adelia ${spec.name} · mensual`,
    },
  })

  if (!session.url) {
    throw new Error('Stripe no devolvió la URL de pago.')
  }

  return {
    url: session.url,
    testMode: isStripeTestMode(),
  }
}

export async function readPublicSaasCheckoutSession(sessionId: string): Promise<{
  planId: string
  planName: string
  email: string
  phone: string
  restaurantName: string
  city: string
  paid: boolean
  testMode: boolean
  amountLabel: string
  companyId: string
} | null> {
  if (!isStripeConfigured()) {
    return null
  }

  const stripe = createStripeClient()
  const session = await stripe.checkout.sessions.retrieve(sessionId)

  if (session.metadata?.type !== SAAS_CHECKOUT_META) {
    return null
  }

  const planId = parseSaasCheckoutPlanId(session.metadata.planId)
  const spec = planId ? SAAS_CHECKOUT_PLANS[planId] : null
  const paid = session.payment_status === 'paid' || session.status === 'complete'

  if (paid) {
    // Esto es un GET (página de "pago correcto"). Aprovisionamos plan/empresa de
    // forma idempotente para que el panel funcione aunque el webhook llegue con
    // retraso, pero NO enviamos el correo de factura: ese efecto secundario vive
    // solo en el webhook (`checkout.session.completed`).
    await upsertSaasSubscriptionFromCheckout(session, { sendReceipt: false })
  }

  const amount = session.amount_total
  const amountLabel =
    typeof amount === 'number'
      ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: (session.currency ?? 'eur').toUpperCase() }).format(amount / 100)
      : spec
        ? `${spec.amountCents / 100} €`
        : ''

  const leadSnap = await adminDb.collection(COLLECTIONS.saasSubscriptions).doc(sessionId).get()
  const companyId = session.metadata?.companyId?.trim()
    || (typeof leadSnap.data()?.companyId === 'string' ? leadSnap.data()?.companyId as string : '')

  return {
    planId: planId ?? '',
    planName: spec?.name ?? session.metadata.planName ?? '',
    email: session.customer_details?.email ?? session.customer_email ?? '',
    phone: session.customer_details?.phone ?? '',
    restaurantName: customText(session, 'restaurant_name'),
    city: customText(session, 'city'),
    paid,
    testMode: session.livemode !== true,
    amountLabel,
    companyId,
  }
}

async function claimPlanReceipt(receiptId: string): Promise<boolean> {
  const ref = adminDb.collection(COLLECTIONS.saasReceipts).doc(receiptId)
  try {
    return await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref)
      if (snap.exists) {
        return false
      }
      transaction.set(ref, { sentAt: FieldValue.serverTimestamp() })
      return true
    })
  } catch (error) {
    console.error('Plan receipt claim error:', error)
    return false
  }
}

async function releasePlanReceipt(receiptId: string): Promise<void> {
  await adminDb.collection(COLLECTIONS.saasReceipts).doc(receiptId).delete().catch(() => undefined)
}

async function loadInvoice(invoiceRef: Stripe.Checkout.Session['invoice']): Promise<Stripe.Invoice | null> {
  if (!invoiceRef) {
    return null
  }
  if (typeof invoiceRef !== 'string') {
    return invoiceRef
  }
  try {
    return await createStripeClient().invoices.retrieve(invoiceRef)
  } catch {
    return null
  }
}

async function sendPaidPlanReceiptFromCheckout(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return
  }
  const planId = parseSaasCheckoutPlanId(session.metadata?.planId)
  if (!planId) {
    return
  }

  const invoice = await loadInvoice(session.invoice)
    ?? await loadInvoice(
      await createStripeClient().checkout.sessions.retrieve(session.id, { expand: ['invoice'] })
        .then((full) => full.invoice)
        .catch(() => null),
    )
  const receiptId = invoice?.id || session.id
  if (!(await claimPlanReceipt(receiptId))) {
    return
  }

  const companyId = session.metadata?.companyId?.trim() || ''
  let restaurantName = customText(session, 'restaurant_name')
  let contactEmail = ''
  if (companyId) {
    const companySnap = await adminDb.collection(COLLECTIONS.companies).doc(companyId).get()
    const data = companySnap.data()
    restaurantName = restaurantName || (typeof data?.name === 'string' ? data.name : '')
    contactEmail = typeof data?.contactEmail === 'string' ? data.contactEmail : ''
  }

  const to = (session.customer_details?.email || session.customer_email || contactEmail || '').trim()
  if (!isValidClientEmail(to)) {
    await releasePlanReceipt(receiptId)
    return
  }

  try {
    await sendPlanPaymentReceiptEmail({
      to,
      restaurantName,
      planId,
      amountCents: session.amount_total ?? SAAS_CHECKOUT_PLANS[planId].amountCents,
      paidAt: session.created ? new Date(session.created * 1000) : new Date(),
      currency: session.currency ?? 'eur',
      invoiceNumber: invoice?.number ?? undefined,
      invoiceUrl: invoice?.hosted_invoice_url ?? undefined,
      invoicePdfUrl: invoice?.invoice_pdf ?? undefined,
      renewal: false,
    })
  } catch (error) {
    await releasePlanReceipt(receiptId)
    throw error
  }
}

async function sendPaidPlanReceiptFromInvoice(invoice: Stripe.Invoice): Promise<void> {
  if (invoice.status !== 'paid') {
    return
  }
  if (invoice.billing_reason === 'subscription_create') {
    return
  }

  const receiptId = invoice.id
  if (!(await claimPlanReceipt(receiptId))) {
    return
  }

  const companyId = invoiceCompanyId(invoice)
  let restaurantName = ''
  let contactEmail = ''
  const rawInvoice = invoice as unknown as Record<string, unknown>
  const subscriptionDetails = rawInvoice.subscription_details as { metadata?: Record<string, string> } | undefined
  let planId = parseSaasCheckoutPlanId(subscriptionDetails?.metadata?.planId)
    ?? parseSaasCheckoutPlanId(invoice.lines?.data?.[0]?.metadata?.planId)
    ?? parseSaasCheckoutPlanId(invoice.metadata?.planId)

  if (companyId) {
    const companySnap = await adminDb.collection(COLLECTIONS.companies).doc(companyId).get()
    const data = companySnap.data()
    restaurantName = typeof data?.name === 'string' ? data.name : ''
    contactEmail = typeof data?.contactEmail === 'string' ? data.contactEmail : ''
    if (!planId) {
      planId = parseSaasCheckoutPlanId(data?.planId)
    }
  }

  if (!planId) {
    await releasePlanReceipt(receiptId)
    return
  }

  const to = (invoice.customer_email || contactEmail || '').trim()
  if (!isValidClientEmail(to)) {
    await releasePlanReceipt(receiptId)
    return
  }

  try {
    await sendPlanPaymentReceiptEmail({
      to,
      restaurantName,
      planId,
      amountCents: invoice.amount_paid || invoice.total || SAAS_CHECKOUT_PLANS[planId].amountCents,
      paidAt: invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : new Date(),
      currency: invoice.currency ?? 'eur',
      invoiceNumber: invoice.number ?? undefined,
      invoiceUrl: invoice.hosted_invoice_url ?? undefined,
      invoicePdfUrl: invoice.invoice_pdf ?? undefined,
      renewal: invoice.billing_reason === 'subscription_cycle',
    })
  } catch (error) {
    await releasePlanReceipt(receiptId)
    throw error
  }
}

async function upsertSaasSubscriptionFromCheckout(
  session: Stripe.Checkout.Session,
  options: { sendReceipt?: boolean } = {},
): Promise<void> {
  const { sendReceipt = true } = options
  if (session.metadata?.type !== SAAS_CHECKOUT_META) {
    return
  }

  const planId = parseSaasCheckoutPlanId(session.metadata.planId)
  if (!planId) {
    return
  }

  const restaurantName = customText(session, 'restaurant_name')
  const city = customText(session, 'city')
  const companyId = session.metadata.companyId?.trim() || ''
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? ''
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id ?? ''

  await adminDb.collection(COLLECTIONS.saasSubscriptions).doc(session.id).set(
    {
      type: SAAS_CHECKOUT_META,
      planId,
      planName: SAAS_CHECKOUT_PLANS[planId].name,
      status: session.payment_status === 'paid' || session.status === 'complete' ? 'paid' : (session.status ?? 'open'),
      customerEmail: session.customer_details?.email ?? session.customer_email ?? '',
      customerName: session.customer_details?.name ?? '',
      customerPhone: session.customer_details?.phone ?? '',
      restaurantName,
      city,
      companyId: companyId || null,
      stripeCustomerId: customerId || null,
      stripeSubscriptionId: subscriptionId || null,
      amountTotal: session.amount_total ?? SAAS_CHECKOUT_PLANS[planId].amountCents,
      currency: session.currency ?? 'eur',
      livemode: session.livemode === true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  if (sendReceipt) {
    await sendPaidPlanReceiptFromCheckout(session).catch((error) => {
      console.error('Plan payment receipt error:', error)
    })
  }

  if (!companyId) {
    return
  }

  await adminDb.collection(COLLECTIONS.companies).doc(companyId).set(
    {
      planId,
      planBilling: 'monthly',
      planStartedAt: FieldValue.serverTimestamp(),
      planLastPaidAt: FieldValue.serverTimestamp(),
      stripeBillingCustomerId: customerId || null,
      stripeSubscriptionId: subscriptionId || null,
      pendingPlanId: FieldValue.delete(),
      pendingPlanAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  await applyPlanFeatureLimits(companyId, planId)
}

function stripeObjectId(value: unknown): string {
  if (typeof value === 'string' && value) {
    return value
  }
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' ? id : ''
  }
  return ''
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string {
  const raw = invoice as unknown as Record<string, unknown>
  const direct = stripeObjectId(raw.subscription)
  if (direct) {
    return direct
  }
  const parent = raw.parent as Record<string, unknown> | undefined
  const details = parent?.subscription_details as Record<string, unknown> | undefined
  return stripeObjectId(details?.subscription)
}

function invoiceCompanyId(invoice: Stripe.Invoice): string {
  const raw = invoice as unknown as Record<string, unknown>
  const details = raw.subscription_details as { metadata?: Record<string, string> } | undefined
  if (details?.metadata?.companyId) {
    return details.metadata.companyId
  }
  const parent = raw.parent as Record<string, unknown> | undefined
  const parentDetails = parent?.subscription_details as { metadata?: Record<string, string> } | undefined
  return parentDetails?.metadata?.companyId ?? invoice.lines?.data?.[0]?.metadata?.companyId ?? ''
}

async function markCompanyPaidFromInvoice(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = invoiceSubscriptionId(invoice)

  if (!subscriptionId || invoice.status !== 'paid') {
    return
  }

  const resolvedCompanyId = invoiceCompanyId(invoice)

  if (!resolvedCompanyId) {
    const matches = await adminDb
      .collection(COLLECTIONS.saasSubscriptions)
      .where('stripeSubscriptionId', '==', subscriptionId)
      .limit(1)
      .get()

    if (!matches.empty) {
      await matches.docs[0].ref.set(
        {
          status: 'paid',
          lastInvoicePaidAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    }
    return
  }

  await adminDb.collection(COLLECTIONS.companies).doc(resolvedCompanyId).set(
    {
      planLastPaidAt: FieldValue.serverTimestamp(),
      // Un cobro correcto sale del estado de impago.
      planPaymentState: FieldValue.delete(),
      planPaymentFailedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  await sendPaidPlanReceiptFromInvoice(invoice).catch((error) => {
    console.error('Plan invoice receipt error:', error)
  })
}

function invoicePlanId(invoice: Stripe.Invoice): SaasCheckoutPlanId | null {
  const raw = invoice as unknown as Record<string, unknown>
  const subDetails = raw.subscription_details as { metadata?: Record<string, string> } | undefined
  return parseSaasCheckoutPlanId(subDetails?.metadata?.planId)
    ?? parseSaasCheckoutPlanId(invoice.lines?.data?.[0]?.metadata?.planId)
    ?? parseSaasCheckoutPlanId(invoice.metadata?.planId)
}

/**
 * Marca a la empresa como "en impago" cuando falla un cobro mensual y avisa por
 * correo (una sola vez por factura). No baja el plan todavía: Stripe reintenta
 * varios días; si acaba en `unpaid`/`canceled`, `syncCompanyFromStripeSubscription`
 * lo baja a `free`.
 */
async function flagCompanyPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = invoiceSubscriptionId(invoice)
  if (!subscriptionId) {
    return
  }

  let companyId = invoiceCompanyId(invoice)
  if (!companyId) {
    const matches = await adminDb
      .collection(COLLECTIONS.companies)
      .where('stripeSubscriptionId', '==', subscriptionId)
      .limit(1)
      .get()
    companyId = matches.empty ? '' : matches.docs[0].id
  }
  if (!companyId) {
    return
  }

  const companyRef = adminDb.collection(COLLECTIONS.companies).doc(companyId)
  const companySnap = await companyRef.get()
  const data = companySnap.data() ?? {}

  await companyRef.set(
    {
      planPaymentState: 'past_due',
      planPaymentFailedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  // Un aviso por factura, no en cada reintento.
  if (!(await claimPlanReceipt(`failed:${invoice.id}`))) {
    return
  }

  const planId = invoicePlanId(invoice)
    ?? parseSaasCheckoutPlanId(data.planId)
  if (!planId) {
    return
  }

  const to = (
    invoice.customer_email
    || (typeof data.contactEmail === 'string' ? data.contactEmail : '')
    || ''
  ).trim()
  if (!isValidClientEmail(to)) {
    await releasePlanReceipt(`failed:${invoice.id}`)
    return
  }

  let updateUrl: string | undefined
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (customerId) {
    try {
      const portal = await createStripeClient().billingPortal.sessions.create({
        customer: customerId,
        return_url: `${getAppBaseUrl().replace(/\/$/, '')}/panel?tab=plan`,
      })
      updateUrl = portal.url
    } catch {
      // El portal de facturación puede no estar configurado; usamos la factura.
    }
  }

  try {
    await sendPlanPaymentFailedEmail({
      to,
      restaurantName: typeof data.name === 'string' ? data.name : '',
      planId,
      amountCents: invoice.amount_due || SAAS_CHECKOUT_PLANS[planId].amountCents,
      currency: invoice.currency ?? 'eur',
      updateUrl,
      invoiceUrl: invoice.hosted_invoice_url ?? undefined,
    })
  } catch (error) {
    await releasePlanReceipt(`failed:${invoice.id}`)
    console.error('Plan payment failed email error:', error)
  }
}

export async function handleSaasStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    await upsertSaasSubscriptionFromCheckout(event.data.object as Stripe.Checkout.Session)
    return
  }

  if (event.type === 'invoice.paid') {
    await markCompanyPaidFromInvoice(event.data.object as Stripe.Invoice)
    return
  }

  if (event.type === 'invoice.payment_failed') {
    await flagCompanyPaymentFailed(event.data.object as Stripe.Invoice)
    return
  }

  if (
    event.type === 'customer.subscription.updated'
    || event.type === 'customer.subscription.deleted'
    || event.type === 'customer.subscription.created'
  ) {
    await syncCompanyFromStripeSubscription(event.data.object as Stripe.Subscription)
  }
}

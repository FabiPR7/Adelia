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

export function isStripeTestMode(): boolean {
  return (getStripeSecretKey() ?? '').startsWith('sk_test_')
}

export function saasBillingStatus() {
  return {
    configured: isStripeConfigured(),
    testMode: isStripeTestMode(),
  }
}

async function getOrCreateSaasPrice(
  stripe: Stripe,
  planId: SaasCheckoutPlanId,
): Promise<string> {
  const spec = SAAS_CHECKOUT_PLANS[planId]
  const existing = await stripe.prices.list({
    lookup_keys: [spec.lookupKey],
    active: true,
    limit: 1,
  })

  if (existing.data[0]?.id) {
    return existing.data[0].id
  }

  const product = await stripe.products.create({
    name: spec.productName,
    description: `Suscripción mensual al plan ${spec.name} de Adelia.`,
    metadata: {
      type: SAAS_CHECKOUT_META,
      planId,
    },
  })

  const price = await stripe.prices.create({
    product: product.id,
    currency: 'eur',
    unit_amount: spec.amountCents,
    recurring: { interval: 'month' },
    lookup_key: spec.lookupKey,
    transfer_lookup_key: true,
    metadata: {
      type: SAAS_CHECKOUT_META,
      planId,
    },
  })

  return price.id
}

function customText(session: Stripe.Checkout.Session, key: string): string {
  const field = session.custom_fields?.find((item) => item.key === key)
  const value = field?.text?.value
  return typeof value === 'string' ? value.trim() : ''
}

export async function createSaasCheckoutSession(input: {
  planId: SaasCheckoutPlanId
  companyId?: string
  appUrl?: string
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

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    locale: 'es',
    billing_address_collection: 'required',
    phone_number_collection: { enabled: true },
    allow_promotion_codes: true,
    // Tarjeta + wallets (Apple Pay / Google Pay / Link) en el Checkout alojado de Stripe.
    payment_method_types: ['card'],
    success_url: `${appUrl}/empresa/planes/exito?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/empresa/planes?cancelado=1`,
    line_items: [{ price: priceId, quantity: 1 }],
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
  const amount = session.amount_total
  const amountLabel =
    typeof amount === 'number'
      ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: (session.currency ?? 'eur').toUpperCase() }).format(amount / 100)
      : spec
        ? `${spec.amountCents / 100} €`
        : ''

  const leadSnap = await adminDb.collection(COLLECTIONS.saasSubscriptions).doc(sessionId).get()
  const companyId = typeof leadSnap.data()?.companyId === 'string' ? leadSnap.data()?.companyId as string : ''

  return {
    planId: planId ?? '',
    planName: spec?.name ?? session.metadata.planName ?? '',
    email: session.customer_details?.email ?? session.customer_email ?? '',
    phone: session.customer_details?.phone ?? '',
    restaurantName: customText(session, 'restaurant_name'),
    city: customText(session, 'city'),
    paid: session.payment_status === 'paid' || session.status === 'complete',
    testMode: session.livemode !== true,
    amountLabel,
    companyId,
  }
}

async function upsertSaasSubscriptionFromCheckout(session: Stripe.Checkout.Session): Promise<void> {
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
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
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
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
}

export async function handleSaasStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    await upsertSaasSubscriptionFromCheckout(event.data.object as Stripe.Checkout.Session)
    return
  }

  if (event.type === 'invoice.paid') {
    await markCompanyPaidFromInvoice(event.data.object as Stripe.Invoice)
  }
}

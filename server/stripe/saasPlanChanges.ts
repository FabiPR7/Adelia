import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import type Stripe from 'stripe'
import { adminAuth, adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from '../data/collections.ts'
import { slugify } from '../utils.ts'
import { createStripeClient, getAppBaseUrl, isStripeConfigured } from './config.ts'
import {
  parseSaasCheckoutPlanId,
  SAAS_CHECKOUT_META,
  SAAS_CHECKOUT_PLANS,
  type SaasCheckoutPlanId,
} from './saasCatalog.ts'
import { getOrCreateSaasPrice } from './saasPrices.ts'
import { applyPlanFeatureLimits } from '../company/enforcePlanLimits.ts'

type StoredPlanId = 'free' | 'basic' | 'premium' | 'premium_plus'
type ChangeKind = 'none' | 'start_paid' | 'upgrade_now' | 'downgrade_later' | 'cancel_later'

function parseStoredPlanId(value: unknown): StoredPlanId {
  if (value === 'basic' || value === 'premium' || value === 'premium_plus') {
    return value
  }
  return 'free'
}

function planAmountCents(planId: StoredPlanId): number {
  if (planId === 'basic') {
    return SAAS_CHECKOUT_PLANS.basic.amountCents
  }
  if (planId === 'premium' || planId === 'premium_plus') {
    return SAAS_CHECKOUT_PLANS.premium.amountCents
  }
  return 0
}

function changeKind(fromId: StoredPlanId, toId: StoredPlanId): ChangeKind {
  if (fromId === toId) {
    return 'none'
  }
  const from = planAmountCents(fromId)
  const to = planAmountCents(toId)
  if (from === 0 && to > 0) {
    return 'start_paid'
  }
  if (to === 0) {
    return 'cancel_later'
  }
  if (to > from) {
    return 'upgrade_now'
  }
  if (to < from) {
    return 'downgrade_later'
  }
  return 'none'
}

function addCalendarMonths(date: Date, months: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1, 12, 0, 0, 0)
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(date.getDate(), lastDay))
  return next
}

function nextCycleDate(startedAt: Date, from = new Date()): Date {
  const start = new Date(startedAt.getFullYear(), startedAt.getMonth(), startedAt.getDate())
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  if (start.getTime() > today.getTime()) {
    return start
  }
  let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0)
  let next = addCalendarMonths(cursor, 1)
  while (new Date(next.getFullYear(), next.getMonth(), next.getDate()).getTime() <= today.getTime()) {
    cursor = next
    next = addCalendarMonths(cursor, 1)
  }
  return new Date(next.getFullYear(), next.getMonth(), next.getDate(), 12, 0, 0, 0)
}

function unixSeconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function subscriptionPeriodUnix(subscription: Stripe.Subscription, field: 'start' | 'end'): number | null {
  const item = subscription.items.data[0] as Record<string, unknown> | undefined
  const itemValue = unixSeconds(item?.[field === 'end' ? 'current_period_end' : 'current_period_start'])
  if (itemValue) {
    return itemValue
  }
  const raw = subscription as unknown as Record<string, unknown>
  return unixSeconds(raw[field === 'end' ? 'current_period_end' : 'current_period_start'])
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const seconds = subscriptionPeriodUnix(subscription, 'end')
  return seconds ? new Date(seconds * 1000) : null
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

function planIdFromPrice(price: Stripe.Price | string | null | undefined): SaasCheckoutPlanId | null {
  if (!price || typeof price === 'string') {
    return null
  }
  const lookup = price.lookup_key ?? price.metadata?.planId
  if (lookup === SAAS_CHECKOUT_PLANS.basic.lookupKey || lookup === 'basic') {
    return 'basic'
  }
  if (lookup === SAAS_CHECKOUT_PLANS.premium.lookupKey || lookup === 'premium') {
    return 'premium'
  }
  if (price.unit_amount === SAAS_CHECKOUT_PLANS.basic.amountCents) {
    return 'basic'
  }
  if (price.unit_amount === SAAS_CHECKOUT_PLANS.premium.amountCents) {
    return 'premium'
  }
  return parseSaasCheckoutPlanId(price.metadata?.planId)
}

async function loadCompany(companyId: string) {
  const snap = await adminDb.collection(COLLECTIONS.companies).doc(companyId).get()
  if (!snap.exists) {
    throw new Error('Restaurante no encontrado.')
  }
  return { ref: snap.ref, data: snap.data()! }
}

function readTimestamp(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate()
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  return null
}

async function releaseSchedule(stripe: Stripe, subscription: Stripe.Subscription): Promise<Stripe.Subscription> {
  const scheduleId = stripeObjectId(subscription.schedule)
  if (!scheduleId) {
    return subscription
  }
  await stripe.subscriptionSchedules.release(scheduleId)
  return stripe.subscriptions.retrieve(subscription.id, { expand: ['items.data.price'] })
}

async function scheduleDowngrade(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  newPriceId: string,
): Promise<Date | null> {
  const periodStart = subscriptionPeriodUnix(subscription, 'start')
  const periodEnd = subscriptionPeriodUnix(subscription, 'end')
  if (!periodStart || !periodEnd) {
    throw new Error('Stripe no devolvió el ciclo de facturación.')
  }

  const currentPriceId = typeof subscription.items.data[0]?.price === 'string'
    ? subscription.items.data[0].price
    : subscription.items.data[0]?.price?.id
  if (!currentPriceId) {
    throw new Error('La suscripción no tiene un precio activo.')
  }

  let scheduleId = stripeObjectId(subscription.schedule)
  if (!scheduleId) {
    const created = await stripe.subscriptionSchedules.create({ from_subscription: subscription.id })
    scheduleId = created.id
  }

  await stripe.subscriptionSchedules.update(scheduleId, {
    end_behavior: 'release',
    phases: [
      {
        items: [{ price: currentPriceId, quantity: subscription.items.data[0]?.quantity ?? 1 }],
        start_date: periodStart,
        end_date: periodEnd,
        proration_behavior: 'none',
      },
      {
        items: [{ price: newPriceId, quantity: subscription.items.data[0]?.quantity ?? 1 }],
        proration_behavior: 'none',
      },
    ],
  })

  return new Date(periodEnd * 1000)
}

function pendingWrites(planId: StoredPlanId | null, at: Date | null) {
  if (!planId || !at) {
    return {
      pendingPlanId: FieldValue.delete(),
      pendingPlanAt: FieldValue.delete(),
    }
  }
  return {
    pendingPlanId: planId,
    pendingPlanAt: Timestamp.fromDate(at),
  }
}

export async function applyDuePendingPlan(companyId: string): Promise<void> {
  const { ref, data } = await loadCompany(companyId)
  const pendingPlanId = parseStoredPlanId(data.pendingPlanId)
  const pendingAt = readTimestamp(data.pendingPlanAt)
  if (!data.pendingPlanId || !pendingAt || pendingAt.getTime() > Date.now()) {
    return
  }

  const nextPlanId = pendingPlanId
  await ref.set(
    {
      planId: nextPlanId,
      planBilling: nextPlanId === 'free' ? null : 'monthly',
      ...(nextPlanId === 'free'
        ? {
            planStartedAt: FieldValue.delete(),
            planLastPaidAt: FieldValue.delete(),
            stripeSubscriptionId: FieldValue.delete(),
          }
        : {}),
      ...pendingWrites(null, null),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  await applyPlanFeatureLimits(companyId, nextPlanId)
}

export async function readCompanyBillingStatus(companyId: string) {
  await applyDuePendingPlan(companyId)
  const { data } = await loadCompany(companyId)
  const planId = parseStoredPlanId(data.planId)
  const pendingPlanId = data.pendingPlanId ? parseStoredPlanId(data.pendingPlanId) : null
  const pendingPlanAt = readTimestamp(data.pendingPlanAt)
  const planStartedAt = readTimestamp(data.planStartedAt)
  const hasSubscription = typeof data.stripeSubscriptionId === 'string' && data.stripeSubscriptionId.length > 0
  let currentPeriodEnd = pendingPlanAt

  if (hasSubscription && isStripeConfigured()) {
    try {
      const stripe = createStripeClient()
      const subscription = await stripe.subscriptions.retrieve(data.stripeSubscriptionId as string, {
        expand: ['items.data.price'],
      })
      currentPeriodEnd = subscriptionPeriodEnd(subscription) ?? currentPeriodEnd
    } catch {
      // Si Stripe falla, usamos la fecha guardada.
    }
  }

  if (!currentPeriodEnd && planId !== 'free' && data.planBilling !== 'perpetual' && planStartedAt) {
    currentPeriodEnd = nextCycleDate(planStartedAt)
  }

  return {
    configured: isStripeConfigured(),
    planId,
    pendingPlanId: pendingPlanId && pendingPlanId !== planId ? pendingPlanId : null,
    pendingPlanAt: currentPeriodEnd && pendingPlanId && pendingPlanId !== planId
      ? currentPeriodEnd.toISOString()
      : null,
    currentPeriodEnd: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
    hasSubscription,
    planBilling: planId === 'free' ? null : data.planBilling === 'perpetual' ? 'perpetual' : 'monthly',
  }
}

export async function changeCompanySubscriptionPlan(input: {
  companyId: string
  toPlanId: StoredPlanId
  appUrl?: string
}): Promise<{
  action: 'unchanged' | 'checkout' | 'upgraded' | 'scheduled' | 'canceled_at_period_end'
  checkoutPlanId?: SaasCheckoutPlanId
  customerId?: string
  chargeNowCents?: number
  periodEnd?: string
  planId: StoredPlanId
  pendingPlanId: StoredPlanId | null
}> {
  await applyDuePendingPlan(input.companyId)
  const { ref, data } = await loadCompany(input.companyId)
  const fromId = parseStoredPlanId(data.planId)
  const toId = input.toPlanId === 'premium_plus' ? 'premium' : input.toPlanId
  const kind = changeKind(fromId, toId)

  if (kind === 'none') {
    return {
      action: 'unchanged',
      planId: fromId,
      pendingPlanId: data.pendingPlanId ? parseStoredPlanId(data.pendingPlanId) : null,
    }
  }

  const subscriptionId = typeof data.stripeSubscriptionId === 'string' ? data.stripeSubscriptionId : ''
  const customerId = typeof data.stripeBillingCustomerId === 'string' ? data.stripeBillingCustomerId : ''
  const billing = data.planBilling === 'perpetual' ? 'perpetual' : 'monthly'
  const startedAt = readTimestamp(data.planStartedAt)

  if (kind === 'start_paid' || (kind === 'upgrade_now' && !subscriptionId)) {
    const paidPlan = parseSaasCheckoutPlanId(toId)
    if (!paidPlan) {
      throw new Error('Ese plan no se puede contratar desde aquí.')
    }
    return {
      action: 'checkout',
      checkoutPlanId: paidPlan,
      customerId: customerId || undefined,
      planId: fromId,
      pendingPlanId: data.pendingPlanId ? parseStoredPlanId(data.pendingPlanId) : null,
    }
  }

  if (subscriptionId && isStripeConfigured()) {
    const stripe = createStripeClient()
    let subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['items.data.price'] })

    if (kind === 'upgrade_now') {
      const paidPlan = parseSaasCheckoutPlanId(toId)
      if (!paidPlan) {
        throw new Error('Ese plan no se puede contratar desde aquí.')
      }
      if (subscription.cancel_at_period_end) {
        subscription = await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: false })
      }
      subscription = await releaseSchedule(stripe, subscription)
      const priceId = await getOrCreateSaasPrice(stripe, paidPlan)
      const itemId = subscription.items.data[0]?.id
      if (!itemId) {
        throw new Error('La suscripción no tiene un precio activo.')
      }
      const updated = await stripe.subscriptions.update(subscription.id, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: 'always_invoice',
        payment_behavior: 'error_if_incomplete',
        metadata: {
          type: SAAS_CHECKOUT_META,
          planId: paidPlan,
          companyId: input.companyId,
        },
        expand: ['latest_invoice'],
      })

      let chargeNowCents = planAmountCents(toId) - planAmountCents(fromId)
      const invoice = updated.latest_invoice
      if (invoice && typeof invoice !== 'string') {
        chargeNowCents = invoice.amount_due || invoice.amount_paid || chargeNowCents
      }

      await ref.set(
        {
          planId: paidPlan,
          planBilling: 'monthly',
          planStartedAt: data.planStartedAt ?? FieldValue.serverTimestamp(),
          planLastPaidAt: FieldValue.serverTimestamp(),
          stripeSubscriptionId: updated.id,
          stripeBillingCustomerId: stripeObjectId(updated.customer) || customerId || null,
          ...pendingWrites(null, null),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      await applyPlanFeatureLimits(input.companyId, paidPlan)

      return {
        action: 'upgraded',
        chargeNowCents,
        periodEnd: subscriptionPeriodEnd(updated)?.toISOString(),
        planId: paidPlan,
        pendingPlanId: null,
      }
    }

    if (kind === 'downgrade_later') {
      const paidPlan = parseSaasCheckoutPlanId(toId)
      if (!paidPlan) {
        throw new Error('Ese plan no se puede contratar desde aquí.')
      }
      if (subscription.cancel_at_period_end) {
        subscription = await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: false })
      }
      const priceId = await getOrCreateSaasPrice(stripe, paidPlan)
      const periodEnd = await scheduleDowngrade(stripe, subscription, priceId)
      await ref.set(
        {
          ...pendingWrites(paidPlan, periodEnd),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      return {
        action: 'scheduled',
        periodEnd: periodEnd?.toISOString(),
        planId: fromId,
        pendingPlanId: paidPlan,
      }
    }

    if (kind === 'cancel_later') {
      subscription = await releaseSchedule(stripe, subscription)
      const canceled = await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true })
      const periodEnd = subscriptionPeriodEnd(canceled)
      await ref.set(
        {
          ...pendingWrites('free', periodEnd),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      return {
        action: 'canceled_at_period_end',
        periodEnd: periodEnd?.toISOString(),
        planId: fromId,
        pendingPlanId: 'free',
      }
    }
  }

  const periodEnd = billing === 'perpetual' || !startedAt
    ? new Date()
    : nextCycleDate(startedAt)

  if ((kind === 'upgrade_now' && billing === 'perpetual') || (billing === 'perpetual' && kind !== 'cancel_later' && kind !== 'downgrade_later')) {
    await ref.set(
      {
        planId: toId,
        planBilling: toId === 'free' ? null : billing === 'perpetual' && kind !== 'start_paid' ? 'perpetual' : 'monthly',
        ...pendingWrites(null, null),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    await applyPlanFeatureLimits(input.companyId, toId)
    return {
      action: 'upgraded',
      planId: toId,
      pendingPlanId: null,
    }
  }

  if (billing === 'perpetual' || periodEnd.getTime() <= Date.now()) {
    await ref.set(
      {
        planId: toId,
        planBilling: toId === 'free' ? null : 'monthly',
        ...(toId === 'free'
          ? {
              planStartedAt: FieldValue.delete(),
              planLastPaidAt: FieldValue.delete(),
            }
          : {}),
        ...pendingWrites(null, null),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    await applyPlanFeatureLimits(input.companyId, toId)
    return {
      action: toId === 'free' ? 'canceled_at_period_end' : 'upgraded',
      planId: toId,
      pendingPlanId: null,
    }
  }

  await ref.set(
    {
      ...pendingWrites(toId, periodEnd),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  return {
    action: toId === 'free' ? 'canceled_at_period_end' : 'scheduled',
    periodEnd: periodEnd.toISOString(),
    planId: fromId,
    pendingPlanId: toId,
  }
}

export async function cancelScheduledCompanyPlanChange(companyId: string): Promise<{
  planId: StoredPlanId
  pendingPlanId: null
}> {
  const { ref, data } = await loadCompany(companyId)
  const subscriptionId = typeof data.stripeSubscriptionId === 'string' ? data.stripeSubscriptionId : ''
  if (subscriptionId && isStripeConfigured()) {
    const stripe = createStripeClient()
    let subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (subscription.cancel_at_period_end) {
      subscription = await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: false })
    }
    await releaseSchedule(stripe, subscription)
  }
  await ref.set(
    {
      ...pendingWrites(null, null),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  return { planId: parseStoredPlanId(data.planId), pendingPlanId: null }
}

export async function syncCompanyFromStripeSubscription(subscription: Stripe.Subscription): Promise<void> {
  if (subscription.metadata?.type && subscription.metadata.type !== SAAS_CHECKOUT_META) {
    return
  }

  let companyId = subscription.metadata?.companyId?.trim() || ''
  if (!companyId) {
    const matches = await adminDb
      .collection(COLLECTIONS.companies)
      .where('stripeSubscriptionId', '==', subscription.id)
      .limit(1)
      .get()
    companyId = matches.empty ? '' : matches.docs[0].id
  }
  if (!companyId) {
    return
  }

  const livePlan = planIdFromPrice(
    typeof subscription.items.data[0]?.price === 'string' ? null : subscription.items.data[0]?.price,
  )
  const canceled = subscription.status === 'canceled' || subscription.status === 'incomplete_expired'

  if (canceled) {
    await adminDb.collection(COLLECTIONS.companies).doc(companyId).set(
      {
        planId: 'free',
        planBilling: null,
        planStartedAt: FieldValue.delete(),
        planLastPaidAt: FieldValue.delete(),
        stripeSubscriptionId: FieldValue.delete(),
        ...pendingWrites(null, null),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    await applyPlanFeatureLimits(companyId, 'free')
    return
  }

  if (subscription.cancel_at_period_end) {
    await adminDb.collection(COLLECTIONS.companies).doc(companyId).set(
      {
        ...pendingWrites('free', subscriptionPeriodEnd(subscription)),
        stripeSubscriptionId: subscription.id,
        stripeBillingCustomerId: stripeObjectId(subscription.customer) || undefined,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    return
  }

  const scheduleId = stripeObjectId(subscription.schedule)
  if (scheduleId && isStripeConfigured()) {
    const stripe = createStripeClient()
    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId)
    const nextPhase = schedule.phases[1]
    const nextPrice = nextPhase?.items?.[0]?.price
    const nextPlan = planIdFromPrice(
      typeof nextPrice === 'string' || !nextPrice ? null : nextPrice as Stripe.Price,
    )
    if (nextPlan && livePlan && nextPlan !== livePlan) {
      const end = unixSeconds(nextPhase.start_date)
      await adminDb.collection(COLLECTIONS.companies).doc(companyId).set(
        {
          planId: livePlan,
          planBilling: 'monthly',
          stripeSubscriptionId: subscription.id,
          stripeBillingCustomerId: stripeObjectId(subscription.customer) || undefined,
          ...pendingWrites(nextPlan, end ? new Date(end * 1000) : subscriptionPeriodEnd(subscription)),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      return
    }
  }

  if (livePlan) {
    await adminDb.collection(COLLECTIONS.companies).doc(companyId).set(
      {
        planId: livePlan,
        planBilling: 'monthly',
        stripeSubscriptionId: subscription.id,
        stripeBillingCustomerId: stripeObjectId(subscription.customer) || undefined,
        ...pendingWrites(null, null),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    await applyPlanFeatureLimits(companyId, livePlan)
  }
}

export async function cancelCompanyStripeSubscription(companyId: string): Promise<void> {
  const { data } = await loadCompany(companyId)
  const subscriptionId = typeof data.stripeSubscriptionId === 'string' ? data.stripeSubscriptionId : ''
  if (!subscriptionId || !isStripeConfigured()) {
    return
  }
  const stripe = createStripeClient()
  try {
    await stripe.subscriptions.cancel(subscriptionId)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (!message.includes('No such subscription') && !message.includes('already canceled')) {
      throw error
    }
  }
}

export async function deleteCompanyAccount(companyId: string): Promise<void> {
  await cancelCompanyStripeSubscription(companyId)

  const companyRef = adminDb.collection(COLLECTIONS.companies).doc(companyId)
  const companySnap = await companyRef.get()
  if (!companySnap.exists) {
    throw new Error('Restaurante no encontrado.')
  }
  const companyData = companySnap.data()!
  const ownerUid = typeof companyData.ownerUid === 'string' ? companyData.ownerUid : ''
  const credentialsSnap = await adminDb.collection(COLLECTIONS.companyCredentials).doc(companyId).get()
  const loginName =
    (credentialsSnap.data()?.loginName as string | undefined) ?? (companyData.name as string | undefined) ?? ''

  const batch = adminDb.batch()
  const reservations = await adminDb.collection(COLLECTIONS.reservations).where('companyId', '==', companyId).get()
  reservations.docs.forEach((docSnap) => batch.delete(docSnap.ref))
  const tables = await adminDb.collection(COLLECTIONS.tables).where('companyId', '==', companyId).get()
  tables.docs.forEach((docSnap) => batch.delete(docSnap.ref))
  batch.delete(companyRef)
  batch.delete(adminDb.collection(COLLECTIONS.companyCredentials).doc(companyId))
  batch.delete(adminDb.collection(COLLECTIONS.restaurantIndex).doc(companyId))
  batch.delete(adminDb.collection(COLLECTIONS.companies).doc(companyId).collection('private').doc('ops'))
  batch.delete(adminDb.collection(COLLECTIONS.companies).doc(companyId).collection('private').doc('promotionPin'))
  if (loginName) {
    batch.delete(adminDb.collection(COLLECTIONS.logins).doc(slugify(loginName)))
  }
  if (ownerUid) {
    batch.delete(adminDb.collection(COLLECTIONS.users).doc(ownerUid))
  }
  await batch.commit()

  if (ownerUid) {
    try {
      await adminAuth.deleteUser(ownerUid)
    } catch {
      // La cuenta de Auth puede haberse borrado ya.
    }
  }
}

export function billingAppUrl(origin?: string): string {
  if (origin) {
    return origin.replace(/\/$/, '')
  }
  return getAppBaseUrl()
}

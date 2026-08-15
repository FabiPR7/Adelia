import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { createStripeClient, getAppBaseUrl } from './config.ts'

export interface CompanyStripeSnapshot {
  stripeAccountId: string | null
  stripeChargesEnabled: boolean
  stripePayoutsEnabled: boolean
  stripeDetailsSubmitted: boolean
}

function companyStripeReturnUrl(tab = 'reservation-settings'): string {
  return `${getAppBaseUrl()}/empresa?tab=${encodeURIComponent(tab)}&stripe=return`
}

function companyStripeRefreshUrl(tab = 'reservation-settings'): string {
  return `${getAppBaseUrl()}/empresa?tab=${encodeURIComponent(tab)}&stripe=refresh`
}

export async function readCompanyStripeSnapshot(companyId: string): Promise<CompanyStripeSnapshot> {
  const snap = await adminDb.collection('companies').doc(companyId).get()
  const data = snap.data() ?? {}

  return {
    stripeAccountId: typeof data.stripeAccountId === 'string' ? data.stripeAccountId : null,
    stripeChargesEnabled: data.stripeChargesEnabled === true,
    stripePayoutsEnabled: data.stripePayoutsEnabled === true,
    stripeDetailsSubmitted: data.stripeDetailsSubmitted === true,
  }
}

export async function syncCompanyStripeStatus(
  companyId: string,
  accountId: string,
): Promise<CompanyStripeSnapshot> {
  const stripe = createStripeClient()
  const account = await stripe.accounts.retrieve(accountId)

  const snapshot: CompanyStripeSnapshot = {
    stripeAccountId: account.id,
    stripeChargesEnabled: account.charges_enabled === true,
    stripePayoutsEnabled: account.payouts_enabled === true,
    stripeDetailsSubmitted: account.details_submitted === true,
  }

  await adminDb.collection('companies').doc(companyId).update({
    stripeAccountId: snapshot.stripeAccountId,
    stripeChargesEnabled: snapshot.stripeChargesEnabled,
    stripePayoutsEnabled: snapshot.stripePayoutsEnabled,
    stripeDetailsSubmitted: snapshot.stripeDetailsSubmitted,
    updatedAt: FieldValue.serverTimestamp(),
  })

  return snapshot
}

export async function ensureConnectAccount(
  companyId: string,
  email: string,
): Promise<string> {
  const current = await readCompanyStripeSnapshot(companyId)

  if (current.stripeAccountId) {
    return current.stripeAccountId
  }

  const stripe = createStripeClient()
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'ES',
    email: email.trim() || undefined,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      companyId,
    },
  })

  await adminDb.collection('companies').doc(companyId).update({
    stripeAccountId: account.id,
    stripeChargesEnabled: false,
    stripePayoutsEnabled: false,
    stripeDetailsSubmitted: false,
    updatedAt: FieldValue.serverTimestamp(),
  })

  return account.id
}

export async function createConnectOnboardingLink(
  companyId: string,
  accountId: string,
): Promise<string> {
  const stripe = createStripeClient()
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: companyStripeRefreshUrl(),
    return_url: companyStripeReturnUrl(),
    type: 'account_onboarding',
  })

  if (!link.url) {
    throw new Error('Stripe no devolvió la URL de onboarding.')
  }

  await syncCompanyStripeStatus(companyId, accountId)

  return link.url
}

export async function createConnectDashboardLink(accountId: string): Promise<string> {
  const stripe = createStripeClient()
  const link = await stripe.accounts.createLoginLink(accountId)

  if (!link.url) {
    throw new Error('Stripe no devolvió el acceso al panel.')
  }

  return link.url
}

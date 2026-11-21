import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { readCompanyOps, writeCompanyOps } from '../data/companyOps.ts'
import { createStripeClient, getAppBaseUrl } from './config.ts'
import { ensurePaymentMethodDomains } from './paymentDomains.ts'

export interface CompanyStripeSnapshot {
  stripeAccountId: string | null
  stripeChargesEnabled: boolean
  stripePayoutsEnabled: boolean
  stripeDetailsSubmitted: boolean
}

function companyStripeReturnUrl(tab = 'reservation-settings'): string {
  return `${getAppBaseUrl()}/panel?tab=${encodeURIComponent(tab)}&stripe=return`
}

function companyStripeRefreshUrl(tab = 'reservation-settings'): string {
  return `${getAppBaseUrl()}/panel?tab=${encodeURIComponent(tab)}&stripe=refresh`
}

/**
 * La clave actual no puede acceder a esa cuenta: se conectó con otra clave (por
 * ejemplo en modo de prueba) o el restaurante revocó el acceso.
 */
/** Error con mensaje para el restaurante (en español, sin detalles técnicos). */
export class StripeConnectSetupError extends Error {}

export function isStripeAccountUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }
  const { type, code } = error as { type?: unknown; code?: unknown }
  return type === 'StripePermissionError' || code === 'account_invalid' || code === 'resource_missing'
}

export async function readCompanyStripeSnapshot(companyId: string): Promise<CompanyStripeSnapshot> {
  const data = await readCompanyOps(companyId) ?? {}

  return {
    stripeAccountId: typeof data.stripeAccountId === 'string' ? data.stripeAccountId : null,
    stripeChargesEnabled: data.stripeChargesEnabled === true,
    stripePayoutsEnabled: data.stripePayoutsEnabled === true,
    stripeDetailsSubmitted: data.stripeDetailsSubmitted === true,
  }
}

async function persistStripeSnapshot(companyId: string, snapshot: CompanyStripeSnapshot): Promise<void> {
  const payload = {
    stripeAccountId: snapshot.stripeAccountId,
    stripeChargesEnabled: snapshot.stripeChargesEnabled,
    stripePayoutsEnabled: snapshot.stripePayoutsEnabled,
    stripeDetailsSubmitted: snapshot.stripeDetailsSubmitted,
    updatedAt: FieldValue.serverTimestamp(),
  }
  await Promise.all([
    writeCompanyOps(companyId, payload),
    adminDb.collection('companies').doc(companyId).update(payload),
  ])
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

  await persistStripeSnapshot(companyId, snapshot)

  // En cuanto el local puede cobrar, se da de alta el dominio para Apple Pay / Google Pay.
  if (snapshot.stripeChargesEnabled) {
    void ensurePaymentMethodDomains(account.id)
      .catch((error) => console.warn('payment domains:', error instanceof Error ? error.message : error))
  }

  return snapshot
}

export async function ensureConnectAccount(
  companyId: string,
  email: string,
): Promise<string> {
  const current = await readCompanyStripeSnapshot(companyId)

  const stripe = createStripeClient()

  if (current.stripeAccountId) {
    try {
      await stripe.accounts.retrieve(current.stripeAccountId)
      return current.stripeAccountId
    } catch (error) {
      // El restaurante ha pedido conectar: una cuenta inaccesible se sustituye.
      if (!isStripeAccountUnavailable(error)) {
        throw error
      }
    }
  }

  // Stripe ya no deja crear cuentas conectadas con Accounts v1 (type: 'express'):
  // se crean con Accounts v2. Leer su estado, el enlace de alta y las fianzas
  // (cargos directos en la cuenta) siguen funcionando igual con la API v1.
  const contactEmail = email.trim()
  if (!contactEmail) {
    throw new StripeConnectSetupError('Añade un email de contacto en «Contacto» antes de conectar Stripe.')
  }
  const account = await stripe.v2.core.accounts.create({
    contact_email: contactEmail,
    identity: { country: 'ES' },
    dashboard: 'express',
    defaults: {
      responsibilities: { fees_collector: 'application', losses_collector: 'application' },
    },
    configuration: {
      merchant: { capabilities: { card_payments: { requested: true } } },
      recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
    },
    metadata: { companyId },
  })

  await persistStripeSnapshot(companyId, {
    stripeAccountId: account.id,
    stripeChargesEnabled: false,
    stripePayoutsEnabled: false,
    stripeDetailsSubmitted: false,
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

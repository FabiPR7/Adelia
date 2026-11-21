import { adminDb } from '../firebase-admin.ts'
import { createStripeClient } from './config.ts'

/**
 * Apple Pay y Google Pay en la fianza de la web: la fianza se cobra en la cuenta de
 * Stripe de cada restaurante, así que nuestro dominio tiene que estar registrado en
 * cada una. Se hace solo (al pedir una fianza o al conectar Stripe) y se apunta en
 * `stripePaymentDomains/{cuenta}` (solo lo lee el servidor) para no repetirlo.
 */
export const PAYMENT_METHOD_DOMAINS = ['adeliareservas.com', 'www.adeliareservas.com'] as const

const RECHECK_MS = 7 * 24 * 60 * 60_000
const MEMO_MS = 60 * 60_000
const memo = new Map<string, number>()

interface DomainState {
  domain: string
  applePay: string
  googlePay: string
  error: string
}

export async function ensurePaymentMethodDomains(accountId: string): Promise<DomainState[] | null> {
  if (!accountId) return null
  const seen = memo.get(accountId)
  if (seen && Date.now() - seen < MEMO_MS) return null

  const ref = adminDb.collection('stripePaymentDomains').doc(accountId)
  const saved = (await ref.get()).data()
  const allActive = Array.isArray(saved?.domains)
    && (saved.domains as DomainState[]).every((item) => item.applePay === 'active' && item.googlePay === 'active')
  if (saved && allActive && Date.now() - Number(saved.checkedAt ?? 0) < RECHECK_MS) {
    memo.set(accountId, Date.now())
    return null
  }

  const stripe = createStripeClient()
  const options = { stripeAccount: accountId }
  const existing = await stripe.paymentMethodDomains.list({ limit: 20 }, options)
  const states: DomainState[] = []
  for (const domain of PAYMENT_METHOD_DOMAINS) {
    let record = existing.data.find((item) => item.domain_name === domain)
      ?? await stripe.paymentMethodDomains.create({ domain_name: domain, enabled: true }, options)
    if (record.apple_pay?.status !== 'active') {
      record = await stripe.paymentMethodDomains.validate(record.id, {}, options).catch(() => record!)
    }
    states.push({
      domain,
      applePay: String(record.apple_pay?.status ?? 'unknown'),
      googlePay: String(record.google_pay?.status ?? 'unknown'),
      error: String(record.apple_pay?.status_details?.error_message ?? '').slice(0, 300),
    })
  }

  await ref.set({ accountId, domains: states, checkedAt: Date.now() })
  memo.set(accountId, Date.now())
  return states
}

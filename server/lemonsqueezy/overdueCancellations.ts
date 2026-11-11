import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from '../data/collections.ts'
import { applyPlanFeatureLimits } from '../company/enforcePlanLimits.ts'
import { getLemonSqueezyApiKey } from './config.ts'
import { isPerpetualCompany, syncCompanyFromLemonSubscription } from './syncCompany.ts'

/** Margen tras el fin del periodo: Lemon Squeezy reintenta los avisos durante unos días. */
export const OVERDUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000

async function fetchLemonSubscription(subscriptionId: string, apiKey: string): Promise<unknown | null> {
  const response = await fetch(
    `https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${apiKey}`,
      },
    },
  )
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`Lemon Squeezy respondió ${response.status} al consultar la suscripción.`)
  }
  const payload = (await response.json()) as { data?: unknown }
  return payload.data ?? null
}

/**
 * Respaldo diario: una suscripción cancelada queda con `pendingPlanId: 'free'` hasta el fin
 * del periodo, y es el aviso `subscription_expired` el que la pasa a gratis. Si ese aviso no
 * llegó, aquí se resuelve: con API key se pregunta a Lemon Squeezy el estado real; sin ella,
 * se pasa a gratis cuando ya han pasado unos días desde el fin del periodo.
 */
export async function resolveOverdueLemonCancellations(now = new Date()): Promise<number> {
  const cutoff = Timestamp.fromMillis(now.getTime() - OVERDUE_GRACE_MS)
  // Solo rango sobre un campo (no necesita índice compuesto); el resto se filtra aquí.
  const snapshot = await adminDb
    .collection(COLLECTIONS.companies)
    .where('pendingPlanAt', '<', cutoff)
    .limit(200)
    .get()

  const apiKey = getLemonSqueezyApiKey()
  let resolved = 0

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data()
    const subscriptionId = typeof data.lemonSqueezySubscriptionId === 'string' ? data.lemonSqueezySubscriptionId : ''
    // Las altas antiguas de Stripe tienen su propio flujo; tampoco se toca un plan de por vida.
    if (data.pendingPlanId !== 'free' || !subscriptionId || data.planId === 'free' || isPerpetualCompany(data)) {
      continue
    }

    try {
      if (apiKey) {
        const subscription = await fetchLemonSubscription(subscriptionId, apiKey)
        if (subscription) {
          // El estado real manda: si la reanudó, conserva el plan; si caducó, pasa a gratis.
          await syncCompanyFromLemonSubscription(subscription, docSnap.id)
          resolved += 1
          continue
        }
      }

      await docSnap.ref.set(
        {
          planId: 'free',
          planBilling: null,
          planPaymentState: FieldValue.delete(),
          planPaymentFailedAt: FieldValue.delete(),
          pendingPlanId: FieldValue.delete(),
          pendingPlanAt: FieldValue.delete(),
          lemonSqueezySubscriptionId: FieldValue.delete(),
          planEndedBy: 'overdue_cancellation',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      await applyPlanFeatureLimits(docSnap.id, 'free')
      resolved += 1
    } catch (error) {
      console.error('Lemon Squeezy: no se pudo resolver la cancelación vencida', docSnap.id, error)
    }
  }

  return resolved
}

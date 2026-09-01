import type { Request, Response } from 'express'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { createStripeClient, getStripeWebhookSecret } from '../stripe/config.ts'
import { syncCompanyStripeStatus } from '../stripe/connect.ts'
import { handleSaasStripeEvent } from '../stripe/saasBilling.ts'

const STRIPE_EVENTS_COLLECTION = 'stripeEvents'
const STRIPE_EVENT_RETENTION_MS = 45 * 24 * 60 * 60 * 1000

/**
 * Reclama un evento de Stripe de forma atómica para que no se procese dos veces.
 * Stripe reenvía cada evento hasta que respondes 2xx y además puede entregar el
 * mismo evento varias veces. Devuelve `false` si ya se había procesado.
 */
async function claimStripeEvent(eventId: string, eventType: string): Promise<boolean> {
  const ref = adminDb.collection(STRIPE_EVENTS_COLLECTION).doc(eventId)
  try {
    return await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref)
      if (snap.exists) {
        return false
      }
      transaction.set(ref, {
        type: eventType,
        receivedAt: FieldValue.serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + STRIPE_EVENT_RETENTION_MS),
      })
      return true
    })
  } catch (error) {
    console.error('Stripe event claim error:', error)
    // Si no podemos reclamar, dejamos pasar el procesado: es preferible un
    // posible reprocesado idempotente a perder el evento.
    return true
  }
}

async function releaseStripeEvent(eventId: string): Promise<void> {
  await adminDb
    .collection(STRIPE_EVENTS_COLLECTION)
    .doc(eventId)
    .delete()
    .catch(() => undefined)
}

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const webhookSecret = getStripeWebhookSecret()

  if (!webhookSecret) {
    res.status(503).send('Stripe webhook no configurado.')
    return
  }

  const signature = req.headers['stripe-signature']

  if (!signature || typeof signature !== 'string') {
    res.status(400).send('Falta la firma de Stripe.')
    return
  }

  let event

  try {
    const stripe = createStripeClient()
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature, webhookSecret)
  } catch (error) {
    console.error('Stripe webhook signature error:', error)
    res.status(400).send('Firma de webhook inválida.')
    return
  }

  // Idempotencia: si este evento ya se procesó, respondemos 200 y salimos sin
  // volver a tocar Firestore, planes ni correos.
  if (!(await claimStripeEvent(event.id, event.type))) {
    res.json({ received: true, duplicate: true })
    return
  }

  try {
    if (event.type === 'account.updated') {
      const account = event.data.object
      const companyId = account.metadata?.companyId

      if (companyId && typeof companyId === 'string') {
        await syncCompanyStripeStatus(companyId, account.id)
      }
    }

    await handleSaasStripeEvent(event)
  } catch (error) {
    console.error('Stripe webhook handler error:', error)
    // Liberamos la reclamación para que el reintento de Stripe vuelva a entrar.
    await releaseStripeEvent(event.id)
    res.status(500).send('Error procesando webhook.')
    return
  }

  res.json({ received: true })
}

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { allowLemonSqueezyTestEvents, getLemonSqueezyWebhookSecret } from '../lemonsqueezy/config.ts'
import { syncCompanyFromLemonOrder } from '../lemonsqueezy/lifetime.ts'
import {
  syncCompanyFromLemonInvoice,
  syncCompanyFromLemonSubscription,
} from '../lemonsqueezy/syncCompany.ts'

const EVENTS_COLLECTION = 'lemonSqueezyEvents'
const EVENT_RETENTION_MS = 45 * 24 * 60 * 60 * 1000

const HANDLED_EVENTS = new Set([
  // Pago único "de por vida" (ver lemonsqueezy/lifetime.ts).
  'order_created',
  'order_refunded',
  'subscription_created',
  'subscription_updated',
  'subscription_resumed',
  'subscription_unpaused',
  'subscription_paused',
  'subscription_cancelled',
  'subscription_expired',
  'subscription_payment_success',
  'subscription_payment_failed',
  'subscription_payment_recovered',
])

const INVOICE_EVENTS = new Set([
  'subscription_payment_success',
  'subscription_payment_failed',
  'subscription_payment_recovered',
])

function verifySignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
  if (!signatureHeader) {
    return false
  }
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const received = signatureHeader.trim()
  const expectedBuf = Buffer.from(expected, 'hex')
  const receivedBuf = Buffer.from(received, 'hex')
  if (expectedBuf.length !== receivedBuf.length || expectedBuf.length === 0) {
    return false
  }
  return timingSafeEqual(expectedBuf, receivedBuf)
}

async function claimEvent(eventId: string, eventName: string): Promise<'claimed' | 'duplicate' | 'unavailable'> {
  const ref = adminDb.collection(EVENTS_COLLECTION).doc(eventId)
  try {
    return await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref)
      if (snap.exists) {
        return 'duplicate'
      }
      transaction.set(ref, {
        type: eventName,
        receivedAt: FieldValue.serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + EVENT_RETENTION_MS),
      })
      return 'claimed'
    })
  } catch (error) {
    console.error('Lemon Squeezy event claim error:', error)
    return 'unavailable'
  }
}

async function releaseEvent(eventId: string): Promise<void> {
  await adminDb.collection(EVENTS_COLLECTION).doc(eventId).delete().catch(() => undefined)
}

export async function handleLemonSqueezyWebhook(req: Request, res: Response): Promise<void> {
  const secret = getLemonSqueezyWebhookSecret()
  if (!secret) {
    res.status(503).send('Lemon Squeezy webhook no configurado.')
    return
  }

  const rawBody = req.body as Buffer
  const signature = req.header('X-Signature') ?? ''

  if (!Buffer.isBuffer(rawBody) || !verifySignature(rawBody, signature, secret)) {
    res.status(400).send('Firma no válida.')
    return
  }

  let payload: {
    meta?: { event_name?: string; test_mode?: boolean; custom_data?: { company_id?: unknown } | null }
    data?: { id?: string; attributes?: { updated_at?: string; test_mode?: boolean } }
  }
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    res.status(400).send('Cuerpo no válido.')
    return
  }

  const eventName = payload.meta?.event_name ?? req.header('X-Event-Name') ?? ''
  const subscriptionId = payload.data?.id ?? ''
  const updatedAt = payload.data?.attributes?.updated_at ?? ''
  const eventId = `${eventName}:${subscriptionId}:${updatedAt}`.replace(/[^A-Za-z0-9_:.-]/g, '_').slice(0, 400)

  if (!eventName || !subscriptionId) {
    res.json({ received: true, ignored: true })
    return
  }

  if (!HANDLED_EVENTS.has(eventName)) {
    res.json({ received: true, ignored: true })
    return
  }

  // Una compra de prueba no es un pago real: no puede activar planes.
  const isTestEvent = payload.meta?.test_mode === true || payload.data?.attributes?.test_mode === true
  if (isTestEvent && !allowLemonSqueezyTestEvents()) {
    res.json({ received: true, ignored: true })
    return
  }

  const claim = await claimEvent(eventId, eventName)
  if (claim === 'unavailable') {
    res.status(503).send('No se pudo registrar el evento. Reintenta.')
    return
  }
  if (claim === 'duplicate') {
    res.json({ received: true, duplicate: true })
    return
  }

  try {
    // La web mete el id del restaurante en el checkout cuando ha iniciado sesión.
    const customCompanyId = typeof payload.meta?.custom_data?.company_id === 'string'
      ? payload.meta.custom_data.company_id
      : ''
    if (eventName === 'order_created' || eventName === 'order_refunded') {
      await syncCompanyFromLemonOrder(payload.data, eventName, customCompanyId)
    } else if (INVOICE_EVENTS.has(eventName)) {
      await syncCompanyFromLemonInvoice(payload.data, eventName)
    } else {
      await syncCompanyFromLemonSubscription(payload.data, customCompanyId)
    }
  } catch (error) {
    console.error('Lemon Squeezy webhook handler error:', error)
    await releaseEvent(eventId)
    res.status(500).send('Error procesando webhook.')
    return
  }

  res.json({ received: true })
}

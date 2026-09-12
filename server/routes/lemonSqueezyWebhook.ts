import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { getLemonSqueezyWebhookSecret } from '../lemonsqueezy/config.ts'
import { syncCompanyFromLemonSubscription } from '../lemonsqueezy/syncCompany.ts'

const EVENTS_COLLECTION = 'lemonSqueezyEvents'
const EVENT_RETENTION_MS = 45 * 24 * 60 * 60 * 1000

const HANDLED_EVENTS = new Set([
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

async function claimEvent(eventId: string, eventName: string): Promise<boolean> {
  const ref = adminDb.collection(EVENTS_COLLECTION).doc(eventId)
  try {
    return await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref)
      if (snap.exists) {
        return false
      }
      transaction.set(ref, {
        type: eventName,
        receivedAt: FieldValue.serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + EVENT_RETENTION_MS),
      })
      return true
    })
  } catch (error) {
    console.error('Lemon Squeezy event claim error:', error)
    return true
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
    meta?: { event_name?: string }
    data?: { id?: string; attributes?: { updated_at?: string } }
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

  if (!(await claimEvent(eventId, eventName))) {
    res.json({ received: true, duplicate: true })
    return
  }

  try {
    await syncCompanyFromLemonSubscription(payload.data)
  } catch (error) {
    console.error('Lemon Squeezy webhook handler error:', error)
    await releaseEvent(eventId)
    res.status(500).send('Error procesando webhook.')
    return
  }

  res.json({ received: true })
}

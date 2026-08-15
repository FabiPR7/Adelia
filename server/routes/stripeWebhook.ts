import type { Request, Response } from 'express'
import { createStripeClient, getStripeWebhookSecret } from '../stripe/config.ts'
import { syncCompanyStripeStatus } from '../stripe/connect.ts'

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

  try {
    if (event.type === 'account.updated') {
      const account = event.data.object
      const companyId = account.metadata?.companyId

      if (companyId && typeof companyId === 'string') {
        await syncCompanyStripeStatus(companyId, account.id)
      }
    }
  } catch (error) {
    console.error('Stripe webhook handler error:', error)
    res.status(500).send('Error procesando webhook.')
    return
  }

  res.json({ received: true })
}

import Stripe from 'stripe'

export function getStripeSecretKey(): string | undefined {
  return process.env.STRIPE_SECRET_KEY?.trim() || undefined
}

export function getStripeWebhookSecret(): string | undefined {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined
}

export function getStripePublishableKey(): string | undefined {
  return process.env.STRIPE_PUBLISHABLE_KEY?.trim()
    || process.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim()
    || undefined
}

export function getAppBaseUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/$/, '')
}

export function isStripeConfigured(): boolean {
  return Boolean(getStripeSecretKey())
}

export function createStripeClient(): Stripe {
  const secretKey = getStripeSecretKey()

  if (!secretKey) {
    throw new Error('Stripe no está configurado. Añade STRIPE_SECRET_KEY al entorno del API.')
  }

  return new Stripe(secretKey)
}

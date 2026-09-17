import { Router, type Request, type Response } from 'express'
import { InputError, asTrimmed } from '../security/validate.ts'
import { readPublicSaasCheckoutSession, saasBillingStatus } from '../stripe/saasBilling.ts'
import { completeFreeCompanySignup } from '../data/createCompanyFromCheckout.ts'

function asCheckoutSessionId(value: unknown): string {
  const id = asTrimmed(value, 200, 'La sesión de pago')
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) {
    throw new InputError('La sesión de pago no es válida.')
  }
  return id
}

function signupProfileFromBody(body: Record<string, unknown>) {
  return {
    email: String(body.email ?? ''),
    phone: String(body.phone ?? ''),
    password: String(body.password ?? ''),
    name: String(body.name ?? ''),
    location: String(body.location ?? ''),
    website: typeof body.website === 'string' ? body.website : '',
    municipality: typeof body.municipality === 'string' ? body.municipality : '',
    postalCode: typeof body.postalCode === 'string' ? body.postalCode : '',
    country: typeof body.country === 'string' ? body.country : '',
    latitude: typeof body.latitude === 'number' ? body.latitude : null,
    longitude: typeof body.longitude === 'number' ? body.longitude : null,
    logoUrl: typeof body.logoUrl === 'string' ? body.logoUrl : '',
    photos: Array.isArray(body.photos) ? body.photos as string[] : [],
    characteristics: Array.isArray(body.characteristics) ? body.characteristics as string[] : [],
    venueTypes: Array.isArray(body.venueTypes) ? body.venueTypes as string[] : [],
    amenities: Array.isArray(body.amenities) ? body.amenities as string[] : [],
  }
}

const router = Router()

router.get('/status', (_req: Request, res: Response) => {
  res.json(saasBillingStatus())
})

router.get('/session', async (req: Request, res: Response) => {
  try {
    const sessionId = asCheckoutSessionId(req.query.session_id)
    const session = await readPublicSaasCheckoutSession(sessionId)

    if (!session) {
      res.status(404).json({ error: 'No encontramos ese pago.' })
      return
    }

    res.json(session)
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('Saas billing session error:', error)
    res.status(500).json({ error: 'No se pudo consultar el pago.' })
  }
})

// El plan Sala/Local ya no se paga por Stripe: se cobra en Lemon Squeezy
// (ver server/routes/lemonSqueezyWebhook.ts). Stripe en esta app solo sirve
// para Connect/fianzas. Se dejan cerrados por si queda algún enlace antiguo.
router.post('/checkout', (_req: Request, res: Response) => {
  res.status(410).json({ error: 'Ese plan ya no se paga por Stripe. Usa el checkout de Lemon Squeezy.' })
})

router.post('/complete-signup', (_req: Request, res: Response) => {
  res.status(410).json({ error: 'El alta pagada por Stripe ya no está disponible. Regístrate y elige plan desde /empresa/alta.' })
})

router.post('/complete-free-signup', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const result = await completeFreeCompanySignup({
      ...signupProfileFromBody(body),
      plan: typeof body.plan === 'string' ? body.plan : undefined,
    })
    res.json(result)
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('Free company signup error:', error)
    const message = error instanceof Error ? error.message : 'No se pudo crear la empresa.'
    res.status(500).json({ error: message })
  }
})

export default router

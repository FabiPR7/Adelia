import { Router, type Request, type Response } from 'express'
import { InputError, asOptionalTrimmed, asTrimmed } from '../security/validate.ts'
import { isAllowedOrigin } from '../security/origins.ts'
import { getAppBaseUrl } from '../stripe/config.ts'
import {
  createSaasCheckoutSession,
  readPublicSaasCheckoutSession,
  saasBillingStatus,
} from '../stripe/saasBilling.ts'
import { parseSaasCheckoutPlanId } from '../stripe/saasCatalog.ts'
import { completeFreeCompanySignup, completePaidCompanySignup } from '../data/createCompanyFromCheckout.ts'

function checkoutReturnUrl(req: Request): string {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : ''
  if (origin && isAllowedOrigin(origin)) {
    return origin.replace(/\/$/, '')
  }
  return getAppBaseUrl()
}

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

router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const planId = parseSaasCheckoutPlanId(req.body?.planId)
    if (!planId) {
      res.status(400).json({ error: 'Ese plan no se paga por Stripe.' })
      return
    }

    const companyId = asOptionalTrimmed(req.body?.companyId, 128)
    const session = await createSaasCheckoutSession({
      planId,
      companyId: companyId && /^[a-zA-Z0-9_-]+$/.test(companyId) ? companyId : undefined,
      appUrl: checkoutReturnUrl(req),
    })

    res.json(session)
  } catch (error) {
    console.error('Saas checkout error:', error)
    const message = error instanceof Error ? error.message : 'No se pudo abrir el pago.'
    res.status(500).json({ error: message })
  }
})

router.post('/complete-signup', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const result = await completePaidCompanySignup({
      sessionId: asCheckoutSessionId(body.sessionId),
      ...signupProfileFromBody(body),
    })

    res.json(result)
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('Company signup error:', error)
    const message = error instanceof Error ? error.message : 'No se pudo crear la empresa.'
    res.status(500).json({ error: message })
  }
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

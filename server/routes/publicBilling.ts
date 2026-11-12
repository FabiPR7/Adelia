import { Router, type Request, type Response } from 'express'
import { InputError, asTrimmed } from '../security/validate.ts'
import { readPublicSaasCheckoutSession, saasBillingStatus } from '../stripe/saasBilling.ts'
import { completeFreeCompanySignup } from '../data/createCompanyFromCheckout.ts'
import { requireRecaptcha } from '../security/recaptcha.ts'
import { claimPendingPlanByToken } from '../lemonsqueezy/pendingClaim.ts'
import { APP_URL } from '../email/config.ts'

function asCheckoutSessionId(value: unknown): string {
  const id = asTrimmed(value, 200, 'La sesión de pago')
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) {
    throw new InputError('La sesión de pago no es válida.')
  }
  return id
}

function signupProfileFromBody(body: Record<string, unknown>) {
  return {
    acceptedLegalVersion: body.acceptedLegalVersion,
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

function claimPage(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Adelia</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f2ec;font-family:system-ui,sans-serif;color:#2a1c14;padding:16px}main{max-width:420px;background:#fff;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,.08)}h1{font-size:1.4rem;margin:0 0 .6rem}p{line-height:1.5}a{display:inline-block;margin-top:.6rem;padding:.7rem 1.2rem;border-radius:999px;background:#5b4636;color:#fff;text-decoration:none;font-weight:600}</style></head>
<body><main><h1>${title}</h1><p>${body}</p><a href="${APP_URL}/login">Ir a mi panel</a></main></body></html>`
}

// Enlace del correo «Activa tu plan»: solo quien tiene acceso a ese correo puede abrirlo.
router.get('/claim-plan', async (req: Request, res: Response) => {
  try {
    const result = await claimPendingPlanByToken(String(req.query.token ?? ''))
    res.set('Cache-Control', 'no-store')
    if (result === 'activated') {
      res.send(claimPage('Plan activado', 'Tu plan ya está activo en tu restaurante. Entra en tu panel para empezar a usarlo.'))
      return
    }
    res.status(result === 'expired' ? 410 : 404).send(claimPage(
      'Enlace no válido',
      result === 'expired'
        ? 'Este enlace ha caducado. Escríbenos y te mandamos otro.'
        : 'Este enlace no es válido o ya se usó. Si tu plan no aparece en el panel, escríbenos.',
    ))
  } catch (error) {
    console.error('Claim plan link error:', error)
    res.status(500).send(claimPage('Algo ha fallado', 'No pudimos activar el plan. Prueba otra vez en unos minutos.'))
  }
})

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
    await requireRecaptcha(req.body?.recaptchaToken, 'company_signup', 0.6)
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
    const message = error instanceof Error ? error.message : 'No se pudo crear la empresa.'
    console.error('Free company signup error:', error)
    res.status(message.includes('robot') || message.includes('aceptar') ? 400 : 500).json({ error: message })
  }
})

export default router

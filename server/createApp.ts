import cors from 'cors'
import express from 'express'
import companiesRouter from './routes/companies.ts'
import authRouter from './routes/auth.ts'
import companyEmailRouter from './routes/companyEmail.ts'
import companyReservationsRouter from './routes/companyReservations.ts'
import companyStripeRouter from './routes/companyStripe.ts'
import companyBillingRouter from './routes/companyBilling.ts'
import publicBookingRouter from './routes/public.ts'
import publicBillingRouter from './routes/publicBilling.ts'
import publicPromotionsRouter from './routes/publicPromotions.ts'
import publicDiscoveryRouter from './routes/publicDiscovery.ts'
import publicMenusRouter from './routes/publicMenus.ts'
import citiesRouter from './routes/cities.ts'
import geocodeRouter from './routes/geocode.ts'
import uploadsRouter from './routes/uploads.ts'
import clientErrorsRouter from './routes/clientErrors.ts'
import seoRouter from './routes/seo.ts'
import reservationMinSpendRouter from './routes/reservationMinSpend.ts'
import reservationDepositRouter from './routes/reservationDeposit.ts'
import reservationEmailRouter from './routes/reservationEmail.ts'
import customerNotificationsRouter from './routes/customerNotifications.ts'
import customerFriendsRouter from './routes/customerFriends.ts'
import customerFavoritesRouter from './routes/customerFavorites.ts'
import customerReservationInvitesRouter from './routes/customerReservationInvites.ts'
import customerReservationChallengesRouter from './routes/customerReservationChallenges.ts'
import customerGamificationRouter from './routes/customerGamification.ts'
import customerReviewsRouter from './routes/customerReviews.ts'
import customerAccountRouter from './routes/customerAccount.ts'
import companyGamificationRouter from './routes/companyGamification.ts'
import companyNotificationsRouter from './routes/companyNotifications.ts'
import { handleStripeWebhook } from './routes/stripeWebhook.ts'
import { handleLemonSqueezyWebhook } from './routes/lemonSqueezyWebhook.ts'
import appEventsRouter from './routes/appEvents.ts'
import adminRouter from './routes/admin.ts'
import publicCatalogRouter from './routes/publicCatalog.ts'
import { verifyAdmin } from './auth/verifyRequest.ts'
import { isAllowedOrigin } from './security/origins.ts'
import { securityHeaders } from './security/headers.ts'
import { sanitizeRequest } from './security/sanitize.ts'
import { apiRateLimit } from './security/rateLimit.ts'
import { remoteCatalogMiddleware } from './data/remoteCatalog.ts'
import { InputError } from './security/validate.ts'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  // La web llega por Firebase Hosting y luego por Google (2 saltos): con 1 se tomaba
  // la IP de Hosting y todos los usuarios compartían el mismo límite anti-abuso.
  app.set('trust proxy', 2)

  app.use(securityHeaders)
  app.use(cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Origin not allowed'))
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }))

  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json', limit: '1mb' }),
    (req, res) => {
      void handleStripeWebhook(req, res)
    },
  )

  app.post(
    '/api/lemonsqueezy/webhook',
    express.raw({ type: '*/*', limit: '1mb' }),
    (req, res) => {
      void handleLemonSqueezyWebhook(req, res)
    },
  )

  app.use(express.json({ limit: '256kb' }))
  app.use(express.urlencoded({ extended: false, limit: '32kb' }))
  app.use(sanitizeRequest)
  app.use(apiRateLimit)
  app.use(remoteCatalogMiddleware)

  app.get('/api/health', (req, res) => {
    // Diagnóstico temporal de proxies (sin IPs): ¿req.ip es el visitante o un proxy?
    if (req.query.diag === 'ip') {
      const xff = String(req.headers['x-forwarded-for'] ?? '').split(',').map((part) => part.trim()).filter(Boolean)
      res.json({
        ok: true,
        hops: xff.length,
        ipIsFirst: xff.length > 0 && req.ip === xff[0],
        ipIsLast: xff.length > 0 && req.ip === xff[xff.length - 1],
      })
      return
    }
    res.json({ ok: true })
  })

  app.use('/api/companies', verifyAdmin, companiesRouter)
  app.use('/api/admin', verifyAdmin, adminRouter)
  app.use('/api/public/catalog', publicCatalogRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/company', companyReservationsRouter)
  app.use('/api/company', companyEmailRouter)
  app.use('/api/company', companyBillingRouter)
  app.use('/api/company', companyStripeRouter)
  app.use('/api/company', reservationDepositRouter)
  app.use('/api/reservations', reservationEmailRouter)
  app.use('/api/public/billing', publicBillingRouter)
  app.use('/api/public/events', appEventsRouter)
  app.use('/api/public/booking', publicBookingRouter)
  app.use('/api/public/promotions', publicPromotionsRouter)
  app.use('/api/public/discovery', publicDiscoveryRouter)
  app.use('/api/public/menus', publicMenusRouter)
  app.use('/api/public/reservations', reservationMinSpendRouter)
  app.use('/api/public/cities', citiesRouter)
  app.use('/api/public/geocode', geocodeRouter)
  app.use('/api/uploads', uploadsRouter)
  app.use('/api/public/client-errors', clientErrorsRouter)
  app.use(seoRouter)
  app.use('/api/customer/notifications', customerNotificationsRouter)
  app.use('/api/customer/friends', customerFriendsRouter)
  app.use('/api/customer/favorites', customerFavoritesRouter)
  app.use('/api/customer/reservation-invites', customerReservationInvitesRouter)
  app.use('/api/customer/reservation-challenges', customerReservationChallengesRouter)
  app.use('/api/customer/gamification', customerGamificationRouter)
  app.use('/api/company', companyGamificationRouter)
  app.use('/api/company', companyNotificationsRouter)
  app.use('/api/customer/reviews', customerReviewsRouter)
  app.use('/api/customer/account', customerAccountRouter)

  app.use('/api', (req, res) => {
    res.status(404).json({
      error: `No existe ${req.method} ${req.originalUrl}. Reinicia npm run dev.`,
    })
  })

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof InputError) {
        res.status(400).json({ error: error.message })
        return
      }
      console.error('API error:', error)
      res.status(500).json({ error: 'Error interno del servidor.' })
    },
  )

  return app
}

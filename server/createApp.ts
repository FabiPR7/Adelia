import cors from 'cors'
import express from 'express'
import companiesRouter from './routes/companies.ts'
import authRouter from './routes/auth.ts'
import companyEmailRouter from './routes/companyEmail.ts'
import companyReservationsRouter from './routes/companyReservations.ts'
import companyStripeRouter from './routes/companyStripe.ts'
import publicBookingRouter from './routes/public.ts'
import publicPromotionsRouter from './routes/publicPromotions.ts'
import citiesRouter from './routes/cities.ts'
import geocodeRouter from './routes/geocode.ts'
import reservationMinSpendRouter from './routes/reservationMinSpend.ts'
import reservationDepositRouter from './routes/reservationDeposit.ts'
import reservationEmailRouter from './routes/reservationEmail.ts'
import customerNotificationsRouter from './routes/customerNotifications.ts'
import customerFriendsRouter from './routes/customerFriends.ts'
import customerReservationInvitesRouter from './routes/customerReservationInvites.ts'
import customerReservationChallengesRouter from './routes/customerReservationChallenges.ts'
import customerGamificationRouter from './routes/customerGamification.ts'
import customerReviewsRouter from './routes/customerReviews.ts'
import companyGamificationRouter from './routes/companyGamification.ts'
import companyNotificationsRouter from './routes/companyNotifications.ts'
import { handleStripeWebhook } from './routes/stripeWebhook.ts'
import { canUseAdminSdk } from './firebase-admin.ts'
import { verifyAdmin } from './auth/verifyRequest.ts'
import { isAllowedOrigin } from './security/origins.ts'
import { securityHeaders } from './security/headers.ts'
import { sanitizeRequest } from './security/sanitize.ts'
import { apiRateLimit } from './security/rateLimit.ts'
import { InputError } from './security/validate.ts'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)

  app.use(securityHeaders)
  app.use(cors({
    origin(origin, callback) {
      callback(null, !origin || isAllowedOrigin(origin))
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Secret'],
    maxAge: 600,
  }))

  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json', limit: '1mb' }),
    (req, res) => {
      void handleStripeWebhook(req, res)
    },
  )

  app.use(express.json({ limit: '256kb' }))
  app.use(express.urlencoded({ extended: false, limit: '32kb' }))
  app.use(sanitizeRequest)
  app.use(apiRateLimit)

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      authMode: canUseAdminSdk ? 'admin-sdk' : 'rest',
    })
  })

  app.use('/api/companies', verifyAdmin, companiesRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/company', companyReservationsRouter)
  app.use('/api/company', companyEmailRouter)
  app.use('/api/company', companyStripeRouter)
  app.use('/api/company', reservationDepositRouter)
  app.use('/api/reservations', reservationEmailRouter)
  app.use('/api/public/booking', publicBookingRouter)
  app.use('/api/public/promotions', publicPromotionsRouter)
  app.use('/api/public/reservations', reservationMinSpendRouter)
  app.use('/api/public/cities', citiesRouter)
  app.use('/api/public/geocode', geocodeRouter)
  app.use('/api/customer/notifications', customerNotificationsRouter)
  app.use('/api/customer/friends', customerFriendsRouter)
  app.use('/api/customer/reservation-invites', customerReservationInvitesRouter)
  app.use('/api/customer/reservation-challenges', customerReservationChallengesRouter)
  app.use('/api/customer/gamification', customerGamificationRouter)
  app.use('/api/company', companyGamificationRouter)
  app.use('/api/company', companyNotificationsRouter)
  app.use('/api/customer/reviews', customerReviewsRouter)

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

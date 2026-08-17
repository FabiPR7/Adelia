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
import customerGamificationRouter from './routes/customerGamification.ts'
import customerReviewsRouter from './routes/customerReviews.ts'
import companyGamificationRouter from './routes/companyGamification.ts'
import companyNotificationsRouter from './routes/companyNotifications.ts'
import { handleStripeWebhook } from './routes/stripeWebhook.ts'
import { canUseAdminSdk } from './firebase-admin.ts'
import { verifyAdmin } from './auth/verifyRequest.ts'

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://adeliareservas.com',
  'https://www.adeliareservas.com',
]

function isAllowedOrigin(origin: string): boolean {
  const configured = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if ([...DEFAULT_CORS_ORIGINS, ...configured].includes(origin)) {
    return true
  }

  try {
    const { hostname, protocol } = new URL(origin)
    return (
      (hostname === 'localhost' && (protocol === 'http:' || protocol === 'https:'))
      || (protocol === 'https:' && (
        hostname.endsWith('.web.app')
        || hostname.endsWith('.firebaseapp.com')
      ))
    )
  } catch {
    return false
  }
}

export function createApp() {
  const app = express()

  app.use(cors({
    origin(origin, callback) {
      callback(null, !origin || isAllowedOrigin(origin))
    },
  }))

  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    (req, res) => {
      void handleStripeWebhook(req, res)
    },
  )

  app.use(express.json())

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
  app.use('/api/customer/gamification', customerGamificationRouter)
  app.use('/api/company', companyGamificationRouter)
  app.use('/api/company', companyNotificationsRouter)
  app.use('/api/customer/reviews', customerReviewsRouter)

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error('API error:', error)
      const message =
        error instanceof Error ? error.message : 'Error interno del servidor.'
      res.status(500).json({ error: message })
    },
  )

  return app
}

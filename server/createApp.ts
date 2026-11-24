import cors from 'cors'
import express from 'express'
import companiesRouter from './routes/companies.ts'
import authRouter from './routes/auth.ts'
import companyEmailRouter from './routes/companyEmail.ts'
import companyReservationsRouter from './routes/companyReservations.ts'
import companyStripeRouter from './routes/companyStripe.ts'
import companyReportsRouter from './routes/companyReports.ts'
import companyBillingRouter from './routes/companyBilling.ts'
import publicBookingRouter from './routes/public.ts'
import publicBillingRouter from './routes/publicBilling.ts'
import publicPromotionsRouter from './routes/publicPromotions.ts'
import publicDiscoveryRouter from './routes/publicDiscovery.ts'
import publicNowRouter from './routes/publicNow.ts'
import publicMenusRouter from './routes/publicMenus.ts'
import citiesRouter from './routes/cities.ts'
import geocodeRouter from './routes/geocode.ts'
import uploadsRouter from './routes/uploads.ts'
import clientErrorsRouter from './routes/clientErrors.ts'
import seoRouter from './routes/seo.ts'
import reservationMinSpendRouter from './routes/reservationMinSpend.ts'
import reservationDepositRouter from './routes/reservationDeposit.ts'
import reservationEmailRouter from './routes/reservationEmail.ts'
import companyReservationChangesRouter from './routes/companyReservationChanges.ts'
import companySettingsRouter from './routes/companySettings.ts'
import companyMenuRouter from './routes/companyMenu.ts'
import companyPromotionsRouter from './routes/companyPromotions.ts'
import companyPinAndReviewsRouter from './routes/companyPinAndReviews.ts'
import adminWritesRouter from './routes/adminWrites.ts'
import customerNotificationsRouter from './routes/customerNotifications.ts'
import customerFriendsRouter from './routes/customerFriends.ts'
import customerFavoritesRouter from './routes/customerFavorites.ts'
import customerReservationsRouter from './routes/customerReservations.ts'
import customerReservationInvitesRouter from './routes/customerReservationInvites.ts'
import customerReservationChallengesRouter from './routes/customerReservationChallenges.ts'
import customerGamificationRouter from './routes/customerGamification.ts'
import customerCollectionRouter from './routes/customerCollection.ts'
import customerPromotionsRouter from './routes/customerPromotions.ts'
import customerReviewsRouter from './routes/customerReviews.ts'
import customerReportsRouter from './routes/customerReports.ts'
import customerSuggestionsRouter from './routes/customerSuggestions.ts'
import customerAccountRouter from './routes/customerAccount.ts'
import customerProfileUpdateRouter from './routes/customerProfileUpdate.ts'
import companyGamificationRouter from './routes/companyGamification.ts'
import companyNotificationsRouter from './routes/companyNotifications.ts'
import { handleStripeWebhook } from './routes/stripeWebhook.ts'
import { handleLemonSqueezyWebhook } from './routes/lemonSqueezyWebhook.ts'
import appEventsRouter from './routes/appEvents.ts'
import adminRouter from './routes/admin.ts'
import publicCatalogRouter from './routes/publicCatalog.ts'
import { verifyAdmin, requireCustomerSession } from './auth/verifyRequest.ts'
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
  // Los identificadores de la URL se usan como rutas de la base de datos: una barra
  // codificada (%2F, %5C) o «..» podría apuntar a otro documento. Se rechazan aquí.
  app.use((req, res, next) => {
    const rawPath = (req.originalUrl || '').split('?')[0] ?? ''
    if (/%2f|%5c|%00/i.test(rawPath) || /(^|\/)\.\.(\/|$)/.test(rawPath)) {
      res.status(400).json({ error: 'Ruta no válida.' })
      return
    }
    next()
  })
  app.use(sanitizeRequest)
  app.use(apiRateLimit)
  app.use(remoteCatalogMiddleware)

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.use('/api/companies', verifyAdmin, companiesRouter)
  app.use('/api/admin', verifyAdmin, adminRouter)
  app.use('/api/admin', verifyAdmin, adminWritesRouter)
  app.use('/api/public/catalog', publicCatalogRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/company', companyReservationsRouter)
  app.use('/api/company', companyReservationChangesRouter)
  app.use('/api/company', companySettingsRouter)
  app.use('/api/company', companyMenuRouter)
  app.use('/api/company', companyPromotionsRouter)
  app.use('/api/company', companyPinAndReviewsRouter)
  app.use('/api/company', companyEmailRouter)
  app.use('/api/company', companyBillingRouter)
  app.use('/api/company', companyStripeRouter)
  app.use('/api/company', companyReportsRouter)
  app.use('/api/company', reservationDepositRouter)
  app.use('/api/reservations', reservationEmailRouter)
  app.use('/api/public/billing', publicBillingRouter)
  app.use('/api/public/events', appEventsRouter)
  app.use('/api/public/booking', publicBookingRouter)
  app.use('/api/public/promotions', publicPromotionsRouter)
  app.use('/api/public/discovery', publicNowRouter)
  app.use('/api/public/discovery', publicDiscoveryRouter)
  app.use('/api/public/menus', publicMenusRouter)
  app.use('/api/public/reservations', reservationMinSpendRouter)
  app.use('/api/public/cities', citiesRouter)
  app.use('/api/public/geocode', geocodeRouter)
  app.use('/api/uploads', uploadsRouter)
  app.use('/api/public/client-errors', clientErrorsRouter)
  app.use(seoRouter)
  // Todas las rutas de clientes piden sesión: sin ella, 401 al momento.
  app.use('/api/customer', requireCustomerSession)
  app.use('/api/customer/notifications', customerNotificationsRouter)
  app.use('/api/customer/friends', customerFriendsRouter)
  app.use('/api/customer/favorites', customerFavoritesRouter)
  app.use('/api/customer/reservations', customerReservationsRouter)
  app.use('/api/customer/reservation-invites', customerReservationInvitesRouter)
  app.use('/api/customer/reservation-challenges', customerReservationChallengesRouter)
  app.use('/api/customer/gamification', customerGamificationRouter)
  app.use('/api/customer/collection', customerCollectionRouter)
  app.use('/api/customer/promotions', customerPromotionsRouter)
  app.use('/api/company', companyGamificationRouter)
  app.use('/api/company', companyNotificationsRouter)
  app.use('/api/customer/reviews', customerReviewsRouter)
  app.use('/api/customer/reports', customerReportsRouter)
  app.use('/api/customer/suggestions', customerSuggestionsRouter)
  app.use('/api/customer/account', customerProfileUpdateRouter)
  app.use('/api/customer/account', customerAccountRouter)

  app.use('/api', (req, res) => {
    res.status(404).json({
      error: 'No existe esta dirección de la API.',
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

import cors from 'cors'
import express from 'express'
import companiesRouter from './routes/companies.ts'
import authRouter from './routes/auth.ts'
import companyEmailRouter from './routes/companyEmail.ts'
import companyReservationsRouter from './routes/companyReservations.ts'
import publicBookingRouter from './routes/public.ts'
import publicPromotionsRouter from './routes/publicPromotions.ts'
import citiesRouter from './routes/cities.ts'
import reservationEmailRouter from './routes/reservationEmail.ts'
import { adminAuth, adminDb, canUseAdminSdk } from './firebase-admin.ts'
import { getUserRoleWithRest, verifyIdTokenWithRest } from './rest-firebase.ts'

export function createApp() {
  const app = express()

  app.use(cors({ origin: true }))
  app.use(express.json())

  async function verifyAdmin(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    try {
      const header = req.headers.authorization

      if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No autorizado.' })
        return
      }

      const token = header.slice(7)

      if (canUseAdminSdk) {
        const decoded = await adminAuth.verifyIdToken(token)
        const userSnap = await adminDb.collection('users').doc(decoded.uid).get()

        if (!userSnap.exists || userSnap.data()?.role !== 'admin') {
          res.status(403).json({ error: 'Solo el administrador puede realizar esta acción.' })
          return
        }

        next()
        return
      }

      const decoded = await verifyIdTokenWithRest(token)
      const role = await getUserRoleWithRest(token, decoded.uid)

      if (role !== 'admin') {
        res.status(403).json({ error: 'Solo el administrador puede realizar esta acción.' })
        return
      }

      next()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token inválido o expirado.'
      res.status(401).json({ error: message })
    }
  }

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
  app.use('/api/reservations', reservationEmailRouter)
  app.use('/api/public/booking', publicBookingRouter)
  app.use('/api/public/promotions', publicPromotionsRouter)
  app.use('/api/public/cities', citiesRouter)

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

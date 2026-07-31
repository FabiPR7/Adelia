import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import companiesRouter from './routes/companies.ts'
import authRouter from './routes/auth.ts'
import { adminAuth, adminDb, hasServiceAccount } from './firebase-admin.ts'
import { getUserRoleWithRest, verifyIdTokenWithRest } from './rest-firebase.ts'

const app = express()
const PORT = Number(process.env.API_PORT ?? 3001)

app.use(cors())
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

    if (hasServiceAccount) {
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
    authMode: hasServiceAccount ? 'admin-sdk' : 'rest',
  })
})

app.use('/api/companies', verifyAdmin, companiesRouter)
app.use('/api/auth', authRouter)

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

app.listen(PORT, () => {
  console.log(`API Adelia en http://localhost:${PORT}`)
  console.log(
    hasServiceAccount
      ? 'Auth: Firebase Admin SDK (serviceAccountKey.json)'
      : 'Auth: REST (sin serviceAccountKey — crear empresas OK, eliminar Auth limitado)',
  )
})

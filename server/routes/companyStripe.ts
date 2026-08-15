import { Router, type Request, type Response } from 'express'
import { adminAuth, adminDb } from '../firebase-admin.ts'
import { isStripeConfigured } from '../stripe/config.ts'
import {
  createConnectDashboardLink,
  createConnectOnboardingLink,
  ensureConnectAccount,
  readCompanyStripeSnapshot,
  syncCompanyStripeStatus,
} from '../stripe/connect.ts'

const router = Router()

async function verifyCompanyOwner(req: Request, res: Response, companyId: string): Promise<boolean> {
  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autorizado.' })
    return false
  }

  try {
    const decoded = await adminAuth.verifyIdToken(header.slice(7))
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = userSnap.data()?.role as string | undefined
    const userCompanyId = userSnap.data()?.companyId as string | undefined

    if (role === 'admin') {
      return true
    }

    if (role === 'company' && userCompanyId === companyId) {
      return true
    }

    res.status(403).json({ error: 'No tienes permiso para esta acción.' })
    return false
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada.' })
    return false
  }
}

router.get('/:companyId/stripe/status', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params

    if (!(await verifyCompanyOwner(req, res, companyId))) {
      return
    }

    if (!isStripeConfigured()) {
      res.status(503).json({ error: 'Stripe no está configurado en el servidor.' })
      return
    }

    let snapshot = await readCompanyStripeSnapshot(companyId)

    if (snapshot.stripeAccountId) {
      snapshot = await syncCompanyStripeStatus(companyId, snapshot.stripeAccountId)
    }

    res.json({
      configured: true,
      ...snapshot,
      readyForDeposits: snapshot.stripeChargesEnabled && snapshot.stripeDetailsSubmitted,
    })
  } catch (error) {
    console.error('Stripe status error:', error)
    res.status(500).json({ error: 'No se pudo consultar el estado de Stripe.' })
  }
})

router.post('/:companyId/stripe/connect', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params

    if (!(await verifyCompanyOwner(req, res, companyId))) {
      return
    }

    if (!isStripeConfigured()) {
      res.status(503).json({ error: 'Stripe no está configurado en el servidor.' })
      return
    }

    const companySnap = await adminDb.collection('companies').doc(companyId).get()

    if (!companySnap.exists) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }

    const companyData = companySnap.data()!
    const email = typeof companyData.contactEmail === 'string' && companyData.contactEmail.trim()
      ? companyData.contactEmail.trim()
      : typeof companyData.ownerEmail === 'string'
        ? companyData.ownerEmail
        : ''

    const accountId = await ensureConnectAccount(companyId, email)
    const url = await createConnectOnboardingLink(companyId, accountId)
    const snapshot = await readCompanyStripeSnapshot(companyId)

    res.json({
      url,
      ...snapshot,
      readyForDeposits: snapshot.stripeChargesEnabled && snapshot.stripeDetailsSubmitted,
    })
  } catch (error) {
    console.error('Stripe connect error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo iniciar Stripe Connect.',
    })
  }
})

router.post('/:companyId/stripe/dashboard', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params

    if (!(await verifyCompanyOwner(req, res, companyId))) {
      return
    }

    if (!isStripeConfigured()) {
      res.status(503).json({ error: 'Stripe no está configurado en el servidor.' })
      return
    }

    const snapshot = await readCompanyStripeSnapshot(companyId)

    if (!snapshot.stripeAccountId) {
      res.status(400).json({ error: 'Primero conecta tu cuenta de Stripe.' })
      return
    }

    const url = await createConnectDashboardLink(snapshot.stripeAccountId)
    res.json({ url })
  } catch (error) {
    console.error('Stripe dashboard error:', error)
    res.status(500).json({ error: 'No se pudo abrir el panel de Stripe.' })
  }
})

export default router

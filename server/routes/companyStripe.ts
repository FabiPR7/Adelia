import { Router, type Request, type Response } from 'express'
import { adminDb } from '../firebase-admin.ts'
import { isStripeConfigured } from '../stripe/config.ts'
import {
  createConnectDashboardLink,
  createConnectOnboardingLink,
  ensureConnectAccount,
  isStripeAccountUnavailable,
  readCompanyStripeSnapshot,
  syncCompanyStripeStatus, StripeConnectSetupError } from '../stripe/connect.ts'
import { ensureCompanyOwner } from '../auth/verifyRequest.ts'

const router = Router()

router.get('/:companyId/stripe/status', async (req: Request<Record<string, string>>, res: Response) => {
  try {
    const { companyId } = req.params

    if (!(await ensureCompanyOwner(req, res, companyId))) {
      return
    }

    if (!isStripeConfigured()) {
      res.status(503).json({ error: 'Stripe no está configurado en el servidor.' })
      return
    }

    let snapshot = await readCompanyStripeSnapshot(companyId)

    if (snapshot.stripeAccountId) {
      try {
        snapshot = await syncCompanyStripeStatus(companyId, snapshot.stripeAccountId)
      } catch (error) {
        if (!isStripeAccountUnavailable(error)) {
          throw error
        }
        // No se borra la cuenta guardada al consultar: una clave mal configurada
        // desconectaría a todos los restaurantes. Se sustituye al volver a conectar.
        res.json({
          configured: true,
          ...snapshot,
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
          stripeDetailsSubmitted: false,
          readyForDeposits: false,
          accountUnavailable: true,
        })
        return
      }
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

router.post('/:companyId/stripe/connect', async (req: Request<Record<string, string>>, res: Response) => {
  try {
    const { companyId } = req.params

    if (!(await ensureCompanyOwner(req, res, companyId))) {
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
    // Antes se enseñaba al restaurante el error de Stripe tal cual (en inglés y técnico).
    res.status(error instanceof StripeConnectSetupError ? 400 : 500).json({
      error: error instanceof StripeConnectSetupError
        ? error.message
        : 'No se pudo conectar con Stripe ahora mismo. Inténtalo en unos minutos y, si sigue fallando, escríbenos.',
    })
  }
})

router.post('/:companyId/stripe/dashboard', async (req: Request<Record<string, string>>, res: Response) => {
  try {
    const { companyId } = req.params

    if (!(await ensureCompanyOwner(req, res, companyId))) {
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

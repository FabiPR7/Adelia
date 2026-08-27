import { Router, type Request, type Response } from 'express'
import { adminDb } from '../firebase-admin.ts'
import { verifyCompanyAccount } from '../auth/verifyRequest.ts'
import { isAllowedOrigin } from '../security/origins.ts'
import { InputError } from '../security/validate.ts'
import { createSaasCheckoutSession } from '../stripe/saasBilling.ts'
import {
  applyDuePendingPlan,
  billingAppUrl,
  cancelScheduledCompanyPlanChange,
  changeCompanySubscriptionPlan,
  deleteCompanyAccount,
  readCompanyBillingStatus,
} from '../stripe/saasPlanChanges.ts'

const router = Router()

function requestAppUrl(req: Request): string {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : ''
  if (origin && isAllowedOrigin(origin)) {
    return origin.replace(/\/$/, '')
  }
  return billingAppUrl()
}

function parseTargetPlan(value: unknown): 'free' | 'basic' | 'premium' {
  if (value === 'free' || value === 'basic' || value === 'premium') {
    return value
  }
  throw new InputError('Elige Mesa, Sala o Local.')
}

router.get('/billing/status', async (req: Request, res: Response) => {
  try {
    const account = await verifyCompanyAccount(req)
    await applyDuePendingPlan(account.companyId)
    res.json(await readCompanyBillingStatus(account.companyId))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No autorizado.'
    res.status(message.includes('sesión') || message.includes('autorizado') ? 401 : 500).json({ error: message })
  }
})

router.post('/billing/change', async (req: Request, res: Response) => {
  try {
    const account = await verifyCompanyAccount(req)
    const toPlanId = parseTargetPlan(req.body?.planId)
    const result = await changeCompanySubscriptionPlan({
      companyId: account.companyId,
      toPlanId,
      appUrl: requestAppUrl(req),
    })

    if (result.action === 'checkout') {
      if (!result.checkoutPlanId) {
        res.status(400).json({ error: 'Ese plan no se puede pagar desde aquí.' })
        return
      }
      const session = await createSaasCheckoutSession({
        planId: result.checkoutPlanId,
        companyId: account.companyId,
        customerId: result.customerId,
        appUrl: requestAppUrl(req),
        successNext: 'panel',
      })
      res.json({
        ...result,
        url: session.url,
        testMode: session.testMode,
      })
      return
    }

    res.json(result)
  } catch (error) {
    if (error instanceof InputError) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('Company plan change error:', error)
    const message = error instanceof Error ? error.message : 'No se pudo cambiar el plan.'
    res.status(500).json({ error: message })
  }
})

router.post('/billing/cancel-pending', async (req: Request, res: Response) => {
  try {
    const account = await verifyCompanyAccount(req)
    const result = await cancelScheduledCompanyPlanChange(account.companyId)
    res.json(result)
  } catch (error) {
    console.error('Cancel pending plan error:', error)
    const message = error instanceof Error ? error.message : 'No se pudo cancelar el cambio.'
    res.status(500).json({ error: message })
  }
})

router.post('/account/delete', async (req: Request, res: Response) => {
  try {
    const account = await verifyCompanyAccount(req)
    const confirm = typeof req.body?.confirmName === 'string' ? req.body.confirmName.trim() : ''
    const companySnap = await adminDb.collection('companies').doc(account.companyId).get()
    const name = typeof companySnap.data()?.name === 'string' ? companySnap.data()!.name.trim() : ''
    if (!name || confirm.localeCompare(name, 'es', { sensitivity: 'accent' }) !== 0) {
      res.status(400).json({ error: 'Escribe el nombre exacto del restaurante para confirmar.' })
      return
    }
    await deleteCompanyAccount(account.companyId)
    res.json({ success: true })
  } catch (error) {
    console.error('Delete company account error:', error)
    const message = error instanceof Error ? error.message : 'No se pudo eliminar la cuenta.'
    res.status(500).json({ error: message })
  }
})

export default router

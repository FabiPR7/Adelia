import { Router, type Request, type Response } from 'express'
import { adminDb } from '../firebase-admin.ts'
import { verifyCompanyAccount } from '../auth/verifyRequest.ts'
import {
  applyDuePendingPlan,
  deleteCompanyAccount,
  readCompanyBillingStatus,
} from '../stripe/saasPlanChanges.ts'

const router = Router()

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

// El cambio/alta/baja de plan (Sala/Local) ya no se hace por Stripe: se paga y
// se gestiona en el portal de cliente de Lemon Squeezy. Stripe en este panel
// solo sirve para Connect (fianzas). Se dejan cerrados por si queda algún
// enlace o llamada antigua apuntando aquí.
router.post('/billing/change', async (req: Request, res: Response) => {
  try {
    await verifyCompanyAccount(req)
    res.status(410).json({
      error: 'El cambio de plan ya no se hace desde aquí. Usa "Cambiar de plan" en tu zona de Plan.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No autorizado.'
    res.status(message.includes('sesión') || message.includes('autorizado') ? 401 : 410).json({ error: message })
  }
})

router.post('/billing/cancel-pending', async (req: Request, res: Response) => {
  try {
    await verifyCompanyAccount(req)
    res.status(410).json({
      error: 'La baja ya no se gestiona desde aquí. Usa el portal de Lemon Squeezy desde tu zona de Plan.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No autorizado.'
    res.status(message.includes('sesión') || message.includes('autorizado') ? 401 : 410).json({ error: message })
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

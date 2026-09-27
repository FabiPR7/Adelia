import { Router, type Request, type Response } from 'express'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import { deleteCustomerAccount } from '../data/deleteCustomerAccount.ts'

const router = Router()

router.post('/delete', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const confirm = typeof req.body?.confirm === 'string' ? req.body.confirm.trim().toUpperCase() : ''
    if (confirm !== 'ELIMINAR') {
      res.status(400).json({ error: 'Escribe ELIMINAR para confirmar la baja de tu cuenta.' })
      return
    }

    await deleteCustomerAccount(customer.uid)
    res.json({ success: true })
  } catch (error) {
    console.error('Delete customer account error:', error)
    const message = error instanceof Error ? error.message : 'No se pudo eliminar la cuenta.'
    const status = message.includes('autorizado') || message.includes('cliente') || message.includes('Perfil')
      ? 401
      : message.includes('Solo se pueden') || message.includes('no encontrada')
        ? 400
        : 500
    res.status(status).json({ error: message })
  }
})

export default router

import { Router, type Request, type Response } from 'express'
import { adminDb } from '../firebase-admin.ts'
import { syncReservationDepositForStatus } from '../stripe/deposits.ts'
import { ensureCompanyOwner } from '../auth/verifyRequest.ts'

const router = Router()

router.post('/:companyId/reservations/:reservationId/deposit/sync', async (req: Request, res: Response) => {
  try {
    const { companyId, reservationId } = req.params
    const status = req.body?.status

    if (!(await ensureCompanyOwner(req, res, companyId))) {
      return
    }

    if (status !== 'confirmed' && status !== 'cancelled') {
      res.status(400).json({ error: 'Estado de reserva no válido para la fianza.' })
      return
    }

    await syncReservationDepositForStatus({
      reservationId,
      companyId,
      status,
    })

    res.json({ ok: true })
  } catch (error) {
    console.error('Reservation deposit sync error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo gestionar la fianza.',
    })
  }
})

export default router

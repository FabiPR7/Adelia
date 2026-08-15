import { Router, type Request, type Response } from 'express'
import { adminAuth, adminDb } from '../firebase-admin.ts'
import { syncReservationDepositForStatus } from '../stripe/deposits.ts'

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

router.post('/:companyId/reservations/:reservationId/deposit/sync', async (req: Request, res: Response) => {
  try {
    const { companyId, reservationId } = req.params
    const status = req.body?.status

    if (!(await verifyCompanyOwner(req, res, companyId))) {
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

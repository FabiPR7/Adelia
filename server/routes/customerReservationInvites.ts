import { Router, type Request, type Response } from 'express'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import {
  listInvitesForReservation,
  listInvitesForUser,
  respondToReservationInvite,
} from '../reservations/invites.ts'

const router = Router()

router.get('/state', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const state = await listInvitesForUser(user.uid)
    res.json(state)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar las invitaciones.'
    res.status(message.includes('cliente') || message.includes('autorizado') ? 401 : 500).json({ error: message })
  }
})

router.get('/reservation/:reservationId', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const reservationId = String(req.params.reservationId ?? '').trim()
    if (!reservationId) {
      res.status(400).json({ error: 'Reserva no válida.' })
      return
    }

    const invites = await listInvitesForReservation(reservationId, user.uid)
    if (invites === null) {
      res.status(403).json({ error: 'No puedes ver estas invitaciones.' })
      return
    }

    res.json({ invites })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar las invitaciones.'
    res.status(message.includes('cliente') || message.includes('autorizado') ? 401 : 500).json({ error: message })
  }
})

router.post('/:inviteId/accept', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const invite = await respondToReservationInvite(String(req.params.inviteId ?? ''), user.uid, 'accepted')
    res.json({ invite })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo aceptar la invitación.'
    const status = message.includes('cliente') || message.includes('autorizado')
      ? 401
      : message.includes('no encontrada')
        ? 404
        : message.includes('tuya')
          ? 403
          : 409
    res.status(status).json({ error: message })
  }
})

router.post('/:inviteId/reject', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const invite = await respondToReservationInvite(String(req.params.inviteId ?? ''), user.uid, 'rejected')
    res.json({ invite })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo rechazar la invitación.'
    const status = message.includes('cliente') || message.includes('autorizado')
      ? 401
      : message.includes('no encontrada')
        ? 404
        : message.includes('tuya')
          ? 403
          : 409
    res.status(status).json({ error: message })
  }
})

export default router

import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from '../data/collections.ts'
import {
  createReservationInvites,
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

/** Invitar amigos a una reserva ya hecha (solo el titular, antes de que empiece). */
router.post('/reservation/:reservationId/invite', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const reservationId = String(req.params.reservationId ?? '').trim()
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(reservationId)) {
      res.status(400).json({ error: 'Reserva no válida.' })
      return
    }
    const reservationSnap = await adminDb.collection(COLLECTIONS.reservations).doc(reservationId).get()
    const reservation = reservationSnap.data()
    if (!reservation || reservation.customerUid !== user.uid) {
      res.status(403).json({ error: 'Solo quien tiene la reserva a su nombre puede invitar.' })
      return
    }
    if (reservation.status === 'cancelled') {
      res.status(409).json({ error: 'Esta reserva está cancelada.' })
      return
    }
    const startTime = reservation.startTime instanceof Timestamp ? reservation.startTime.toDate() : null
    if (!startTime || startTime.getTime() <= Date.now()) {
      res.status(409).json({ error: 'Solo puedes invitar a reservas que aún no han empezado.' })
      return
    }
    const companySnap = await adminDb.collection(COLLECTIONS.companies).doc(String(reservation.companyId ?? '')).get()
    const company = companySnap.data() ?? {}
    const photos = Array.isArray(company.photos) ? company.photos : []
    const photoUrl = (typeof photos[0] === 'string' && photos[0].trim())
      ? photos[0].trim()
      : typeof company.logoUrl === 'string' ? company.logoUrl : ''

    const created = await createReservationInvites({
      reservationId,
      startTime,
      pax: typeof reservation.pax === 'number' ? reservation.pax : 2,
      companyId: String(reservation.companyId ?? ''),
      companyName: String(company.name ?? 'Restaurante'),
      companySlug: String(company.slug ?? ''),
      companyPhotoUrl: photoUrl,
      fromUid: user.uid,
      fromDisplayName: typeof user.data.displayName === 'string' ? user.data.displayName : 'Usuario',
      fromPhotoUrl: typeof user.data.photoUrl === 'string' ? user.data.photoUrl : '',
      inviteeUids: req.body?.inviteeUids,
    })
    const invites = await listInvitesForReservation(reservationId, user.uid)
    res.json({ created, invites: invites ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo invitar.'
    const isAuth = /autorizado|cliente|Perfil no encontrado/.test(message)
    res.status(isAuth ? 401 : 500).json({ error: isAuth ? message : 'No se pudo enviar la invitación.' })
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

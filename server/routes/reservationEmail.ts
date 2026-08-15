import { Router, type Request, type Response } from 'express'
import { upsertCompanyClientFromReservation } from '../clients/upsertCompanyClient.ts'
import {
  processReservationConfirmationEmail,
  processReservationReceivedEmail,
} from '../email/processReservationEmail.ts'
import { adminDb } from '../firebase-admin.ts'
import {
  notifyReservationCancelled,
  notifyReservationConfirmed,
  notifyReservationReceived,
} from '../notifications/reservationEvents.ts'
import { canManageReservationNotifications } from '../notifications/reservationAccess.ts'

const router = Router()

async function syncClientForReservation(reservationId: string, data: FirebaseFirestore.DocumentData) {
  try {
    await upsertCompanyClientFromReservation(adminDb, reservationId, data)
  } catch (error) {
    console.error(`Failed to sync client for reservation ${reservationId}:`, error)
  }
}

router.post('/:reservationId/sync-client', async (req: Request, res: Response) => {
  try {
    const { reservationId } = req.params
    const reservationSnap = await adminDb.collection('reservations').doc(reservationId).get()

    if (!reservationSnap.exists) {
      res.status(404).json({ error: 'Reserva no encontrada.' })
      return
    }

    const reservationData = reservationSnap.data()!
    const allowed = await canManageReservationNotifications(req, reservationData)
    if (!allowed) {
      res.status(403).json({ error: 'No autorizado.' })
      return
    }

    const synced = await upsertCompanyClientFromReservation(
      adminDb,
      reservationId,
      reservationSnap.data()!,
    )

    res.json({
      synced,
      message: synced ? 'Cliente sincronizado.' : 'No era necesario sincronizar el cliente.',
    })
  } catch (error) {
    console.error('Reservation client sync error:', error)
    res.status(500).json({ error: 'No se pudo sincronizar el cliente.' })
  }
})

router.post('/:reservationId/notify-received', async (req: Request, res: Response) => {
  try {
    const { reservationId } = req.params
    const reservationSnap = await adminDb.collection('reservations').doc(reservationId).get()

    if (!reservationSnap.exists) {
      res.status(404).json({ error: 'Reserva no encontrada.' })
      return
    }

    const reservationData = reservationSnap.data()!
    const allowed = await canManageReservationNotifications(req, reservationData)
    if (!allowed) {
      res.status(403).json({ error: 'No autorizado.' })
      return
    }

    await syncClientForReservation(reservationId, reservationData)

    const sent = await processReservationReceivedEmail(
      reservationId,
      reservationData,
    )

    try {
      await notifyReservationReceived(reservationId, reservationData)
    } catch (notificationError) {
      console.error('Reservation received notification error:', notificationError)
    }

    res.json({
      sent,
      message: sent ? 'Correo de reserva recibida enviado.' : 'No era necesario enviar correo.',
    })
  } catch (error) {
    console.error('Reservation received email error:', error)
    res.status(500).json({ error: 'No se pudo enviar el correo de reserva recibida.' })
  }
})

router.post('/:reservationId/notify-confirmation', async (req: Request, res: Response) => {
  try {
    const { reservationId } = req.params
    const reservationSnap = await adminDb.collection('reservations').doc(reservationId).get()

    if (!reservationSnap.exists) {
      res.status(404).json({ error: 'Reserva no encontrada.' })
      return
    }

    const reservationData = reservationSnap.data()!

    const allowed = await canManageReservationNotifications(req, reservationData)
    if (!allowed) {
      res.status(403).json({ error: 'No autorizado.' })
      return
    }

    const sent = await processReservationConfirmationEmail(
      reservationId,
      reservationData,
    )

    try {
      await notifyReservationConfirmed(reservationId, reservationData)
    } catch (notificationError) {
      console.error('Reservation confirmation notification error:', notificationError)
    }

    res.json({
      sent,
      message: sent ? 'Correo enviado.' : 'No era necesario enviar correo.',
    })
  } catch (error) {
    console.error('Reservation notify email error:', error)
    res.status(500).json({ error: 'No se pudo enviar el correo de confirmación.' })
  }
})

router.post('/:reservationId/notify-cancelled', async (req: Request, res: Response) => {
  try {
    const { reservationId } = req.params
    const reservationSnap = await adminDb.collection('reservations').doc(reservationId).get()

    if (!reservationSnap.exists) {
      res.status(404).json({ error: 'Reserva no encontrada.' })
      return
    }

    const cancelledBy = req.body?.cancelledBy === 'restaurant' ? 'restaurant' : 'client'
    const reservationData = reservationSnap.data()!

    const allowed = await canManageReservationNotifications(req, reservationData)
    if (!allowed) {
      res.status(403).json({ error: 'No autorizado.' })
      return
    }

    try {
      await notifyReservationCancelled(reservationId, reservationData, cancelledBy)
    } catch (notificationError) {
      console.error('Reservation cancel notification error:', notificationError)
    }

    res.json({ ok: true })
  } catch (error) {
    console.error('Reservation notify cancelled error:', error)
    res.status(500).json({ error: 'No se pudo enviar la notificación de cancelación.' })
  }
})

export default router

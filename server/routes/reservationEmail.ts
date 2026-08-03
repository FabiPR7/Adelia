import { Router, type Request, type Response } from 'express'
import { upsertCompanyClientFromReservation } from '../clients/upsertCompanyClient.ts'
import {
  processReservationConfirmationEmail,
  processReservationReceivedEmail,
} from '../email/processReservationEmail.ts'
import { adminDb } from '../firebase-admin.ts'

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
    await syncClientForReservation(reservationId, reservationData)

    const sent = await processReservationReceivedEmail(
      reservationId,
      reservationData,
    )

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

    const sent = await processReservationConfirmationEmail(
      reservationId,
      reservationSnap.data()!,
    )

    res.json({
      sent,
      message: sent ? 'Correo enviado.' : 'No era necesario enviar correo.',
    })
  } catch (error) {
    console.error('Reservation notify email error:', error)
    res.status(500).json({ error: 'No se pudo enviar el correo de confirmación.' })
  }
})

export default router

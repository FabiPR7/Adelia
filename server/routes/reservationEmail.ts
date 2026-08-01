import { Router, type Request, type Response } from 'express'
import { processReservationConfirmationEmail } from '../email/processReservationEmail.ts'
import { adminDb } from '../firebase-admin.ts'

const router = Router()

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

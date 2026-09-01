import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { adminDb } from '../firebase-admin.ts'
import {
  assertReservationSlotValid,
  assertReservationStartInFuture,
  combineDateAndTime,
  parseBookingDate,
} from '../reservationSlots.ts'
import { defaultSchedule, companyAcceptsReservations } from '../utils.ts'
import { ensureCompanyOwner } from '../auth/verifyRequest.ts'
import { createReservationWithOccupiedSlot, SlotUnavailableError } from '../reservations/bookReservation.ts'

const router = Router()

router.post('/:companyId/reservations', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params

    if (!(await ensureCompanyOwner(req, res, companyId))) {
      return
    }

    const {
      date: dateParam,
      time,
      tableId,
      clientName,
      clientEmail = '',
      clientPhone = '',
      pax,
      status = 'completed',
      notes = '',
    } = req.body as Record<string, unknown>

    if (typeof clientName !== 'string' || !clientName.trim()) {
      res.status(400).json({ error: 'Indica el nombre del cliente.' })
      return
    }

    if (typeof tableId !== 'string' || !tableId) {
      res.status(400).json({ error: 'Selecciona una mesa.' })
      return
    }

    if (typeof time !== 'string' || !time) {
      res.status(400).json({ error: 'Selecciona una hora.' })
      return
    }

    const guestCount = Math.trunc(Number(pax))

    if (!Number.isFinite(guestCount) || guestCount < 1 || guestCount > 500) {
      res.status(400).json({ error: 'Indica el número de invitados.' })
      return
    }

    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateParam ?? '').trim())

    if (!dateMatch) {
      res.status(400).json({ error: 'Fecha inválida.' })
      return
    }

    const date = parseBookingDate(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`)

    const companySnap = await adminDb.collection('companies').doc(companyId).get()

    if (!companySnap.exists) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }

    const companyData = companySnap.data()!
    const schedule = companyData.schedule ?? defaultSchedule()
    const timeSlotMinutes = (companyData.timeSlotMinutes as number) ?? 120

    if (!companyAcceptsReservations(companyData.reservationMode)) {
      res.status(409).json({ error: 'Este restaurante no admite reservas. Cambia el modo en Reservas y horario.' })
      return
    }

    const tableSnap = await adminDb.collection('tables').doc(tableId).get()

    if (!tableSnap.exists || tableSnap.data()?.companyId !== companyId) {
      res.status(400).json({ error: 'Mesa no válida.' })
      return
    }

    try {
      assertReservationStartInFuture(date, time)
      assertReservationSlotValid(
        tableId,
        time,
        date,
        schedule,
        timeSlotMinutes,
        timeSlotMinutes,
        [],
      )
    } catch (validationError) {
      res.status(409).json({
        error:
          validationError instanceof Error
            ? validationError.message
            : 'Horario no disponible.',
      })
      return
    }

    const startTime = combineDateAndTime(date, time)
    const endTime = new Date(startTime.getTime() + timeSlotMinutes * 60000)

    const reservationStatus = status === 'cancelled' ? 'cancelled' : 'completed'
    const email = typeof clientEmail === 'string' ? clientEmail.trim().toLowerCase() : ''
    const phone = typeof clientPhone === 'string' ? clientPhone.trim() : ''

    const stripTags = (input: string) => input.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim()

    const reservationData = {
      companyId,
      tableId,
      clientName: stripTags(clientName).slice(0, 120),
      clientEmail: email,
      clientPhone: phone,
      pax: guestCount,
      notes: stripTags(typeof notes === 'string' ? notes : '').slice(0, 500),
      startTime: Timestamp.fromDate(startTime),
      endTime: Timestamp.fromDate(endTime),
      status: reservationStatus,
      cancelToken: randomUUID(),
      schemaVersion: 1,
      createdAt: Timestamp.now(),
    }

    const reservationRef = adminDb.collection('reservations').doc()
    try {
      await createReservationWithOccupiedSlot({
        reservationRef,
        reservationData,
        companyId,
        tableId,
        startTime,
        endTime,
      })
    } catch (slotError) {
      if (slotError instanceof SlotUnavailableError) {
        res.status(409).json({ error: slotError.message })
        return
      }
      throw slotError
    }

    res.status(201).json({
      id: reservationRef.id,
      message: 'Reserva creada.',
    })
  } catch (error) {
    console.error('Company reservation create error:', error)
    res.status(500).json({ error: 'No se pudo crear la reserva.' })
  }
})

export default router

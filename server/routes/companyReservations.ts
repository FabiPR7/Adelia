import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { processReservationReceivedEmail } from '../email/processReservationEmail.ts'
import { upsertCompanyClientFromReservation } from '../clients/upsertCompanyClient.ts'
import { adminAuth, adminDb } from '../firebase-admin.ts'
import { notifyReservationReceived } from '../notifications/reservationEvents.ts'
import {
  assertReservationSlotValid,
  isSameDay,
  assertReservationStartInFuture,
} from '../reservationSlots.ts'
import { defaultSchedule } from '../utils.ts'

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

router.post('/:companyId/reservations', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params

    if (!(await verifyCompanyOwner(req, res, companyId))) {
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

    const guestCount = Number(pax)

    if (!Number.isFinite(guestCount) || guestCount < 1) {
      res.status(400).json({ error: 'Indica el número de invitados.' })
      return
    }

    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateParam ?? '').trim())

    if (!dateMatch) {
      res.status(400).json({ error: 'Fecha inválida.' })
      return
    }

    const date = new Date(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3]),
    )

    const companySnap = await adminDb.collection('companies').doc(companyId).get()

    if (!companySnap.exists) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }

    const companyData = companySnap.data()!
    const schedule = companyData.schedule ?? defaultSchedule()
    const timeSlotMinutes = (companyData.timeSlotMinutes as number) ?? 120

    const tableSnap = await adminDb.collection('tables').doc(tableId).get()

    if (!tableSnap.exists || tableSnap.data()?.companyId !== companyId) {
      res.status(400).json({ error: 'Mesa no válida.' })
      return
    }

    const reservationsSnapshot = await adminDb
      .collection('reservations')
      .where('companyId', '==', companyId)
      .get()

    const dayReservations = reservationsSnapshot.docs
      .map((item) => {
        const data = item.data()
        const start = data.startTime?.toDate?.() as Date | undefined
        const end = data.endTime?.toDate?.() as Date | undefined

        if (!start || !end) {
          return null
        }

        return {
          id: item.id,
          tableId: data.tableId as string,
          startTime: start,
          endTime: end,
          status: data.status as string,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => isSameDay(item.startTime, date))

    try {
      assertReservationStartInFuture(date, time)
      assertReservationSlotValid(
        tableId,
        time,
        date,
        schedule,
        timeSlotMinutes,
        timeSlotMinutes,
        dayReservations,
        undefined,
        status === 'cancelled' ? 'cancelled' : 'completed',
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

    const [hours, minutes] = time.split(':').map(Number)
    const startTime = new Date(date)
    startTime.setHours(hours, minutes, 0, 0)
    const endTime = new Date(startTime.getTime() + timeSlotMinutes * 60000)

    const reservationStatus = status === 'cancelled' ? 'cancelled' : 'completed'
    const email = typeof clientEmail === 'string' ? clientEmail.trim().toLowerCase() : ''
    const phone = typeof clientPhone === 'string' ? clientPhone.trim() : ''

    const reservationData = {
      companyId,
      tableId,
      clientName: clientName.trim(),
      clientEmail: email,
      clientPhone: phone,
      pax: guestCount,
      notes: typeof notes === 'string' ? notes.trim() : '',
      startTime: Timestamp.fromDate(startTime),
      endTime: Timestamp.fromDate(endTime),
      status: reservationStatus,
      cancelToken: randomUUID(),
      createdAt: Timestamp.now(),
    }

    const reservationRef = await adminDb.collection('reservations').add(reservationData)

    try {
      await upsertCompanyClientFromReservation(adminDb, reservationRef.id, reservationData)
    } catch (clientError) {
      console.error('Company reservation client sync error:', clientError)
    }

    if (email && reservationStatus !== 'cancelled') {
      try {
        await processReservationReceivedEmail(reservationRef.id, reservationData)
      } catch (emailError) {
        console.error('Company reservation received email error:', emailError)
      }

      try {
        await notifyReservationReceived(reservationRef.id, reservationData)
      } catch (notificationError) {
        console.error('Company reservation received notification error:', notificationError)
      }
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

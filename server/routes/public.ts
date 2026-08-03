import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { processReservationReceivedEmail } from '../email/processReservationEmail.ts'
import { upsertCompanyClientFromReservation } from '../clients/upsertCompanyClient.ts'
import { isValidClientEmail } from '../email/config.ts'
import { adminDb } from '../firebase-admin.ts'
import {
  assertReservationSlotValid,
  isSameDay,
  parseBookingDate,
  assertReservationStartInFuture,
} from '../reservationSlots.ts'
import { defaultSchedule } from '../utils.ts'

const router = Router()

function mapPublicCompany(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    name: data.name as string,
    slug: data.slug as string,
    phone: (data.phone as string) ?? '',
    contactEmail: (data.contactEmail as string) ?? '',
    location: (data.location as string) ?? '',
    timeSlotMinutes: (data.timeSlotMinutes as number) ?? 120,
    schedule: data.schedule ?? defaultSchedule(),
    floorPlan: data.floorPlan ?? { enabled: false },
  }
}

async function getCompanyBySlug(slug: string) {
  const snapshot = await adminDb
    .collection('companies')
    .where('slug', '==', slug)
    .limit(1)
    .get()

  if (snapshot.empty) {
    return null
  }

  const docSnap = snapshot.docs[0]
  return mapPublicCompany(docSnap.id, docSnap.data())
}

router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const company = await getCompanyBySlug(req.params.slug)

    if (!company) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }

    const tablesSnapshot = await adminDb
      .collection('tables')
      .where('companyId', '==', company.id)
      .get()

    const tables = tablesSnapshot.docs
      .map((item) => ({
        id: item.id,
        name: item.data().name as string,
        capacity: (item.data().capacity as number) ?? 2,
        sortOrder: (item.data().sortOrder as number) ?? 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'))

    res.json({ company, tables })
  } catch (error) {
    console.error('Public booking load error:', error)
    res.status(500).json({ error: 'No se pudo cargar la información del restaurante.' })
  }
})

router.get('/:slug/availability', async (req: Request, res: Response) => {
  try {
    const company = await getCompanyBySlug(req.params.slug)

    if (!company) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }

    const dateParam = String(req.query.date ?? '')

    let date: Date

    try {
      date = parseBookingDate(dateParam)
    } catch {
      res.status(400).json({ error: 'Indica una fecha válida (YYYY-MM-DD).' })
      return
    }

    const reservationsSnapshot = await adminDb
      .collection('reservations')
      .where('companyId', '==', company.id)
      .get()

    const reservations = reservationsSnapshot.docs
      .map((item) => {
        const data = item.data()
        const startTime = data.startTime?.toDate?.() as Date | undefined
        const endTime = data.endTime?.toDate?.() as Date | undefined

        if (!startTime || !endTime) {
          return null
        }

        return {
          id: item.id,
          tableId: data.tableId as string,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          status: data.status as string,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => isSameDay(new Date(item.startTime), date))

    res.json({ date: dateParam, reservations })
  } catch (error) {
    console.error('Public availability error:', error)
    res.status(500).json({ error: 'No se pudo cargar la disponibilidad.' })
  }
})

router.post('/:slug/reservations', async (req: Request, res: Response) => {
  try {
    const company = await getCompanyBySlug(req.params.slug)

    if (!company) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
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
      notes = '',
    } = req.body as Record<string, unknown>

    if (typeof clientName !== 'string' || !clientName.trim()) {
      res.status(400).json({ error: 'Indica tu nombre.' })
      return
    }

    const email = typeof clientEmail === 'string' ? clientEmail.trim() : ''
    const phone = typeof clientPhone === 'string' ? clientPhone.trim() : ''

    if (!isValidClientEmail(email)) {
      res.status(400).json({ error: 'Indica un correo electrónico válido.' })
      return
    }

    if (!phone) {
      res.status(400).json({ error: 'Indica un teléfono de contacto.' })
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

    let date: Date

    try {
      date = parseBookingDate(String(dateParam ?? ''))
    } catch {
      res.status(400).json({ error: 'Fecha inválida.' })
      return
    }

    const tableSnap = await adminDb.collection('tables').doc(tableId).get()

    if (!tableSnap.exists || tableSnap.data()?.companyId !== company.id) {
      res.status(400).json({ error: 'Mesa no válida.' })
      return
    }

    const tableCapacity = (tableSnap.data()?.capacity as number) ?? 2

    if (guestCount > tableCapacity) {
      res.status(400).json({ error: `Esta mesa admite hasta ${tableCapacity} personas.` })
      return
    }

    const reservationsSnapshot = await adminDb
      .collection('reservations')
      .where('companyId', '==', company.id)
      .get()

    const dayReservations = reservationsSnapshot.docs
      .map((item) => {
        const data = item.data()
        const startTime = data.startTime?.toDate?.() as Date | undefined
        const endTime = data.endTime?.toDate?.() as Date | undefined

        if (!startTime || !endTime) {
          return null
        }

        return {
          id: item.id,
          tableId: data.tableId as string,
          startTime,
          endTime,
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
        company.schedule,
        company.timeSlotMinutes,
        company.timeSlotMinutes,
        dayReservations,
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
    const endTime = new Date(startTime.getTime() + company.timeSlotMinutes * 60000)

    const reservationData = {
      companyId: company.id,
      tableId,
      clientName: clientName.trim(),
      clientEmail: email,
      clientPhone: phone,
      pax: guestCount,
      notes: typeof notes === 'string' ? notes.trim() : '',
      startTime: Timestamp.fromDate(startTime),
      endTime: Timestamp.fromDate(endTime),
      status: 'completed',
      cancelToken: randomUUID(),
      createdAt: Timestamp.now(),
    }

    const reservationRef = await adminDb.collection('reservations').add(reservationData)

    try {
      await upsertCompanyClientFromReservation(adminDb, reservationRef.id, reservationData)
    } catch (clientError) {
      console.error('Public reservation client sync error:', clientError)
    }

    try {
      await processReservationReceivedEmail(reservationRef.id, reservationData)
    } catch (emailError) {
      console.error('Public reservation received email error:', emailError)
    }

    res.status(201).json({
      id: reservationRef.id,
      message: 'Hemos recibido tu reserva.',
    })
  } catch (error) {
    console.error('Public reservation error:', error)
    res.status(500).json({ error: 'No se pudo crear la reserva.' })
  }
})

router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''

    if (!token) {
      res.status(400).json({ error: 'Enlace de cancelación no válido.' })
      return
    }

    const snapshot = await adminDb
      .collection('reservations')
      .where('cancelToken', '==', token)
      .limit(1)
      .get()

    if (snapshot.empty) {
      res.status(404).json({ error: 'No encontramos ninguna reserva con este enlace.' })
      return
    }

    const reservationRef = snapshot.docs[0].ref
    const reservation = snapshot.docs[0].data()

    if (reservation.status === 'cancelled') {
      res.status(409).json({ error: 'Esta reserva ya estaba cancelada.' })
      return
    }

    await reservationRef.update({
      status: 'cancelled',
      updatedAt: Timestamp.now(),
    })

    res.json({ message: 'Tu reserva ha sido cancelada correctamente.' })
  } catch (error) {
    console.error('Public reservation cancel error:', error)
    res.status(500).json({ error: 'No se pudo cancelar la reserva.' })
  }
})

export default router

import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { ensureCompanyOwner } from '../auth/verifyRequest.ts'
import { isValidClientEmail } from '../email/config.ts'
import {
  assertReservationSlotValid,
  combineDateAndTime,
  parseBookingDate,
} from '../reservationSlots.ts'
import { defaultSchedule } from '../utils.ts'

// Cambios del panel del restaurante sobre sus reservas. Antes el panel escribía
// directamente en la base de datos; ahora pasa por aquí y el servidor comprueba
// que la reserva es de ese restaurante y que los datos son válidos.

const router = Router()

const PROMOTION_VISIT_STATUSES = new Set(['pending', 'eligible', 'not_eligible', 'n/a'])
const stripTags = (input: string) => input.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim()

type Params = Record<string, string>

/** Comprueba dueño + que la reserva es de ese local. Devuelve el documento o null (ya respondido). */
async function loadOwnedReservation(req: Request<Params>, res: Response) {
  const { companyId, reservationId } = req.params
  if (!(await ensureCompanyOwner(req, res, companyId))) return null
  if (!reservationId?.trim()) {
    res.status(400).json({ error: 'Reserva no válida.' })
    return null
  }
  const ref = adminDb.collection('reservations').doc(reservationId)
  const snap = await ref.get()
  if (!snap.exists || snap.data()?.companyId !== companyId) {
    res.status(404).json({ error: 'Reserva no encontrada.' })
    return null
  }
  return { ref, data: snap.data()!, companyId }
}

/** Pasar lista: asistió (confirmed) o no vino (cancelled = ausencia del cliente). */
router.patch('/:companyId/reservations/:reservationId/status', async (req: Request<Params>, res: Response) => {
  try {
    const owned = await loadOwnedReservation(req, res)
    if (!owned) return
    const { status, promotionVisitStatus } = req.body as Record<string, unknown>
    if (status !== 'confirmed' && status !== 'cancelled') {
      res.status(400).json({ error: 'Estado no válido.' })
      return
    }
    const update: Record<string, unknown> = { status }
    if (status === 'cancelled') {
      update.cancelledBy = 'restaurant'
      update.noShow = true
      update.cancelShieldRequested = true
    }
    if (promotionVisitStatus !== undefined) {
      if (typeof promotionVisitStatus !== 'string' || !PROMOTION_VISIT_STATUSES.has(promotionVisitStatus)) {
        res.status(400).json({ error: 'Estado de la promo no válido.' })
        return
      }
      update.promotionVisitStatus = promotionVisitStatus
    }
    update.updatedAt = Timestamp.now()
    update.updatedBy = 'restaurant'
    await owned.ref.update(update)
    res.json({ ok: true })
  } catch (error) {
    console.error('Company reservation status error:', error)
    res.status(500).json({ error: 'No se pudo cambiar el estado de la reserva.' })
  }
})

/** Estado de la promo de una reserva (válida, no válida…). */
router.patch('/:companyId/reservations/:reservationId/promotion-visit', async (req: Request<Params>, res: Response) => {
  try {
    const owned = await loadOwnedReservation(req, res)
    if (!owned) return
    const { promotionVisitStatus } = req.body as Record<string, unknown>
    if (typeof promotionVisitStatus !== 'string' || !PROMOTION_VISIT_STATUSES.has(promotionVisitStatus)) {
      res.status(400).json({ error: 'Estado de la promo no válido.' })
      return
    }
    await owned.ref.update({ promotionVisitStatus, updatedAt: Timestamp.now(), updatedBy: 'restaurant' })
    res.json({ ok: true })
  } catch (error) {
    console.error('Company reservation promo status error:', error)
    res.status(500).json({ error: 'No se pudo cambiar el estado de la promo.' })
  }
})

/** Cancelar desde el restaurante (no es culpa del cliente: noShow = false). */
router.post('/:companyId/reservations/:reservationId/cancel', async (req: Request<Params>, res: Response) => {
  try {
    const owned = await loadOwnedReservation(req, res)
    if (!owned) return
    if (owned.data.status === 'cancelled') {
      res.status(409).json({ error: 'Esta reserva ya estaba cancelada.' })
      return
    }
    await owned.ref.update({
      status: 'cancelled',
      cancelledBy: 'restaurant',
      noShow: false,
      updatedAt: Timestamp.now(),
      updatedBy: 'restaurant',
    })
    res.json({ ok: true })
  } catch (error) {
    console.error('Company reservation cancel error:', error)
    res.status(500).json({ error: 'No se pudo cancelar la reserva.' })
  }
})

/** Editar una reserva (mesa, hora, cliente, personas, estado). */
router.put('/:companyId/reservations/:reservationId', async (req: Request<Params>, res: Response) => {
  try {
    const owned = await loadOwnedReservation(req, res)
    if (!owned) return
    const { companyId } = owned
    const body = req.body as Record<string, unknown>
    const tableId = typeof body.tableId === 'string' ? body.tableId : ''
    const time = typeof body.time === 'string' ? body.time : ''
    const clientName = typeof body.clientName === 'string' ? stripTags(body.clientName).slice(0, 120) : ''
    const clientEmail = typeof body.clientEmail === 'string' ? body.clientEmail.trim().toLowerCase().slice(0, 120) : ''
    const clientPhone = typeof body.clientPhone === 'string' ? body.clientPhone.trim().slice(0, 30) : ''
    const pax = Math.trunc(Number(body.pax))
    const status = body.status === 'cancelled' || body.status === 'confirmed' ? body.status : 'completed'
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(body.date ?? '').trim())

    if (!clientName) {
      res.status(400).json({ error: 'Indica el nombre del cliente.' })
      return
    }
    if (!tableId || !time || !dateMatch) {
      res.status(400).json({ error: 'Indica mesa, día y hora.' })
      return
    }
    if (!Number.isFinite(pax) || pax < 1 || pax > 500) {
      res.status(400).json({ error: 'Indica el número de invitados.' })
      return
    }
    if (clientEmail && !isValidClientEmail(clientEmail)) {
      res.status(400).json({ error: 'El correo del cliente no es válido.' })
      return
    }

    const tableSnap = await adminDb.collection('tables').doc(tableId).get()
    if (!tableSnap.exists || tableSnap.data()?.companyId !== companyId) {
      res.status(400).json({ error: 'Mesa no válida.' })
      return
    }

    const companySnap = await adminDb.collection('companies').doc(companyId).get()
    const companyData = companySnap.data() ?? {}
    const schedule = companyData.schedule ?? defaultSchedule()
    const durationMinutes = (companyData.timeSlotMinutes as number) ?? 120
    const date = parseBookingDate(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`)
    const startTime = combineDateAndTime(date, time)
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000)

    const previousStart = (owned.data.startTime as Timestamp | undefined)?.toDate?.()
    const slotChanged =
      tableId !== owned.data.tableId || !previousStart || previousStart.getTime() !== startTime.getTime()

    // Solo se revisa el hueco si cambia mesa o hora y la reserva sigue viva (igual que el panel).
    if (slotChanged && status !== 'cancelled') {
      const dayStart = new Date(startTime)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart.getTime() + 36 * 60 * 60 * 1000)
      const daySnap = await adminDb
        .collection('reservations')
        .where('companyId', '==', companyId)
        .where('startTime', '>=', Timestamp.fromDate(new Date(dayStart.getTime() - 12 * 60 * 60 * 1000)))
        .where('startTime', '<', Timestamp.fromDate(dayEnd))
        .get()
      const others = daySnap.docs
        .filter((item) => item.id !== owned.ref.id)
        .map((item) => {
          const data = item.data()
          return {
            id: item.id,
            tableId: String(data.tableId ?? ''),
            startTime: (data.startTime as Timestamp).toDate(),
            endTime: (data.endTime as Timestamp).toDate(),
            status: String(data.status ?? ''),
          }
        })
      try {
        assertReservationSlotValid(tableId, time, date, schedule, durationMinutes, durationMinutes, others)
      } catch (validationError) {
        res.status(409).json({
          error: validationError instanceof Error ? validationError.message : 'Horario no disponible.',
        })
        return
      }
    }

    await owned.ref.update({
      tableId,
      clientName,
      clientEmail,
      clientPhone,
      pax,
      startTime: Timestamp.fromDate(startTime),
      endTime: Timestamp.fromDate(endTime),
      status,
      updatedAt: Timestamp.now(),
      updatedBy: 'restaurant',
    })
    res.json({ ok: true, startTime: startTime.toISOString(), endTime: endTime.toISOString() })
  } catch (error) {
    console.error('Company reservation update error:', error)
    res.status(500).json({ error: 'No se pudo guardar la reserva.' })
  }
})

/** Borrar una reserva del panel. */
router.delete('/:companyId/reservations/:reservationId', async (req: Request<Params>, res: Response) => {
  try {
    const owned = await loadOwnedReservation(req, res)
    if (!owned) return
    await owned.ref.delete()
    res.json({ ok: true })
  } catch (error) {
    console.error('Company reservation delete error:', error)
    res.status(500).json({ error: 'No se pudo borrar la reserva.' })
  }
})

export default router

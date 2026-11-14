import { Router, type Request, type Response } from 'express'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import { adminDb } from '../firebase-admin.ts'
import { takeRestaurantReport } from '../security/rateLimit.ts'
import { sendSupportInboxEmail } from '../email/supportInbox.ts'

/**
 * Reportes de clientes sobre un restaurante (no dio la promoción, problema con
 * la reserva…). Solo los lee el administrador desde su panel.
 */
export const RESTAURANT_REPORTS = 'restaurantReports'

export const REPORT_REASONS = {
  promo_not_honored: 'No me dio la promoción',
  reservation_issue: 'Problema con la reserva',
  charge_issue: 'Cobro o fianza incorrectos',
  wrong_info: 'Información falsa o desactualizada',
  bad_treatment: 'Trato inadecuado',
  other: 'Otro motivo',
} as const

export type ReportReason = keyof typeof REPORT_REASONS

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/
const DUPLICATE_WINDOW_MS = 7 * 24 * 60 * 60_000

function cleanMessage(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 1500)
    : ''
}

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const companyId = String(req.body?.companyId ?? '').trim()
    const reason = String(req.body?.reason ?? '') as ReportReason
    const message = cleanMessage(req.body?.message)
    const reservationId = String(req.body?.reservationId ?? '').trim()
    const promotionId = String(req.body?.promotionId ?? '').trim()

    if (!ID_RE.test(companyId)) {
      res.status(400).json({ error: 'Restaurante no válido.' })
      return
    }
    if (!(reason in REPORT_REASONS)) {
      res.status(400).json({ error: 'Elige un motivo.' })
      return
    }
    if (message.length < 15) {
      res.status(400).json({ error: 'Cuéntanos qué pasó (al menos 15 caracteres).' })
      return
    }
    if ((reservationId && !ID_RE.test(reservationId)) || (promotionId && !ID_RE.test(promotionId))) {
      res.status(400).json({ error: 'Datos del reporte no válidos.' })
      return
    }

    const companySnap = await adminDb.collection('companies').doc(companyId).get()
    if (!companySnap.exists) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }

    // Si el reporte cita una reserva, tiene que ser del cliente y de ese local.
    let reservationStart: Timestamp | null = null
    let linkedPromotionId = promotionId
    if (reservationId) {
      const reservation = (await adminDb.collection('reservations').doc(reservationId).get()).data()
      const ownReservation = reservation
        && reservation.companyId === companyId
        && (reservation.customerUid === customer.uid
          || (customer.emailVerified && String(reservation.clientEmail ?? '').trim().toLowerCase() === customer.email))
      if (!ownReservation) {
        res.status(403).json({ error: 'Esa reserva no es tuya o no es de este restaurante.' })
        return
      }
      reservationStart = reservation.startTime instanceof Timestamp ? reservation.startTime : null
      linkedPromotionId = linkedPromotionId || String(reservation.promotionId ?? '')
    }

    let promotionTitle = ''
    if (linkedPromotionId && ID_RE.test(linkedPromotionId)) {
      const promoSnap = await adminDb.collection('companies').doc(companyId).collection('promotions').doc(linkedPromotionId).get()
      promotionTitle = promoSnap.exists ? String(promoSnap.data()?.title ?? '').slice(0, 160) : ''
      if (!promoSnap.exists) linkedPromotionId = ''
    }

    // Mismo cliente, mismo local y mismo motivo en la última semana: no se duplica.
    const recent = await adminDb.collection(RESTAURANT_REPORTS)
      .where('customerUid', '==', customer.uid)
      .where('companyId', '==', companyId)
      .limit(20)
      .get()
    const duplicate = recent.docs.some((doc) => {
      const data = doc.data()
      const created = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : 0
      return data.reason === reason
        && (data.status === 'open' || data.status === 'reviewing')
        && Date.now() - created < DUPLICATE_WINDOW_MS
    })
    if (duplicate) {
      res.status(409).json({ error: 'Ya nos enviaste este reporte sobre este restaurante. Lo estamos revisando.' })
      return
    }

    if (!(await takeRestaurantReport(customer.uid))) {
      res.status(429).json({ error: 'Has enviado muchos reportes hoy. Inténtalo mañana.' })
      return
    }

    const company = companySnap.data() ?? {}
    const ref = await adminDb.collection(RESTAURANT_REPORTS).add({
      companyId,
      companyName: String(company.name ?? ''),
      companySlug: String(company.slug ?? ''),
      customerUid: customer.uid,
      customerName: String(customer.data.displayName ?? '').slice(0, 80),
      customerEmail: customer.email,
      reason,
      reasonLabel: REPORT_REASONS[reason],
      message,
      reservationId: reservationId || null,
      reservationStart,
      promotionId: linkedPromotionId || null,
      promotionTitle: promotionTitle || null,
      status: 'open',
      adminNote: '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    // Aviso a soporte. Si el correo falla, el reporte sigue guardado y sale en el panel.
    const companyName = String(company.name ?? '')
    await sendSupportInboxEmail({
      subject: `Reporte · ${companyName || 'restaurante'} · ${REPORT_REASONS[reason]}`,
      heading: `Nuevo reporte sobre ${companyName || 'un restaurante'}`,
      fields: [
        ['Motivo', REPORT_REASONS[reason]],
        ['Restaurante', `${companyName} (${String(company.slug ?? companyId)})`],
        ['Cliente', `${String(customer.data.displayName ?? '').slice(0, 80)} · ${customer.email}`],
        ['Reserva', reservationStart ? reservationStart.toDate().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : ''],
        ['Promoción', promotionTitle],
      ],
      message,
      replyTo: customer.email,
    }).catch((error) => console.error('report email error:', error))

    res.status(201).json({ ok: true, id: ref.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo enviar el reporte.'
    const isAuth = /autorizado|cliente|Perfil no encontrado/.test(message)
    res.status(isAuth ? 401 : 500).json({ error: isAuth ? message : 'No se pudo enviar el reporte.' })
  }
})

export default router

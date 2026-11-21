import { Router, type Request, type Response } from 'express'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import { adminDb } from '../firebase-admin.ts'
import { takeContentReport, takeRestaurantReport } from '../security/rateLimit.ts'
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

/** Motivos para reportar una reseña o a un usuario (contenido de otros clientes). */
export const CONTENT_REPORT_REASONS = {
  offensive: 'Ofensivo, odio o insultos',
  harassment: 'Acoso o amenazas',
  sexual: 'Contenido sexual o foto inapropiada',
  spam: 'Spam o publicidad',
  fake: 'Falso o engañoso',
  impersonation: 'Se hace pasar por otra persona',
  other: 'Otro motivo',
} as const

export type ContentReportReason = keyof typeof CONTENT_REPORT_REASONS

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

/**
 * Reportar una reseña o a un usuario. Lo revisa el administrador (Reportes) y puede
 * borrar la reseña o bloquear la cuenta. Apple y Google lo exigen en apps donde los
 * usuarios publican contenido.
 */
router.post('/content', async (req: Request, res: Response) => {
  try {
    const customer = await verifyCustomerUid(req)
    const targetType = req.body?.targetType === 'user' ? 'user' : req.body?.targetType === 'review' ? 'review' : ''
    const reason = String(req.body?.reason ?? '') as ContentReportReason
    const message = cleanMessage(req.body?.message)
    if (!targetType) {
      res.status(400).json({ error: 'Reporte no válido.' })
      return
    }
    if (!(reason in CONTENT_REPORT_REASONS)) {
      res.status(400).json({ error: 'Elige un motivo.' })
      return
    }

    let targetUid = ''
    let targetName = ''
    let companyId = ''
    let companyName = ''
    let companySlug = ''
    let reviewId = ''
    let contentExcerpt = ''

    if (targetType === 'review') {
      companySlug = String(req.body?.companySlug ?? '').trim().toLowerCase()
      reviewId = String(req.body?.reviewId ?? '').trim()
      if (!/^[a-z0-9-]{1,120}$/.test(companySlug) || !ID_RE.test(reviewId)) {
        res.status(400).json({ error: 'Reseña no válida.' })
        return
      }
      const companySnap = await adminDb.collection('companies').where('slug', '==', companySlug).limit(1).get()
      const companyDoc = companySnap.docs[0]
      const reviewSnap = companyDoc
        ? await companyDoc.ref.collection('reviews').doc(reviewId).get()
        : null
      if (!companyDoc || !reviewSnap?.exists) {
        res.status(404).json({ error: 'La reseña ya no existe.' })
        return
      }
      const review = reviewSnap.data() ?? {}
      companyId = companyDoc.id
      companyName = String(companyDoc.data().name ?? '')
      targetUid = String(review.customerUid ?? reviewId)
      targetName = String(review.customerName ?? '').slice(0, 80)
      contentExcerpt = String(review.comment ?? '').replace(/<[^>]*>/g, '').slice(0, 400)
    } else {
      targetUid = String(req.body?.targetUid ?? '').trim()
      if (!ID_RE.test(targetUid) || targetUid === customer.uid) {
        res.status(400).json({ error: 'Usuario no válido.' })
        return
      }
      const targetSnap = await adminDb.collection('users').doc(targetUid).get()
      if (!targetSnap.exists || targetSnap.data()?.role !== 'customer') {
        res.status(404).json({ error: 'Usuario no encontrado.' })
        return
      }
      const target = targetSnap.data() ?? {}
      targetName = String(target.displayName ?? '').slice(0, 80)
      contentExcerpt = [target.username ? `@${String(target.username)}` : '', String(target.bio ?? '')]
        .filter(Boolean).join(' · ').slice(0, 400)
    }

    // El mismo cliente no reporta lo mismo dos veces mientras está abierto.
    const recent = await adminDb.collection(RESTAURANT_REPORTS)
      .where('customerUid', '==', customer.uid)
      .where('targetUid', '==', targetUid)
      .limit(20)
      .get()
    const duplicate = recent.docs.some((doc) => {
      const data = doc.data()
      return data.targetType === targetType
        && (targetType === 'user' || data.reviewId === reviewId)
        && (data.status === 'open' || data.status === 'reviewing')
    })
    if (duplicate) {
      res.status(409).json({ error: 'Ya nos lo reportaste. Lo estamos revisando.' })
      return
    }
    if (!(await takeContentReport(customer.uid))) {
      res.status(429).json({ error: 'Has enviado muchos reportes hoy. Inténtalo mañana.' })
      return
    }

    const label = CONTENT_REPORT_REASONS[reason]
    const ref = await adminDb.collection(RESTAURANT_REPORTS).add({
      targetType,
      targetUid,
      targetName,
      reviewId: reviewId || null,
      contentExcerpt,
      companyId,
      companyName,
      companySlug,
      customerUid: customer.uid,
      customerName: String(customer.data.displayName ?? '').slice(0, 80),
      customerEmail: customer.email,
      reason,
      reasonLabel: label,
      message,
      reservationId: null,
      reservationStart: null,
      promotionId: null,
      promotionTitle: null,
      status: 'open',
      adminNote: '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    const what = targetType === 'review' ? `reseña de ${targetName || 'un cliente'} en ${companyName}` : `usuario ${targetName || targetUid}`
    await sendSupportInboxEmail({
      subject: `Reporte · ${what} · ${label}`,
      heading: `Nuevo reporte: ${what}`,
      fields: [
        ['Motivo', label],
        ['Qué', targetType === 'review' ? 'Reseña' : 'Usuario'],
        ['Autor / usuario', `${targetName} (${targetUid})`],
        ['Contenido', contentExcerpt],
        ['Quién reporta', `${String(customer.data.displayName ?? '').slice(0, 80)} · ${customer.email}`],
      ],
      message,
      replyTo: customer.email,
    }).catch((error) => console.error('content report email error:', error))

    res.status(201).json({ ok: true, id: ref.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo enviar el reporte.'
    const isAuth = /autorizado|cliente|Perfil no encontrado/.test(message)
    res.status(isAuth ? 401 : 500).json({ error: isAuth ? message : 'No se pudo enviar el reporte.' })
  }
})

export default router

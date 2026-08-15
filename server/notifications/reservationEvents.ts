import type { DocumentData } from 'firebase-admin/firestore'
import {
  cancelNotificationJobsForReservation,
  createCustomerNotification,
  resolveCompanySummary,
  resolveCustomerUidForReservation,
  resolvePromotionTitle,
  scheduleNotificationJob,
} from './service.ts'

function reservationStartDate(data: DocumentData): Date {
  const startTime = data.startTime
  if (startTime && typeof startTime.toDate === 'function') {
    return startTime.toDate()
  }

  return new Date()
}

export async function notifyReservationReceived(
  reservationId: string,
  reservation: DocumentData,
): Promise<void> {
  const userId = await resolveCustomerUidForReservation(reservation as Record<string, unknown>)
  if (!userId) {
    return
  }

  const companyId = typeof reservation.companyId === 'string' ? reservation.companyId : ''
  const { companyName, companySlug } = companyId
    ? await resolveCompanySummary(companyId)
    : { companyName: 'Restaurante', companySlug: '' }

  const startTime = reservationStartDate(reservation)

  await createCustomerNotification(userId, {
    type: 'reservation_received',
    title: 'Reserva recibida',
    body: `${companyName} ha recibido tu solicitud para el ${formatDateTime(startTime)}.`,
    icon: '📩',
    actionUrl: '/app/reservas',
    actionLabel: 'Ver reserva',
    dedupeKey: `reservation_received:${reservationId}`,
    data: {
      companyId,
      companyName,
      companySlug,
      reservationId,
    },
  })
}

export async function notifyReservationConfirmed(
  reservationId: string,
  reservation: DocumentData,
): Promise<void> {
  const userId = await resolveCustomerUidForReservation(reservation as Record<string, unknown>)
  if (!userId) {
    return
  }

  const companyId = typeof reservation.companyId === 'string' ? reservation.companyId : ''
  const { companyName, companySlug } = companyId
    ? await resolveCompanySummary(companyId)
    : { companyName: 'Restaurante', companySlug: '' }

  const startTime = reservationStartDate(reservation)

  await createCustomerNotification(userId, {
    type: 'reservation_confirmed',
    title: 'Reserva confirmada',
    body: `${companyName} ha confirmado tu asistencia para el ${formatDateTime(startTime)}.`,
    icon: '✅',
    actionUrl: '/app/reservas',
    actionLabel: 'Ver reserva',
    dedupeKey: `reservation_confirmed:${reservationId}`,
    data: {
      companyId,
      companyName,
      companySlug,
      reservationId,
    },
  })

  const reminderAt = new Date(startTime.getTime() - 60 * 60 * 1000)
  if (reminderAt.getTime() > Date.now()) {
    await scheduleNotificationJob({
      type: 'reservation_reminder_1h',
      userId,
      reservationId,
      scheduledAt: reminderAt,
      companyId,
      companyName,
      companySlug,
      reservationStartTime: startTime,
    })
  }

  const reviewPromptAt = new Date(Date.now() + 2 * 60 * 60 * 1000)
  await scheduleNotificationJob({
    type: 'reservation_review_prompt',
    userId,
    reservationId,
    scheduledAt: reviewPromptAt,
    companyId,
    companyName,
    companySlug,
    reservationStartTime: startTime,
  })

  const promotionId = typeof reservation.promotionId === 'string' ? reservation.promotionId : ''
  const minimumSpendCents = typeof reservation.minimumSpendCents === 'number'
    ? reservation.minimumSpendCents
    : 0

  if (promotionId && minimumSpendCents > 0) {
    const promotionTitle = await resolvePromotionTitle(companyId, promotionId)
    await createCustomerNotification(userId, {
      type: 'promotion_ready_to_verify',
      title: 'Verifica tu premio',
      body: `Tu visita en ${companyName} cuenta para «${promotionTitle}». Verifica tu consumo para reclamarlo.`,
      icon: '🎯',
      actionUrl: '/app/promociones',
      actionLabel: 'Verificar',
      dedupeKey: `promotion_ready_to_verify:${reservationId}`,
      data: {
        companyId,
        companyName,
        companySlug,
        reservationId,
        promotionId,
        promotionTitle,
      },
    })
  }
}

export async function notifyReservationCancelled(
  reservationId: string,
  reservation: DocumentData,
  cancelledBy: 'client' | 'restaurant',
): Promise<void> {
  await cancelNotificationJobsForReservation(reservationId)

  const userId = await resolveCustomerUidForReservation(reservation as Record<string, unknown>)
  if (!userId) {
    return
  }

  const companyId = typeof reservation.companyId === 'string' ? reservation.companyId : ''
  const { companyName, companySlug } = companyId
    ? await resolveCompanySummary(companyId)
    : { companyName: 'Restaurante', companySlug: '' }

  const startTime = reservationStartDate(reservation)
  const type = cancelledBy === 'client'
    ? 'reservation_cancelled_by_client'
    : 'reservation_cancelled_by_restaurant'

  const body = cancelledBy === 'client'
    ? `Has cancelado tu reserva en ${companyName} del ${formatDateTime(startTime)}.`
    : `${companyName} ha cancelado tu reserva del ${formatDateTime(startTime)}.`

  await createCustomerNotification(userId, {
    type,
    title: 'Reserva cancelada',
    body,
    icon: '❌',
    actionUrl: '/app/reservas',
    actionLabel: 'Ver reservas',
    dedupeKey: `${type}:${reservationId}`,
    data: {
      companyId,
      companyName,
      companySlug,
      reservationId,
      cancelledBy,
    },
  })
}

export async function notifyPromotionClaimed(
  userId: string,
  promotionId: string,
  companyId: string,
  promotionTitle: string,
  reservationId?: string,
): Promise<void> {
  const { companyName, companySlug } = await resolveCompanySummary(companyId)
  const dedupeSuffix = reservationId ?? `${promotionId}:${Date.now()}`

  await createCustomerNotification(userId, {
    type: 'promotion_claimed',
    title: '¡Premio conseguido!',
    body: `Has reclamado «${promotionTitle}» en ${companyName}.`,
    icon: '🎁',
    actionUrl: '/app/promociones',
    actionLabel: 'Ver reclamadas',
    dedupeKey: `promotion_claimed:${dedupeSuffix}`,
    data: {
      companyId,
      companyName,
      companySlug,
      promotionId,
      promotionTitle,
      reservationId,
    },
  })
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

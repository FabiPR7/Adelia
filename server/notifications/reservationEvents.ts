import { BUSINESS_TIME_ZONE } from '../utils/madridDateTime.ts'
import type { DocumentData } from 'firebase-admin/firestore'
import {
  cancelNotificationJobsForReservation,
  createCustomerNotification,
  resolveCompanySummary,
  resolveCustomerUidForReservation,
  resolvePromotionTitle,
  scheduleNotificationJob,
} from './service.ts'
import {
  applyReservationCancellationPenalty,
  type CancellationPenaltyResult,
} from '../gamification/cancellationPenalty.ts'
import { createCompanyNotification } from './companyNotifications.ts'

function reservationStartDate(data: DocumentData): Date {
  const startTime = data.startTime
  if (startTime && typeof startTime.toDate === 'function') {
    return startTime.toDate()
  }

  return new Date()
}

/** Aviso en la campana del restaurante (antes no se enteraba si no miraba el listado). */
async function notifyCompanyAboutReservation(
  reservationId: string,
  reservation: DocumentData,
  kind: 'new' | 'cancelled_by_client',
): Promise<void> {
  const companyId = typeof reservation.companyId === 'string' ? reservation.companyId : ''
  if (!companyId) return
  const startTime = reservationStartDate(reservation)
  const clientName = typeof reservation.clientName === 'string' && reservation.clientName.trim()
    ? reservation.clientName.trim().slice(0, 60)
    : 'Un cliente'
  const pax = typeof reservation.pax === 'number' ? reservation.pax : null
  const paxLabel = pax ? ` · ${pax} ${pax === 1 ? 'persona' : 'personas'}` : ''
  await createCompanyNotification(companyId, kind === 'new'
    ? {
        type: 'reservation_new',
        title: 'Nueva reserva',
        body: `${clientName} ha reservado para el ${formatDateTime(startTime)}${paxLabel}.`,
        icon: '📅',
        actionTab: 'reservations',
        actionLabel: 'Ver reservas',
        dedupeKey: `reservation_new:${reservationId}`,
        data: { reservationId },
      }
    : {
        type: 'reservation_cancelled_by_client',
        title: 'Reserva cancelada por el cliente',
        body: `${clientName} ha cancelado su reserva del ${formatDateTime(startTime)}${paxLabel}. La mesa vuelve a estar libre.`,
        icon: '↩️',
        actionTab: 'reservations',
        actionLabel: 'Ver reservas',
        dedupeKey: `reservation_cancelled_by_client:${reservationId}`,
        data: { reservationId },
      })
}

export async function notifyReservationReceived(
  reservationId: string,
  reservation: DocumentData,
): Promise<void> {
  await notifyCompanyAboutReservation(reservationId, reservation, 'new')
    .catch((error) => console.error('company new-reservation notification failed:', error))

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

  // El recordatorio se programa al reservar: antes solo se hacía al marcar la
  // asistencia, que llega después de la visita, y casi nunca salía.
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
): Promise<{ penalty: CancellationPenaltyResult | null }> {
  await cancelNotificationJobsForReservation(reservationId)

  if (cancelledBy === 'client') {
    await notifyCompanyAboutReservation(reservationId, reservation, 'cancelled_by_client')
      .catch((error) => console.error('company cancellation notification failed:', error))
  }

  let penalty: CancellationPenaltyResult | null = null
  try {
    penalty = await applyReservationCancellationPenalty(
      reservationId,
      reservation as Record<string, unknown>,
    )
  } catch (penaltyError) {
    console.error(`Cancellation XP penalty failed for reservation ${reservationId}:`, penaltyError)
  }

  const userId = await resolveCustomerUidForReservation(reservation as Record<string, unknown>)
  if (!userId) {
    return { penalty }
  }

  const companyId = typeof reservation.companyId === 'string' ? reservation.companyId : ''
  const { companyName, companySlug } = companyId
    ? await resolveCompanySummary(companyId)
    : { companyName: 'Restaurante', companySlug: '' }

  const startTime = reservationStartDate(reservation)
  const type = cancelledBy === 'client'
    ? 'reservation_cancelled_by_client'
    : 'reservation_cancelled_by_restaurant'

  const intro = cancelledBy === 'client'
    ? `Has cancelado tu reserva en ${companyName} del ${formatDateTime(startTime)}.`
    : reservation.noShow === true
      ? `${companyName} ha marcado que no acudiste a tu reserva del ${formatDateTime(startTime)}.`
      : `${companyName} ha cancelado tu reserva del ${formatDateTime(startTime)}.`

  let body = intro
  if (penalty?.shielded) {
    body += ' Tu Escudo de Mesa ha cubierto esta cancelación: no pierdes XP ni acumulas aviso.'
  } else if (penalty) {
    if (penalty.xpLost > 0) {
      body += ` Se te restan ${penalty.xpLost} XP (−${penalty.percent}%).`
    } else {
      body += ' Esta cancelación cuenta como aviso en tu historial.'
    }
    if (penalty.warning) {
      body += ` ${penalty.warning}`
    }
  }

  await createCustomerNotification(userId, {
    type,
    title: cancelledBy !== 'client' && reservation.noShow === true ? 'No acudiste a tu reserva' : 'Reserva cancelada',
    body: body.replace('ha cubierto esta cancelación', reservation.noShow === true ? 'ha cubierto esta falta' : 'ha cubierto esta cancelación'),
    icon: reservation.noShow === true ? '🚫' : '❌',
    actionUrl: '/app/reservas',
    actionLabel: 'Ver reservas',
    dedupeKey: `${type}:${reservationId}`,
    data: {
      companyId,
      companyName,
      companySlug,
      reservationId,
      cancelledBy,
      ...(penalty
        ? {
            xpLost: penalty.xpLost,
            xpAfter: penalty.xpAfter,
            strikeCount: penalty.strikeCount,
            percent: penalty.percent,
            nextPercent: penalty.nextPercent,
            promoLocked: penalty.promoLocked,
            justLocked: penalty.justLocked,
            warning: penalty.warning,
            shielded: penalty.shielded === true,
          }
        : {}),
    },
  })

  return { penalty }
}

export async function notifyPromotionClaimed(
  userId: string,
  promotionId: string,
  companyId: string,
  promotionTitle: string,
  reservationId?: string,
  claimId?: string,
): Promise<void> {
  const { companyName, companySlug } = await resolveCompanySummary(companyId)
  const dedupeSuffix = claimId ?? reservationId ?? `${userId}:${promotionId}`

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
    timeZone: BUSINESS_TIME_ZONE,
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

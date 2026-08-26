import type { PromotionVisitStatus, Reservation } from '../types'

export type PromotionVisitLabelTone = 'verified' | 'failed' | 'pending' | 'neutral'

export interface PromotionVisitPresentation {
  label: string
  tone: PromotionVisitLabelTone
}

export interface ReservationPromotionInfo {
  type: string
  title: string
}

export function reservationHasMinimumSpendRequirement(reservation: Reservation): boolean {
  return (
    typeof reservation.minimumSpendCents === 'number'
    && reservation.minimumSpendCents > 0
  )
}

/** Reservas confirmadas que suman progreso en ofertas por reserva o consumo. */
export function countsForPromotionProgress(reservation: Reservation): boolean {
  if (reservation.status !== 'confirmed') {
    return false
  }

  if (!reservationHasMinimumSpendRequirement(reservation)) {
    return true
  }

  return reservation.promotionVisitStatus === 'eligible'
}

/** Asistió confirmada pero falta validar si cumplió el gasto mínimo de la promo. */
export function reservationNeedsMinimumSpendReview(reservation: Reservation): boolean {
  if (reservation.status !== 'confirmed') {
    return false
  }

  if (reservation.minSpendVerification) {
    return false
  }

  if (!reservationHasMinimumSpendRequirement(reservation)) {
    return false
  }

  return (
    reservation.promotionVisitStatus === 'pending'
    || reservation.promotionVisitStatus === undefined
  )
}

export function formatReservationPrizeDateTime(startTime: Date): string {
  return startTime.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function isTimeLimitedPromotionReservation(
  reservation: Reservation,
  promotion?: ReservationPromotionInfo | null,
): boolean {
  return Boolean(reservation.promotionId && promotion?.type === 'time_limited')
}

export function getTimeLimitedPromotionPresentation(
  reservation: Reservation,
  promotion: ReservationPromotionInfo,
): PromotionVisitPresentation | null {
  const prizeLabel = promotion.title.trim() || 'tu premio'

  if (reservation.status === 'completed') {
    return {
      label: 'Cuando el restaurante confirme tu reserva podrás verificar para reclamar tu premio.',
      tone: 'neutral',
    }
  }

  if (reservation.status !== 'confirmed') {
    return null
  }

  if (
    reservation.minSpendVerification?.meetsMinimumSpend
    || (reservation.promotionVisitStatus === 'eligible' && !reservationNeedsMinimumSpendReview(reservation))
  ) {
    return {
      label: `¡Felicidades! Conseguiste ${prizeLabel} el ${formatReservationPrizeDateTime(reservation.startTime)}.`,
      tone: 'verified',
    }
  }

  if (reservation.promotionVisitStatus === 'not_eligible') {
    return {
      label: 'No se pudo validar el premio en esta visita.',
      tone: 'failed',
    }
  }

  if (reservationNeedsMinimumSpendReview(reservation)) {
    return {
      label: 'Verifica tu gasto para reclamar tu premio.',
      tone: 'pending',
    }
  }

  return null
}

export function buildTimeLimitedVerificationSuccessMessage(
  promotionTitle: string,
  reservationStartTime: Date,
): string {
  const prizeLabel = promotionTitle.trim() || 'tu premio'
  return `¡Felicidades! Conseguiste ${prizeLabel} el ${formatReservationPrizeDateTime(reservationStartTime)}.`
}

export function findActivePromotionReservation(
  reservations: Reservation[],
  promotionId: string,
): Reservation | null {
  const now = Date.now()
  const matches = reservations.filter(
    (reservation) =>
      reservation.promotionId === promotionId
      && reservation.status !== 'cancelled'
      && reservation.startTime.getTime() >= now - 1000 * 60 * 60 * 24,
  )

  if (matches.length === 0) {
    return null
  }

  matches.sort((left, right) => right.startTime.getTime() - left.startTime.getTime())
  return matches[0]
}

export function isTimeLimitedPromotionVisitComplete(reservation: Reservation): boolean {
  return Boolean(
    reservation.minSpendVerification?.meetsMinimumSpend
    || reservation.promotionVisitStatus === 'eligible',
  )
}

/** Reserva con promo tiempo limitado que aún requiere confirmación o verificación (carrusel activo). */
export function reservationNeedsTimeLimitedStripAction(reservation: Reservation): boolean {
  if (reservation.status === 'cancelled') {
    return false
  }

  if (isTimeLimitedPromotionVisitComplete(reservation)) {
    return false
  }

  if (reservation.promotionVisitStatus === 'not_eligible') {
    return false
  }

  if (reservation.status === 'completed') {
    return true
  }

  if (reservation.status === 'confirmed') {
    return reservationNeedsMinimumSpendReview(reservation)
  }

  return false
}

export function findTimeLimitedReservationForStrip(
  reservations: Reservation[],
  promotionId: string,
): Reservation | null {
  const reservation = findActivePromotionReservation(reservations, promotionId)
  if (!reservation || !reservationNeedsTimeLimitedStripAction(reservation)) {
    return null
  }

  return reservation
}

/** En Activas, solo enlazar reserva si aún hay acción pendiente (no verificada ni reclamada). */
export function findReservationForActivasFeed(
  reservations: Reservation[],
  promotionId: string,
  claimedReservationIds: ReadonlySet<string>,
): Reservation | null {
  const reservation = findActivePromotionReservation(reservations, promotionId)
  if (!reservation) {
    return null
  }

  if (isTimeLimitedPromotionVisitComplete(reservation)) {
    return null
  }

  if (claimedReservationIds.has(reservation.id)) {
    return null
  }

  return reservation
}

export function resolvePromotionVisitStatusOnConfirm(
  reservation: Reservation,
  meetsMinimumSpend: boolean | null,
): PromotionVisitStatus {
  if (!reservationHasMinimumSpendRequirement(reservation)) {
    return reservation.promotionId ? 'eligible' : 'n/a'
  }

  if (meetsMinimumSpend === true) {
    return 'eligible'
  }

  if (meetsMinimumSpend === false) {
    return 'not_eligible'
  }

  return 'pending'
}

function formatMinimumSpendLabel(reservation: Reservation): string {
  const euros = (reservation.minimumSpendCents ?? 0) / 100

  return Number.isInteger(euros)
    ? `${euros} €`
    : `${euros.toFixed(2).replace('.', ',')} €`
}

export function getPromotionVisitStatusPresentation(
  reservation: Reservation,
  isUpcoming: boolean,
  promotion?: ReservationPromotionInfo | null,
): PromotionVisitPresentation | null {
  if (promotion && isTimeLimitedPromotionReservation(reservation, promotion)) {
    return getTimeLimitedPromotionPresentation(reservation, promotion)
  }

  if (!reservationHasMinimumSpendRequirement(reservation)) {
    return null
  }

  const minLabel = formatMinimumSpendLabel(reservation)

  if (isUpcoming && reservation.status === 'completed') {
    return {
      label: `Gasto mínimo ${minLabel} — el restaurante lo confirmará tras tu visita`,
      tone: 'neutral',
    }
  }

  if (reservation.status === 'confirmed') {
    if (reservation.minSpendVerification?.meetsMinimumSpend) {
      return {
        label: `Gasto mínimo ${minLabel} - Verificado`,
        tone: 'verified',
      }
    }

    if (reservation.minSpendVerification && !reservation.minSpendVerification.meetsMinimumSpend) {
      return {
        label: `Gasto mínimo ${minLabel} - No alcanzado`,
        tone: 'failed',
      }
    }

    if (reservation.promotionVisitStatus === 'pending' || reservation.promotionVisitStatus === undefined) {
      return {
        label: `Gasto mínimo ${minLabel} — verifica tu consumo con un empleado`,
        tone: 'pending',
      }
    }

    if (reservation.promotionVisitStatus === 'eligible') {
      return {
        label: `Gasto mínimo ${minLabel} - Verificado`,
        tone: 'verified',
      }
    }

    if (reservation.promotionVisitStatus === 'not_eligible') {
      return {
        label: `Gasto mínimo ${minLabel} - No alcanzado`,
        tone: 'failed',
      }
    }
  }

  return null
}

export function getPromotionVisitStatusLabel(
  reservation: Reservation,
  isUpcoming: boolean,
  promotion?: ReservationPromotionInfo | null,
): string | null {
  return getPromotionVisitStatusPresentation(reservation, isUpcoming, promotion)?.label ?? null
}

import type { Reservation } from '../types'

export type CustomerReservationBucket = 'upcoming' | 'past'

export function splitCustomerReservations(reservations: Reservation[]) {
  const now = Date.now()

  const upcoming = reservations.filter(
    (reservation) =>
      reservation.status !== 'cancelled' && reservation.startTime.getTime() >= now,
  )

  const past = reservations.filter(
    (reservation) =>
      reservation.status === 'cancelled'
      || reservation.startTime.getTime() < now
      || reservation.status === 'completed',
  )

  upcoming.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  past.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())

  return { upcoming, past }
}

export function getReservationStatusLabel(status: Reservation['status'], isUpcoming: boolean) {
  if (status === 'cancelled') {
    return 'Cancelada'
  }

  if (status === 'completed') {
    return 'Completada'
  }

  return isUpcoming ? 'Confirmada' : 'Realizada'
}

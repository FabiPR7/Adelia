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

export function getReservationStatusLabel(
  status: Reservation['status'],
  isUpcoming: boolean,
  detail?: { noShow?: boolean; cancelledBy?: Reservation['cancelledBy'] },
) {
  if (status === 'cancelled') {
    // Antes todo salía «Cancelada», también cuando el local marcó que no fuiste.
    if (detail?.noShow) return 'No acudiste'
    if (detail?.cancelledBy === 'restaurant') return 'Cancelada por el local'
    return 'Cancelada'
  }

  // 'completed' es una reserva hecha a la que aún no se ha pasado lista.
  if (status === 'completed') {
    return isUpcoming ? 'Reservada' : 'Pendiente'
  }

  return isUpcoming ? 'Confirmada' : 'Realizada'
}

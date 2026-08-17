export type ReservationInviteStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'

export interface ReservationInvite {
  id: string
  reservationId: string
  companyId: string
  companyName: string
  companySlug: string
  companyPhotoUrl: string
  fromUid: string
  fromDisplayName: string
  fromPhotoUrl: string
  toUid: string
  toDisplayName: string
  toPhotoUrl: string
  status: ReservationInviteStatus
  reservationStatus: 'completed' | 'confirmed' | 'cancelled'
  startTime: string
  pax: number
  createdAt: string
  respondedAt: string | null
}

export const MAX_RESERVATION_INVITEES = 10

export function reservationInviteStatusLabel(status: ReservationInviteStatus): string {
  if (status === 'accepted') {
    return 'Aceptada'
  }
  if (status === 'rejected') {
    return 'Rechazada'
  }
  if (status === 'cancelled') {
    return 'Cancelada'
  }
  return 'Pendiente'
}

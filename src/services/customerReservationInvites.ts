import { getIdToken } from './auth'
import type { ReservationInvite } from '../types/reservationInvites'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface ReservationInvitesState {
  pending: ReservationInvite[]
  accepted: ReservationInvite[]
  sent: ReservationInvite[]
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await getIdToken()
  if (!token) {
    throw new Error('Debes iniciar sesión.')
  }
  return { Authorization: `Bearer ${token}` }
}

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  return payload.error ?? fallback
}

export async function fetchReservationInvitesState(): Promise<ReservationInvitesState> {
  const response = await fetch(`${API_BASE}/api/customer/reservation-invites/state`, {
    headers: await authHeaders(),
  })
  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudieron cargar las invitaciones.'))
  }
  const data = (await response.json()) as Partial<ReservationInvitesState>
  return {
    pending: data.pending ?? [],
    accepted: data.accepted ?? [],
    sent: data.sent ?? [],
  }
}

export async function acceptReservationInvite(inviteId: string): Promise<ReservationInvite> {
  const response = await fetch(
    `${API_BASE}/api/customer/reservation-invites/${encodeURIComponent(inviteId)}/accept`,
    { method: 'POST', headers: await authHeaders() },
  )
  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo aceptar la invitación.'))
  }
  const data = (await response.json()) as { invite?: ReservationInvite }
  if (!data.invite) {
    throw new Error('No se pudo aceptar la invitación.')
  }
  return data.invite
}

export async function rejectReservationInvite(inviteId: string): Promise<ReservationInvite> {
  const response = await fetch(
    `${API_BASE}/api/customer/reservation-invites/${encodeURIComponent(inviteId)}/reject`,
    { method: 'POST', headers: await authHeaders() },
  )
  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo rechazar la invitación.'))
  }
  const data = (await response.json()) as { invite?: ReservationInvite }
  if (!data.invite) {
    throw new Error('No se pudo rechazar la invitación.')
  }
  return data.invite
}

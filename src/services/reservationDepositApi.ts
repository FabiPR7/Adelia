import { getIdToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function syncReservationDeposit(
  companyId: string,
  reservationId: string,
  status: 'confirmed' | 'cancelled',
): Promise<void> {
  const token = await getIdToken()

  if (!token) {
    throw new Error('Debes iniciar sesión como restaurante.')
  }

  const response = await fetch(
    `${API_BASE}/api/company/${encodeURIComponent(companyId)}/reservations/${encodeURIComponent(reservationId)}/deposit/sync`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    },
  )

  const payload = (await response.json().catch(() => ({}))) as { error?: string }

  if (!response.ok) {
    throw new Error(payload.error ?? 'No se pudo gestionar la fianza de la reserva.')
  }
}

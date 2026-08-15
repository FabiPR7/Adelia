import { getIdToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function buildAuthHeaders(): Promise<HeadersInit> {
  const token = await getIdToken().catch(() => null)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function notifyReservationEmail(
  reservationId: string,
  endpoint: 'notify-received' | 'notify-confirmation',
  errorLabel: string,
): Promise<boolean> {
  if (!reservationId) {
    return false
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/reservations/${encodeURIComponent(reservationId)}/${endpoint}`,
      {
        method: 'POST',
        headers: await buildAuthHeaders(),
      },
    )

    const data = (await response.json().catch(() => ({}))) as {
      sent?: boolean
      error?: string
    }

    if (!response.ok) {
      console.warn(`No se pudo enviar el correo (${errorLabel}):`, data.error ?? response.status)
      return false
    }

    return data.sent === true
  } catch (error) {
    console.warn(`No se pudo contactar con la API de correo (${errorLabel}):`, error)
    return false
  }
}

export async function notifyReservationReceivedEmail(
  reservationId: string,
): Promise<boolean> {
  return notifyReservationEmail(reservationId, 'notify-received', 'reserva recibida')
}

export async function notifyReservationConfirmationEmail(
  reservationId: string,
): Promise<boolean> {
  return notifyReservationEmail(reservationId, 'notify-confirmation', 'confirmación')
}

export async function notifyReservationCancelledNotification(
  reservationId: string,
  cancelledBy: 'client' | 'restaurant',
): Promise<boolean> {
  if (!reservationId) {
    return false
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/reservations/${encodeURIComponent(reservationId)}/notify-cancelled`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await buildAuthHeaders()),
        },
        body: JSON.stringify({ cancelledBy }),
      },
    )

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      console.warn('No se pudo enviar la notificación de cancelación:', data.error ?? response.status)
      return false
    }

    return true
  } catch (error) {
    console.warn('No se pudo contactar con la API de cancelación:', error)
    return false
  }
}

export async function syncReservationClient(reservationId: string): Promise<boolean> {
  if (!reservationId) {
    return false
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/reservations/${encodeURIComponent(reservationId)}/sync-client`,
      {
        method: 'POST',
        headers: await buildAuthHeaders(),
      },
    )

    const data = (await response.json().catch(() => ({}))) as {
      synced?: boolean
      error?: string
    }

    if (!response.ok) {
      console.warn('No se pudo sincronizar el cliente:', data.error ?? response.status)
      return false
    }

    return data.synced === true
  } catch (error) {
    console.warn('No se pudo contactar con la API de clientes:', error)
    return false
  }
}

export async function waitForReservationSubmit(): Promise<void> {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 900)
  })
}

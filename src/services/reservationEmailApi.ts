const API_BASE = import.meta.env.VITE_API_URL ?? ''

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
      { method: 'POST' },
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

export async function syncReservationClient(reservationId: string): Promise<boolean> {
  if (!reservationId) {
    return false
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/reservations/${encodeURIComponent(reservationId)}/sync-client`,
      { method: 'POST' },
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

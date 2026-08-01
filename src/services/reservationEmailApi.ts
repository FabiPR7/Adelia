const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function notifyReservationConfirmationEmail(
  reservationId: string,
): Promise<boolean> {
  if (!reservationId) {
    return false
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/reservations/${encodeURIComponent(reservationId)}/notify-confirmation`,
      { method: 'POST' },
    )

    const data = (await response.json().catch(() => ({}))) as {
      sent?: boolean
      error?: string
    }

    if (!response.ok) {
      console.warn('No se pudo enviar el correo de confirmación:', data.error ?? response.status)
      return false
    }

    return data.sent === true
  } catch (error) {
    console.warn('No se pudo contactar con la API de correo:', error)
    return false
  }
}

export async function waitForReservationSubmit(): Promise<void> {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 900)
  })
}

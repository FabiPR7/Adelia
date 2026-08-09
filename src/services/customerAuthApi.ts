import { getIdToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; message?: string }

    return data.error ?? data.message ?? fallback
  } catch {
    return fallback
  }
}

export async function requestCustomerVerificationEmailSend(): Promise<void> {
  const token = await getIdToken()

  if (!token) {
    throw new Error('Inicia sesión para enviar el correo de verificación.')
  }

  const response = await fetch(`${API_BASE}/api/auth/customer/send-verification-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(await readApiError(response, 'No se pudo enviar el correo de verificación.'))
  }
}

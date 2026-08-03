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

/** Sincroniza contraseña y flags en el servidor (custom claims, credenciales admin). */
export async function syncInitialPasswordChange(newPassword: string): Promise<void> {
  const token = await getIdToken()

  if (!token) {
    return
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/complete-initial-password-change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ newPassword }),
    })

    if (!response.ok) {
      return
    }

    await response.json()
  } catch {
    // La contraseña ya se cambió en Firebase Auth; la sync con API es opcional.
  }
}

export async function requestPasswordReset(loginName: string, email: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ loginName, email }),
  })

  const data = (await response.json()) as { message?: string; error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo enviar la solicitud.')
  }

  return data.message ?? 'Si los datos son correctos, recibirás un correo con instrucciones en unos minutos.'
}

export async function validatePasswordResetToken(token: string): Promise<{
  valid: boolean
  companyName?: string
}> {
  const response = await fetch(
    `${API_BASE}/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
  )

  if (!response.ok) {
    return { valid: false }
  }

  return (await response.json()) as { valid: boolean; companyName?: string }
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, newPassword }),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response, 'No se pudo restablecer la contraseña.'))
  }
}

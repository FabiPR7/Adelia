import { getIdToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

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

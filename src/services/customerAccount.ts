const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function deleteCustomerAccount(confirm: string): Promise<void> {
  const { auth } = await import('../config/firebase')
  const token = await auth.currentUser?.getIdToken()
  if (!token) {
    throw new Error('Debes iniciar sesión.')
  }

  const response = await fetch(`${API_BASE}/api/customer/account/delete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ confirm }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(payload.error || 'No se pudo eliminar la cuenta.')
  }
}

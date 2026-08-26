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

export async function registerCustomerAccount(input: {
  email: string
  password: string
  displayName: string
  phone: string
  recaptchaToken?: string
}): Promise<void> {
  const response = await fetch(`${API_BASE}/api/auth/customer/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response, 'No se pudo crear la cuenta.'))
  }
}

export async function preLoginCustomer(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/auth/customer/pre-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Email o contraseña incorrectos.'))
  }
}

export async function bootstrapCustomerProfile(recaptchaToken?: string): Promise<{ existing: boolean }> {
  const token = await getIdToken()
  if (!token) {
    throw new Error('No hay sesión activa.')
  }

  const response = await fetch(`${API_BASE}/api/auth/customer/bootstrap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ recaptchaToken: recaptchaToken ?? '' }),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response, 'No se pudo completar el registro.'))
  }

  const data = (await response.json().catch(() => ({}))) as { existing?: boolean }
  return { existing: data.existing === true }
}

export async function syncInitialPasswordChange(newPassword: string): Promise<void> {
  const token = await getIdToken()

  if (!token) {
    throw new Error('No hay sesión activa para sincronizar la contraseña.')
  }

  const response = await fetch(`${API_BASE}/api/auth/complete-initial-password-change`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ newPassword }),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response, 'No se pudo sincronizar el cambio de contraseña.'))
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

export async function requestCustomerPasswordReset(email: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/auth/customer/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })

  const data = (await response.json()) as { message?: string; error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo enviar la solicitud.')
  }

  return data.message ?? 'Si los datos son correctos, recibirás un correo con instrucciones en unos minutos.'
}

export async function validatePasswordResetToken(token: string): Promise<{
  valid: boolean
  audience?: 'company' | 'customer'
  companyName?: string
  accountName?: string
}> {
  const response = await fetch(
    `${API_BASE}/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
  )

  if (!response.ok) {
    return { valid: false }
  }

  return (await response.json()) as {
    valid: boolean
    audience?: 'company' | 'customer'
    companyName?: string
    accountName?: string
  }
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

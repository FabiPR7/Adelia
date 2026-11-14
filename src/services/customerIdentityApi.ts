import { getIdToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function authHeaders(): Promise<HeadersInit> {
  const token = await getIdToken()
  if (!token) throw new Error('Tu sesión ha caducado. Vuelve a entrar.')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export interface UsernameCheck {
  available: boolean
  username: string
  error: string | null
}

export async function checkUsernameAvailable(username: string): Promise<UsernameCheck> {
  const response = await fetch(
    `${API_BASE}/api/customer/account/username-available?u=${encodeURIComponent(username)}`,
    { headers: await authHeaders() },
  )
  const data = (await response.json().catch(() => ({}))) as Partial<UsernameCheck> & { error?: string }
  if (!response.ok) throw new Error(data.error ?? 'No se pudo comprobar el @usuario.')
  return { available: data.available === true, username: data.username ?? username, error: data.error ?? null }
}

export async function updateCustomerIdentity(input: { displayName?: string; username?: string }): Promise<{ displayName: string; username: string }> {
  const response = await fetch(`${API_BASE}/api/customer/account/identity`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(input),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string; displayName?: string; username?: string }
  if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar tu nombre.')
  return { displayName: data.displayName ?? '', username: data.username ?? '' }
}

/** Propuesta de @usuario a partir del nombre: «José María» → «josemaria». */
export function suggestUsername(displayName: string, email = ''): string {
  const fold = (value: string) => value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
  const fromName = fold(displayName).slice(0, 16)
  const fromEmail = fold(email.split('@')[0] ?? '').slice(0, 16)
  const base = fromName.length >= 3 ? fromName : fromEmail.length >= 3 ? fromEmail : 'foodie'
  return base.startsWith('adelia') ? `foodie${base.slice(6)}`.slice(0, 16) : base
}

/** Mismas reglas que el servidor, para avisar antes de enviar. */
export function localUsernameError(username: string): string | null {
  const clean = username.trim().replace(/^@+/, '').toLowerCase()
  if (clean.length < 3 || clean.length > 20) return 'Entre 3 y 20 caracteres.'
  if (!/^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/.test(clean)) {
    return 'Solo letras sin tilde, números, punto o guion bajo (sin empezar ni acabar por ellos).'
  }
  if (/[._]{2}/.test(clean)) return 'No pongas dos puntos o guiones bajos seguidos.'
  return null
}

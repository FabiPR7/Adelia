import { getIdToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function authHeaders(): Promise<HeadersInit> {
  const token = await getIdToken()
  if (!token) {
    throw new Error('Debes iniciar sesión.')
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  return payload.error ?? fallback
}

export async function fetchCustomerFavoriteSlugs(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/api/customer/favorites`, {
    headers: await authHeaders(),
  })
  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudieron cargar los favoritos.'))
  }
  const data = (await response.json()) as { favoriteSlugs?: string[] }
  return Array.isArray(data.favoriteSlugs) ? data.favoriteSlugs : []
}

export async function setCustomerFavoriteViaApi(
  slug: string,
  saved: boolean,
): Promise<string[]> {
  const response = await fetch(
    `${API_BASE}/api/customer/favorites/${encodeURIComponent(slug)}`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ saved }),
    },
  )
  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo actualizar el favorito.'))
  }
  const data = (await response.json()) as { favoriteSlugs?: string[] }
  return Array.isArray(data.favoriteSlugs) ? data.favoriteSlugs : []
}

export async function replaceCustomerFavoritesViaApi(favoriteSlugs: string[]): Promise<string[]> {
  const response = await fetch(`${API_BASE}/api/customer/favorites`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ favoriteSlugs }),
  })
  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudieron guardar los favoritos.'))
  }
  const data = (await response.json()) as { favoriteSlugs?: string[] }
  return Array.isArray(data.favoriteSlugs) ? data.favoriteSlugs : []
}

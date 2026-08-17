import { getIdToken } from './auth'
import type { FriendProfile } from '../types/friends'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface FriendsStatePayload {
  friends: FriendProfile[]
  incoming: FriendProfile[]
  outgoing: FriendProfile[]
  favoriteIds: string[]
  friendIds: string[]
  incomingRequestIds: string[]
  outgoingRequestIds: string[]
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await getIdToken()
  if (!token) {
    throw new Error('Debes iniciar sesión.')
  }
  return { Authorization: `Bearer ${token}` }
}

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  return payload.error ?? fallback
}

export async function fetchFriendsState(): Promise<FriendsStatePayload> {
  const response = await fetch(`${API_BASE}/api/customer/friends/state`, {
    headers: await authHeaders(),
  })
  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo cargar amigos.'))
  }
  return (await response.json()) as FriendsStatePayload
}

export async function sendFriendRequest(targetUid: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/customer/friends/requests/${encodeURIComponent(targetUid)}`,
    { method: 'POST', headers: await authHeaders() },
  )
  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo enviar la solicitud.'))
  }
}

export async function acceptFriendRequest(fromUid: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/customer/friends/requests/${encodeURIComponent(fromUid)}/accept`,
    { method: 'POST', headers: await authHeaders() },
  )
  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo aceptar la solicitud.'))
  }
}

export async function rejectFriendRequest(fromUid: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/customer/friends/requests/${encodeURIComponent(fromUid)}/reject`,
    { method: 'POST', headers: await authHeaders() },
  )
  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo rechazar la solicitud.'))
  }
}

export async function removeFriend(friendUid: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/customer/friends/${encodeURIComponent(friendUid)}`,
    { method: 'DELETE', headers: await authHeaders() },
  )
  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo eliminar el amigo.'))
  }
}

export async function searchCustomers(query: string): Promise<FriendProfile[]> {
  const response = await fetch(
    `${API_BASE}/api/customer/friends/search?q=${encodeURIComponent(query)}`,
    { headers: await authHeaders() },
  )
  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo buscar.'))
  }
  const data = (await response.json()) as { results?: FriendProfile[] }
  return data.results ?? []
}

export async function toggleFriendFavorite(friendUid: string): Promise<boolean> {
  const response = await fetch(
    `${API_BASE}/api/customer/friends/favorites/${encodeURIComponent(friendUid)}`,
    { method: 'POST', headers: await authHeaders() },
  )
  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo actualizar el favorito.'))
  }
  const data = (await response.json()) as { favorite?: boolean }
  return data.favorite === true
}

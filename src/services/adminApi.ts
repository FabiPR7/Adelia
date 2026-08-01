import type {
  Company,
  CreateCompanyPayload,
  UpdateCompanyPayload,
} from '../types'
import { getIdToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function parseResponse(response: Response) {
  const text = await response.text()

  if (!text) {
    if (!response.ok) {
      throw new Error(
        response.status === 502 || response.status === 504
          ? 'La API no responde. Inténtalo de nuevo en unos segundos.'
          : `Error del servidor (${response.status}) sin respuesta.`,
      )
    }

    return {}
  }

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error('Respuesta inválida del servidor.')
  }
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getIdToken()

  if (!token) {
    throw new Error('No hay sesión activa.')
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })
  } catch {
    throw new Error('No se pudo conectar con la API.')
  }

  const data = await parseResponse(response)

  if (!response.ok) {
    throw new Error((data.error as string) ?? 'Error en la petición.')
  }

  return data as T
}

export async function createCompany(payload: CreateCompanyPayload) {
  return apiRequest<{ company: Company; loginName: string; password: string }>(
    '/api/companies',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export async function updateCompany(id: string, payload: UpdateCompanyPayload) {
  return apiRequest<{ company: Company; loginName?: string; password?: string }>(
    `/api/companies/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )
}

export async function deleteCompany(id: string) {
  return apiRequest<{ success: boolean }>(`/api/companies/${id}`, {
    method: 'DELETE',
  })
}

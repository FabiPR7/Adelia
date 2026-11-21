import { getIdToken } from './auth'
import { clearPanelCache } from '../utils/panelCache'

// Llamadas del panel del restaurante a su API. El panel ya no escribe en la base de
// datos: pide el cambio y el servidor comprueba que eres el dueño del local y que
// los datos son válidos.
const API_BASE = import.meta.env.VITE_API_URL ?? ''

export class CompanyApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function callCompanyApi<T = Record<string, unknown>>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  fallbackError = 'No se pudo guardar. Inténtalo de nuevo.',
): Promise<T> {
  const token = await getIdToken().catch(() => null)
  if (!token) {
    throw new CompanyApiError('Tu sesión ha caducado. Vuelve a entrar.', 401)
  }
  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/company${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch {
    throw new CompanyApiError('Sin conexión. Revisa internet e inténtalo de nuevo.', 0)
  }
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) {
    throw new CompanyApiError(data.error ?? fallbackError, response.status)
  }
  // Algo cambió: mesas, promos y reseñas se vuelven a leer la próxima vez.
  if (method !== 'GET') clearPanelCache()
  return data
}

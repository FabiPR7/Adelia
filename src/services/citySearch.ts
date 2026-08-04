export interface CitySuggestion {
  id: string
  name: string
  region: string
  country: string
  label: string
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function searchWorldCities(query: string): Promise<CitySuggestion[]> {
  const trimmed = query.trim()

  if (trimmed.length < 2) {
    return []
  }

  const url = `${API_BASE}/api/public/cities/search?q=${encodeURIComponent(trimmed)}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('No se pudieron cargar ciudades.')
  }

  const payload = (await response.json()) as {
    suggestions?: CitySuggestion[]
    error?: string
  }

  if (payload.error) {
    throw new Error(payload.error)
  }

  return payload.suggestions ?? []
}

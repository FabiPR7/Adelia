import { getIdToken } from './auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export const REPORT_REASON_OPTIONS = [
  { value: 'promo_not_honored', label: 'No me dio la promoción' },
  { value: 'reservation_issue', label: 'Problema con la reserva' },
  { value: 'charge_issue', label: 'Cobro o fianza incorrectos' },
  { value: 'wrong_info', label: 'Información falsa o desactualizada' },
  { value: 'bad_treatment', label: 'Trato inadecuado' },
  { value: 'other', label: 'Otro motivo' },
] as const

export type ReportReason = (typeof REPORT_REASON_OPTIONS)[number]['value']

export const SUGGESTION_TOPIC_OPTIONS = [
  { value: 'idea', label: 'Idea o mejora' },
  { value: 'bug', label: 'Algo no funciona' },
  { value: 'restaurant', label: 'Quiero un restaurante en Adelia' },
  { value: 'other', label: 'Otra cosa' },
] as const

export type SuggestionTopic = (typeof SUGGESTION_TOPIC_OPTIONS)[number]['value']

async function post(path: string, body: unknown, fallback: string): Promise<void> {
  const token = await getIdToken()
  if (!token) {
    throw new Error('Inicia sesión para enviarlo.')
  }
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Sin conexión. Revisa internet e inténtalo de nuevo.')
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? fallback)
  }
}

export function sendRestaurantReport(input: {
  companyId: string
  reason: ReportReason
  message: string
  reservationId?: string
  promotionId?: string
}): Promise<void> {
  return post('/api/customer/reports', input, 'No se pudo enviar el reporte.')
}

export function sendSuggestion(input: { topic: SuggestionTopic; message: string }): Promise<void> {
  return post('/api/customer/suggestions', input, 'No se pudo enviar la sugerencia.')
}

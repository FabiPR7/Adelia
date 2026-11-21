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

/** Motivos para reportar una reseña o a un usuario (mismos que el servidor). */
export const CONTENT_REPORT_REASON_OPTIONS = [
  { value: 'offensive', label: 'Ofensivo, odio o insultos' },
  { value: 'harassment', label: 'Acoso o amenazas' },
  { value: 'sexual', label: 'Contenido sexual o foto inapropiada' },
  { value: 'spam', label: 'Spam o publicidad' },
  { value: 'fake', label: 'Falso o engañoso' },
  { value: 'impersonation', label: 'Se hace pasar por otra persona' },
  { value: 'other', label: 'Otro motivo' },
] as const

export type ContentReportReason = (typeof CONTENT_REPORT_REASON_OPTIONS)[number]['value']

export type ContentReportTarget =
  | { targetType: 'review'; companySlug: string; reviewId: string }
  | { targetType: 'user'; targetUid: string }

export function sendContentReport(
  target: ContentReportTarget,
  input: { reason: ContentReportReason; message: string },
): Promise<void> {
  return post('/api/customer/reports/content', { ...target, ...input }, 'No se pudo enviar el reporte.')
}

export function sendSuggestion(input: { topic: SuggestionTopic; message: string }): Promise<void> {
  return post('/api/customer/suggestions', input, 'No se pudo enviar la sugerencia.')
}
